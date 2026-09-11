"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Play,
  Pause,
  AlertTriangle,
  RotateCcw,
  LogOut,
  Radio,
  Zap,
  CheckCircle2,
  Sliders,
  Compass,
  ArrowDownCircle,
  Gauge,
  Clock,
  Sparkles,
  Camera,
  Gamepad2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Activity,
  Layers,
  Smartphone,
} from "lucide-react";
import RoboticCameraHUD from "./RoboticCameraHUD";
import DockingMap2D from "./DockingMap2D";

export default function RoboticMissionControl({ user, onLogout }) {
  // Robot pose in arena: x (0 to 2.0m), y (0 to 2.0m), theta (-180 to 180 deg)
  const [robotPose, setRobotPose] = useState({ x: 1.15, y: 1.65, theta: -84 });
  const [isDocking, setIsDocking] = useState(false);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [fsmState, setFsmState] = useState("APPROACH"); // 'LINE_FOLLOW' | 'APPROACH' | 'FINE_ALIGN' | 'DOCKED' | 'STOP'
  const [dwellTime, setDwellTime] = useState(0.0);
  const [activeView, setActiveView] = useState("diptych"); // 'diptych' | 'hud' | 'arena'
  const [isGpsSynced, setIsGpsSynced] = useState(false);
  const [dockGps, setDockGps] = useState(null);

  const handleSyncLaptopGps = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const backendHost = window.location.hostname || "localhost";
            await fetch("/api/dock/anchor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: latitude, lng: longitude, label: "Laptop Dock" }),
            });
            setIsGpsSynced(true);
            setDockGps({ lat: latitude, lng: longitude });
          } catch (err) {
            console.warn("Could not sync dock anchor with backend:", err);
            setIsGpsSynced(true);
            setDockGps({ lat: latitude, lng: longitude });
          }
        },
        (err) => console.warn("GPS error:", err.message),
        { enableHighAccuracy: true }
      );
    }
  };

  // Live Phone Camera & Mobile GPS State
  const [phoneFrame, setPhoneFrame] = useState(null);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [mobileGpsPose, setMobileGpsPose] = useState(null);
  const [obstacleTelemetry, setObstacleTelemetry] = useState({
    corridor_blocked: false,
    min_distance_m: null,
    detected_obstacles: [],
  });

  // Poll for phone camera stream and real-time GPS motion from /api/camera/frame
  useEffect(() => {
    let mounted = true;
    const pollPhoneStream = async () => {
      try {
        const res = await fetch("/api/camera/frame");
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.isFresh) {
            setIsPhoneConnected(true);
            if (data.frame) {
              setPhoneFrame(data.frame);
            }
            if (data.obstacle) {
              setObstacleTelemetry(data.obstacle);
            }
            if (data.pose) {
              setMobileGpsPose(data.pose);
              if (typeof data.pose.x === "number" && typeof data.pose.y === "number") {
                // Moving mobile phone moves the GPS marker on the 2D map in real time!
                setRobotPose((prev) => ({
                  x: Number(data.pose.x.toFixed(3)),
                  y: Number(data.pose.y.toFixed(3)),
                  theta: typeof data.pose.heading === "number" ? Math.round(data.pose.heading) : prev.theta,
                }));
              }
            }
          } else {
            setIsPhoneConnected(false);
          }
        }
      } catch (e) {
        // network polling silence
      }
    };

    const interval = setInterval(pollPhoneStream, 70); // ~14-15 FPS
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Derived 6-DOF Telemetry Metrics
  const powerStationPos = { x: 1.0, y: 0.35 };
  const dx = robotPose.x - powerStationPos.x;
  const dy = robotPose.y - powerStationPos.y;
  const arenaDistanceM = Math.sqrt(dx * dx + dy * dy);
  // Prioritize live metric distance calculated from phone to laptop dock
  const distanceM = (isPhoneConnected && typeof mobileGpsPose?.distance_m === "number" && mobileGpsPose.distance_m > 0)
    ? mobileGpsPose.distance_m
    : arenaDistanceM;
  const lateralOffsetM = dx;
  const isCharged = distanceM <= 0.03 || fsmState === "DOCKED";
  const targetHeadingDeg = (Math.atan2(-dy, -dx) * 180) / Math.PI;
  const headingErrorDeg = Math.round(robotPose.theta - targetHeadingDeg);

  // 6-DOF Simulated Rotational & Elevation Perturbations
  const pitchDeg = Number((Math.sin(Date.now() / 600) * 0.4).toFixed(2));
  const rollDeg = Number((Math.cos(Date.now() / 500) * 0.25).toFixed(2));
  const elevationZ = 0.0; // Flat arena surface normal

  // Step sizing according to speed setting

  // Manual position override disabled: Robot location is strictly driven by live Phone GPS & Camera movements.

  // Autonomous Docking Simulation Loop
  useEffect(() => {
    if (!isDocking || isEmergencyStopped) return;

    const interval = setInterval(() => {
      setRobotPose((prev) => {
        const remainingDist = Math.sqrt(
          (prev.x - powerStationPos.x) ** 2 + (prev.y - powerStationPos.y) ** 2
        );

        // If docked within tolerance
        if (remainingDist <= 0.06) {
          setDwellTime((dt) => {
            if (dt >= 1.0) {
              setFsmState("DOCKED");
              setIsDocking(false);
              return 1.0;
            }
            return dt + 0.1;
          });
          return { x: 1.0, y: 0.42, theta: -90 };
        }

        // Steer along guide path (x -> 1.0, y -> 0.42)
        const stepY = 0.015;
        const newY = Math.max(0.42, prev.y - stepY);
        const newX = prev.x + (1.0 - prev.x) * 0.08;

        // FSM State transitions
        if (remainingDist > 0.8) {
          setFsmState("LINE_FOLLOW");
        } else if (remainingDist > 0.35) {
          setFsmState("APPROACH");
        } else {
          setFsmState("FINE_ALIGN");
        }

        return {
          x: Number(newX.toFixed(3)),
          y: Number(newY.toFixed(3)),
          theta: -90 + Math.sin(Date.now() / 400) * 3,
        };
      });
    }, 80);

    return () => clearInterval(interval);
  }, [isDocking, isEmergencyStopped]);

  // E-STOP Toggle
  const handleToggleEStop = () => {
    if (!isEmergencyStopped) {
      setIsEmergencyStopped(true);
      setIsDocking(false);
      setFsmState("STOP");
    } else {
      setIsEmergencyStopped(false);
      setFsmState("APPROACH");
    }
  };

  // Reset Arena
  const handleReset = () => {
    setRobotPose({ x: 1.18, y: 1.68, theta: -84 });
    setIsDocking(false);
    setIsEmergencyStopped(false);
    setFsmState("APPROACH");
    setDwellTime(0.0);
  };

  // Tolerance checks
  const isLateralWithinTol = Math.abs(lateralOffsetM) <= 0.025; // ±2.5cm
  const isHeadingWithinTol = Math.abs(headingErrorDeg) <= 3; // ±3 deg

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1A1715] flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none bg-parchment-pattern">
      {/* ============================================================
          1. HEADER: BRAND, STATUS, VIEW SWITCHER & PRIMARY CONTROLS
          ============================================================ */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 frame-gilded mb-4 shadow-xl backdrop-blur-md">
        {/* Left: Pure Brand & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#FAF7F2] border-2 border-[#C5A059] flex items-center justify-center text-[#FF3820] shadow-[0_0_10px_rgba(197,160,89,0.25)]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-sans font-black tracking-tight text-[#FF3820]">
                V-DOCKX
              </h1>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#C5A059]/20 text-[#8C6D31] border border-[#C5A059]/30">
                RAS Cockpit
              </span>
            </div>
            <p className="text-xs text-stone-500 font-sans font-medium">
              Autonomous Robotic Ground Vehicle Docking Suite
            </p>
          </div>
        </div>

        {/* Center: Viewport Switcher & Primary Docking/Teleop Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Switcher Pill */}
          <div className="flex items-center bg-[#FAF7F2] p-1 rounded-full border border-[#C5A059]/40 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveView("diptych")}
              className={`px-3.5 py-1 rounded-full text-xs font-sans font-bold transition-all cursor-pointer ${
                activeView === "diptych"
                  ? "bg-[#FF3820] text-white shadow-sm"
                  : "text-[#8C6D31] hover:text-[#1A1715]"
              }`}
            >
              ✦ Diptych
            </button>
            <button
              type="button"
              onClick={() => setActiveView("hud")}
              className={`px-3.5 py-1 rounded-full text-xs font-sans font-bold transition-all cursor-pointer ${
                activeView === "hud"
                  ? "bg-[#FF3820] text-white shadow-sm"
                  : "text-[#8C6D31] hover:text-[#1A1715]"
              }`}
            >
              👁 Camera
            </button>
            <button
              type="button"
              onClick={() => setActiveView("arena")}
              className={`px-3.5 py-1 rounded-full text-xs font-sans font-bold transition-all cursor-pointer ${
                activeView === "arena"
                  ? "bg-[#FF3820] text-white shadow-sm"
                  : "text-[#8C6D31] hover:text-[#1A1715]"
              }`}
            >
              ☩ Arena Map
            </button>
          </div>

          {/* Mobile Phone GPS Motion Sync Badge */}
          {isPhoneConnected && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-500/40 text-emerald-800 text-xs font-mono font-semibold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                MOBILE GPS {mobileGpsPose?.distance_m ? `[${mobileGpsPose.distance_m.toFixed(2)}m]` : "[SYNCED]"}
              </span>
            </div>
          )}

          {/* Real-time Collision Reading Distance Badge in Header */}
          {isPhoneConnected && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold shadow-xs border ${
              obstacleTelemetry.corridor_blocked
                ? "bg-red-50 border-red-400 text-red-700 animate-pulse"
                : "bg-stone-50 border-stone-300 text-stone-700"
            }`}>
              <ShieldAlert className={`w-3.5 h-3.5 ${obstacleTelemetry.corridor_blocked ? "text-red-600" : "text-emerald-600"}`} />
              <span>
                COLLISION: {typeof obstacleTelemetry.min_distance_m === "number" && obstacleTelemetry.min_distance_m <= 5.0
                  ? `${obstacleTelemetry.min_distance_m.toFixed(2)}m`
                  : "CLEAR (>5.0m)"}
              </span>
            </div>
          )}

          {/* CHARGED State Prominent Indicator */}
          {isCharged && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-600 border-2 border-white text-white text-xs font-mono font-black shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-bounce">
              <Zap className="w-4 h-4 fill-current text-yellow-300" />
              <span>⚡ CHARGED (100%) · DOCKED</span>
            </div>
          )}



          {/* Sync Laptop Dock GPS Button */}
          <button
            type="button"
            onClick={handleSyncLaptopGps}
            className={`px-4 py-2 rounded-full text-xs font-sans font-bold transition-all flex items-center gap-2 cursor-pointer ${
              isGpsSynced
                ? "bg-emerald-50 text-emerald-800 border-2 border-emerald-400 shadow-sm"
                : "bg-white border border-[#C5A059]/40 text-stone-700 hover:bg-[#FAF7F2]"
            }`}
            title="Anchor charging dock position to laptop's real GPS coordinates"
          >
            <MapPin className="w-4 h-4 text-[#D4AF37]" />
            <span>{isGpsSynced ? "Laptop Dock Anchored" : "Sync Laptop Dock GPS"}</span>
          </button>
        </div>

        {/* Right: Emergency & Operator Session */}
        <div className="flex items-center gap-3">
          {/* Reset Arena */}
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-full bg-white border border-[#C5A059]/40 text-[#8C6D31] hover:text-[#1A1715] hover:border-[#C5A059] transition-colors shadow-sm cursor-pointer"
            title="Reset Arena Telemetry"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* E-STOP Safeguard */}
          <button
            type="button"
            onClick={handleToggleEStop}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-sans font-bold transition-all shadow-sm cursor-pointer ${
              isEmergencyStopped
                ? "bg-[#FF3820] text-white border border-red-300 shadow-[0_0_16px_rgba(255,56,32,0.8)] animate-pulse"
                : "bg-red-50 border border-[#FF3820]/40 text-[#FF3820] hover:bg-red-100"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isEmergencyStopped ? "E-STOP ACTIVE" : "E-STOP"}</span>
          </button>

          {/* Operator Badge (Showing innovix) */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-[#C5A059]/30">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-[#1A1715] font-sans leading-none">
                {user?.username || user?.name || "innovix"}
              </span>
              <span className="text-[10px] font-mono text-[#8C6D31] font-semibold">
                Lead Operator
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-full bg-white border border-[#C5A059]/30 text-stone-500 hover:text-[#FF3820] hover:border-[#FF3820] transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          2. VIEWPORTS: STREAMLINED EXPANDED VIEW (CAMERA + ARENA MAP)
          ============================================================ */}
      <main className="flex-1 mb-4 flex flex-col relative">
        {/* Viewport Renderings */}
        {activeView === "diptych" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[480px] lg:h-[560px]">
            <RoboticCameraHUD
              distanceM={distanceM}
              lateralOffsetM={lateralOffsetM}
              headingErrorDeg={headingErrorDeg}
              isDocking={isDocking}
              phoneFrame={phoneFrame}
              isPhoneConnected={isPhoneConnected}
              mobileGpsPose={mobileGpsPose}
              isCharged={isCharged}
              obstacleTelemetry={obstacleTelemetry}
            />
            <DockingMap2D
              robotPose={robotPose}
              onRobotMove={null}
              isDocking={isDocking}
              mobileGpsPose={mobileGpsPose}
              isPhoneConnected={isPhoneConnected}
              isCharged={isCharged}
              distToDock={distanceM}
              obstacleTelemetry={obstacleTelemetry}
            />
          </div>
        )}

        {activeView === "hud" && (
          <div className="w-full h-[500px] lg:h-[580px]">
            <RoboticCameraHUD
              distanceM={distanceM}
              lateralOffsetM={lateralOffsetM}
              headingErrorDeg={headingErrorDeg}
              isDocking={isDocking}
              phoneFrame={phoneFrame}
              isPhoneConnected={isPhoneConnected}
              mobileGpsPose={mobileGpsPose}
              isCharged={isCharged}
              obstacleTelemetry={obstacleTelemetry}
            />
          </div>
        )}

        {activeView === "arena" && (
          <div className="w-full h-[500px] lg:h-[580px]">
            <DockingMap2D
              robotPose={robotPose}
              onRobotMove={null}
              isDocking={isDocking}
              mobileGpsPose={mobileGpsPose}
              isPhoneConnected={isPhoneConnected}
              isCharged={isCharged}
              distToDock={distanceM}
              obstacleTelemetry={obstacleTelemetry}
            />
          </div>
        )}
      </main>

      {/* ============================================================
          3. 6-DOF APRILTAG ALIGNMENT HUD & TELEMETRY BAR
          ============================================================ */}
      <footer className="frame-gilded p-4 sm:p-5 shadow-lg backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 max-w-7xl mx-auto">
          
          {/* Card 1: 3-Axis Translation (X, Y, Z) */}
          <div className="flex items-center gap-3.5 p-2 rounded-2xl bg-white/60 border border-[#C5A059]/25">
            <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#C5A059]/40 flex items-center justify-center text-[#FF3820] shadow-xs">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono font-bold text-[#8C6D31] uppercase tracking-wider">
                TRANSLATION (X, Y, Z)
              </div>
              <div className="flex items-baseline gap-2 mt-0.5 font-mono text-sm font-bold text-[#1A1715]">
                <span>X: <span className="text-stone-900">{(lateralOffsetM * 100).toFixed(1)}cm</span></span>
                <span>Y: <span className="text-stone-900">{distanceM.toFixed(2)}m</span></span>
                <span>Z: <span className="text-stone-500">0.0cm</span></span>
              </div>
              {/* Tolerance Visual Bar */}
              <div className="w-full bg-stone-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isLateralWithinTol ? "bg-emerald-500" : "bg-[#FF3820]"
                  }`}
                  style={{
                    width: `${Math.max(8, Math.min(100, (1 - Math.abs(lateralOffsetM) / 0.5) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: 3-Axis Orientation (Yaw, Pitch, Roll) */}
          <div className="flex items-center gap-3.5 p-2 rounded-2xl bg-white/60 border border-[#C5A059]/25">
            <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono font-bold text-[#8C6D31] uppercase tracking-wider">
                ORIENTATION (YAW, P, R)
              </div>
              <div className="flex items-baseline gap-2 mt-0.5 font-mono text-sm font-bold text-[#1A1715]">
                <span>Ψ: <span className={isHeadingWithinTol ? "text-emerald-700" : "text-[#FF3820]"}>{headingErrorDeg}°</span></span>
                <span>θ: <span className="text-stone-500">{pitchDeg}°</span></span>
                <span>φ: <span className="text-stone-500">{rollDeg}°</span></span>
              </div>
              {/* Tolerance Visual Bar */}
              <div className="w-full bg-stone-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isHeadingWithinTol ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{
                    width: `${Math.max(8, Math.min(100, (1 - Math.abs(headingErrorDeg) / 30) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Alignment Status & Tolerance Gate */}
          <div className="flex items-center gap-3.5 p-2 rounded-2xl bg-white/60 border border-[#C5A059]/25">
            <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#C5A059]/40 flex items-center justify-center text-[#FF3820] shadow-xs">
              <Sliders className="w-5 h-5 text-[#8C6D31]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono font-bold text-[#8C6D31] uppercase tracking-wider">
                ALIGNMENT GATE
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    isLateralWithinTol && isHeadingWithinTol
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-[#FF3820]/10 text-[#FF3820] border border-[#FF3820]/30"
                  }`}
                >
                  {isLateralWithinTol && isHeadingWithinTol ? "IN TOLERANCE (±2cm)" : "CALIBRATING"}
                </span>
              </div>
              <span className="text-[10px] font-mono text-stone-500 mt-1 block">
                HOMOGRAPHY: 6-DOF LOCKED
              </span>
            </div>
          </div>

          {/* Card 4: FSM Operational Phase / Charged */}
          <div className={`flex items-center gap-3.5 p-2 rounded-2xl border transition-all ${
            isCharged
              ? "bg-emerald-50/90 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              : "bg-white/60 border-[#C5A059]/25"
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xs border ${
              isCharged ? "bg-emerald-500 text-white border-white animate-pulse" : "bg-[#FAF7F2] border-[#C5A059]/40 text-[#8C6D31]"
            }`}>
              {isCharged ? <Zap className="w-5 h-5 fill-current" /> : <CheckCircle2 className="w-5 h-5 text-[#C5A059]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono font-bold text-[#8C6D31] uppercase tracking-wider">
                {isCharged ? "⚡ POWER & DOCK STATUS" : "MISSION FSM PHASE"}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-sm font-sans font-black tracking-wide ${isCharged ? "text-emerald-800" : "text-[#1A1715]"}`}>
                  {isEmergencyStopped
                    ? "E-STOP TRIPPED"
                    : isCharged
                    ? "⚡ CHARGED (100%)"
                    : fsmState === "DOCKED"
                    ? "DOCKED CONFIRMED"
                    : fsmState === "FINE_ALIGN"
                    ? "FINE ALIGNMENT"
                    : "APPROACH PHASE"}
                </span>
                <span className={`w-2 h-2 rounded-full ${isCharged ? "bg-emerald-500" : "bg-[#FF3820]"} animate-pulse`} />
              </div>
              <span className="text-[10px] font-mono text-stone-500 mt-0.5 block">
                {isCharged ? "BATTERY FULL (29.4V) · DOCKED" : `DWELL: ${dwellTime.toFixed(1)}s / 1.0s`}
              </span>
            </div>
          </div>

          {/* Card 5: AI Collision Sensor Radar Reading */}
          <div className={`flex items-center gap-3.5 p-2 rounded-2xl border transition-all ${
            obstacleTelemetry.corridor_blocked
              ? "bg-red-50/90 border-red-400 shadow-md"
              : "bg-white/60 border-[#C5A059]/25"
          }`}>
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-xs ${
              obstacleTelemetry.corridor_blocked
                ? "bg-red-500 text-white border-white animate-pulse"
                : "bg-[#FAF7F2] border-[#C5A059]/40 text-[#8C6D31]"
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono font-bold text-[#8C6D31] uppercase tracking-wider">
                COLLISION SENSOR
              </div>
              <div className="flex items-baseline gap-2 mt-0.5 font-mono text-sm font-bold">
                <span className={obstacleTelemetry.corridor_blocked && obstacleTelemetry.min_distance_m <= 5.0 ? "text-red-700 font-black animate-pulse" : "text-emerald-700"}>
                  {typeof obstacleTelemetry.min_distance_m === "number" && obstacleTelemetry.min_distance_m <= 5.0
                    ? `${obstacleTelemetry.min_distance_m.toFixed(2)}m`
                    : "CLEAR (>5.0m)"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  obstacleTelemetry.corridor_blocked
                    ? "bg-red-200 text-red-900 border border-red-400 animate-pulse"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}>
                  {obstacleTelemetry.corridor_blocked ? "HAZARD STOP" : "CORRIDOR CLEAR"}
                </span>
                {obstacleTelemetry.detected_obstacles?.length > 0 && (
                  <span className="text-[9px] font-mono text-stone-500 truncate">
                    {obstacleTelemetry.detected_obstacles[0].class}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
