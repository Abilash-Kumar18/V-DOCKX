"use client";

import { useState, useEffect, useCallback } from "react";
import {
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
  const [controlMode, setControlMode] = useState("autonomous"); // 'autonomous' | 'manual'
  const [teleopSpeed, setTeleopSpeed] = useState("normal"); // 'precise' | 'normal' | 'fast'
  const [activeKey, setActiveKey] = useState(null);
  const [isDocking, setIsDocking] = useState(false);
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [fsmState, setFsmState] = useState("APPROACH"); // 'LINE_FOLLOW' | 'APPROACH' | 'FINE_ALIGN' | 'DOCKED' | 'STOP'
  const [dwellTime, setDwellTime] = useState(0.0);
  const [activeView, setActiveView] = useState("diptych"); // 'diptych' | 'hud' | 'arena'
  const [showTeleopPanel, setShowTeleopPanel] = useState(false);

  // Live Phone Camera & Mobile GPS State
  const [phoneFrame, setPhoneFrame] = useState(null);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [mobileGpsPose, setMobileGpsPose] = useState(null);
  const [mobileMotion, setMobileMotion] = useState(null);
  const [destinationPoint, setDestinationPoint] = useState({ x: 1.0, y: 0.35 });
  const [batteryLevel, setBatteryLevel] = useState(84);
  const [isChargingActive, setIsChargingActive] = useState(false);

  const handleDestinationChange = (newDest) => {
    setDestinationPoint(newDest);
    try {
      fetch("/api/camera/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: newDest }),
      }).catch(() => {});
    } catch (_) {}
  };

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
            if (data.motion) {
              setMobileMotion(data.motion);
            }
            if (data.pose && typeof data.pose.x === "number" && typeof data.pose.y === "number") {
              setMobileGpsPose(data.pose);
              // Moving mobile phone moves the GPS marker on the 2D map in real time!
              setRobotPose((prev) => ({
                x: Number(data.pose.x.toFixed(3)),
                y: Number(data.pose.y.toFixed(3)),
                theta: typeof data.pose.heading === "number" ? Math.round(data.pose.heading) : prev.theta,
              }));
            }

            // Forward real frame to FastAPI OpenCV Vision Backend
            if (data.frame) {
              try {
                fetch("http://localhost:8000/api/vision/process", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    frame_b64: data.frame,
                    robot_pose: data.pose,
                    motion: data.motion,
                  }),
                })
                  .then((r) => r.json())
                  .then((res) => {
                    if (res && res.state) setFsmState(res.state);
                    if (res && res.is_docked) setIsChargingActive(true);
                  })
                  .catch(() => {});
              } catch (_) {}
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
  const powerStationPos = destinationPoint;
  const dx = robotPose.x - powerStationPos.x;
  const dy = robotPose.y - powerStationPos.y;
  const distanceM = Math.sqrt(dx * dx + dy * dy);
  const lateralOffsetM = dx;
  const targetHeadingDeg = (Math.atan2(-dy, -dx) * 180) / Math.PI;
  const headingErrorDeg = Math.round(robotPose.theta - targetHeadingDeg);

  // Battery charging simulation loop when docked
  useEffect(() => {
    if (isChargingActive || distanceM <= 0.25) {
      if (!isChargingActive) setIsChargingActive(true);
      const chargeTimer = setInterval(() => {
        setBatteryLevel((b) => Math.min(100, b + 1));
      }, 1000);
      return () => clearInterval(chargeTimer);
    }
  }, [isChargingActive, distanceM]);

  // 6-DOF Simulated Rotational & Elevation Perturbations
  const pitchDeg = Number((Math.sin(Date.now() / 600) * 0.4).toFixed(2));
  const rollDeg = Number((Math.cos(Date.now() / 500) * 0.25).toFixed(2));
  const elevationZ = 0.0; // Flat arena surface normal

  // Step sizing according to speed setting
  const speedStep = teleopSpeed === "precise" ? 0.012 : teleopSpeed === "fast" ? 0.045 : 0.025;
  const rotStep = teleopSpeed === "precise" ? 2.5 : teleopSpeed === "fast" ? 8 : 5;

  // Manual Movement Dispatcher
  const moveManual = useCallback(
    (action) => {
      if (isEmergencyStopped) return;
      setIsDocking(false);
      setControlMode("manual");

      setRobotPose((prev) => {
        let { x, y, theta } = prev;
        const rad = (theta * Math.PI) / 180;

        switch (action) {
          case "forward":
            x += Math.cos(rad) * speedStep;
            y += Math.sin(rad) * speedStep;
            break;
          case "backward":
            x -= Math.cos(rad) * speedStep;
            y -= Math.sin(rad) * speedStep;
            break;
          case "left":
            theta = (theta - rotStep + 360) % 360;
            if (theta > 180) theta -= 360;
            break;
          case "right":
            theta = (theta + rotStep + 360) % 360;
            if (theta > 180) theta -= 360;
            break;
          case "stop":
            return prev;
          default:
            break;
        }

        // Keep inside 2m x 2m arena boundaries
        const clampedX = Math.max(0.1, Math.min(1.9, Number(x.toFixed(3))));
        const clampedY = Math.max(0.35, Math.min(1.9, Number(y.toFixed(3))));
        const clampedTheta = Math.round(theta);

        // Check if manual alignment reached dock port
        const remaining = Math.sqrt((clampedX - powerStationPos.x) ** 2 + (clampedY - powerStationPos.y) ** 2);
        if (remaining <= 0.15 && Math.abs(clampedTheta - -90) <= 6) {
          setFsmState("DOCKED");
        } else if (remaining <= 0.4) {
          setFsmState("FINE_ALIGN");
        } else {
          setFsmState("APPROACH");
        }

        return { x: clampedX, y: clampedY, theta: clampedTheta };
      });
    },
    [speedStep, rotStep, isEmergencyStopped]
  );

  // Global Keyboard Listener for Teleoperation (W, A, S, D & Arrows)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Avoid firing if typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      let keyAct = null;
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        keyAct = "forward";
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        keyAct = "backward";
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        keyAct = "left";
      } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        keyAct = "right";
      } else if (e.key === " ") {
        keyAct = "stop";
        e.preventDefault();
      }

      if (keyAct) {
        setActiveKey(keyAct);
        moveManual(keyAct);
      }
    };

    const handleKeyUp = () => {
      setActiveKey(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [moveManual]);

  // Autonomous Docking Simulation Loop
  useEffect(() => {
    if (!isDocking || isEmergencyStopped || controlMode !== "autonomous") return;

    const interval = setInterval(() => {
      setRobotPose((prev) => {
        const remainingDist = Math.sqrt(
          (prev.x - powerStationPos.x) ** 2 + (prev.y - powerStationPos.y) ** 2
        );

        // If docked within tolerance
        if (remainingDist <= 0.14) {
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
  }, [isDocking, isEmergencyStopped, controlMode]);

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
    setControlMode("autonomous");
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
                MOBILE GPS {mobileGpsPose?.lat ? `[${mobileGpsPose.lat.toFixed(4)}°, ${mobileGpsPose.lng.toFixed(4)}°]` : "[SYNCED]"}
              </span>
            </div>
          )}

          {/* Autonomous Dock Toggle Button */}
          {!isDocking ? (
            <button
              type="button"
              onClick={() => {
                setControlMode("autonomous");
                setIsDocking(true);
                setIsEmergencyStopped(false);
              }}
              className="btn-vermillion px-6 py-2 text-xs gap-2 font-sans font-bold uppercase tracking-wider shadow-md cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Autonomous Docking</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsDocking(false)}
              className="px-5 py-2 rounded-full bg-white border-2 border-[#C5A059] text-[#1A1715] text-xs font-sans font-bold hover:bg-[#FAF7F2] transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-current text-[#8C6D31]" />
              <span>Pause Motion</span>
            </button>
          )}

          {/* Manual Teleoperation Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsDocking(false);
              setControlMode((m) => (m === "manual" ? "autonomous" : "manual"));
              setShowTeleopPanel((s) => !s);
            }}
            className={`px-4 py-2 rounded-full text-xs font-sans font-bold transition-all flex items-center gap-2 cursor-pointer ${
              controlMode === "manual"
                ? "bg-[#1A1715] text-white border-2 border-[#C5A059] shadow-md"
                : "bg-white border border-[#C5A059]/40 text-stone-700 hover:bg-[#FAF7F2]"
            }`}
          >
            <Gamepad2 className="w-4 h-4 text-[#FF3820]" />
            <span>{controlMode === "manual" ? "Teleop Active" : "Manual Teleop"}</span>
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
        {/* Floating Manual Teleoperation Controller Overlay (Drawer / HUD) */}
        {(controlMode === "manual" || showTeleopPanel) && (
          <div className="absolute top-3 right-3 z-30 bg-white/95 backdrop-blur-xl border-2 border-[#C5A059]/50 rounded-3xl p-4 shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-[#FF3820]" />
                <span className="text-xs font-bold font-sans text-stone-900">Manual Pilot (WASD)</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                LIVE TELEOP
              </span>
            </div>

            {/* Directional Pad */}
            <div className="flex flex-col items-center gap-1.5 my-2">
              {/* Up */}
              <button
                type="button"
                onClick={() => moveManual("forward")}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm border transition-all cursor-pointer ${
                  activeKey === "forward"
                    ? "bg-[#FF3820] text-white border-[#FF3820] scale-95 shadow-md"
                    : "bg-[#FAF7F2] border-[#C5A059]/40 text-stone-800 hover:bg-white hover:border-[#FF3820]"
                }`}
                title="Forward (W / Up Arrow)"
              >
                <ArrowUp className="w-5 h-5" />
              </button>

              {/* Middle Row: Left, Stop, Right */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => moveManual("left")}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm border transition-all cursor-pointer ${
                    activeKey === "left"
                      ? "bg-[#FF3820] text-white border-[#FF3820] scale-95 shadow-md"
                      : "bg-[#FAF7F2] border-[#C5A059]/40 text-stone-800 hover:bg-white hover:border-[#FF3820]"
                  }`}
                  title="Rotate CCW (A / Left Arrow)"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => moveManual("stop")}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm border transition-all cursor-pointer ${
                    activeKey === "stop"
                      ? "bg-red-600 text-white border-red-600 scale-95"
                      : "bg-red-50 border-red-200 text-[#FF3820] hover:bg-red-100"
                  }`}
                  title="Brake / Stop (Spacebar)"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => moveManual("right")}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm border transition-all cursor-pointer ${
                    activeKey === "right"
                      ? "bg-[#FF3820] text-white border-[#FF3820] scale-95 shadow-md"
                      : "bg-[#FAF7F2] border-[#C5A059]/40 text-stone-800 hover:bg-white hover:border-[#FF3820]"
                  }`}
                  title="Rotate CW (D / Right Arrow)"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Down */}
              <button
                type="button"
                onClick={() => moveManual("backward")}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm border transition-all cursor-pointer ${
                  activeKey === "backward"
                    ? "bg-[#FF3820] text-white border-[#FF3820] scale-95 shadow-md"
                    : "bg-[#FAF7F2] border-[#C5A059]/40 text-stone-800 hover:bg-white hover:border-[#FF3820]"
                }`}
                title="Reverse (S / Down Arrow)"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
            </div>

            {/* Speed Throttling */}
            <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-1 text-[10px] font-mono">
              <span className="text-stone-500 font-bold">SPEED:</span>
              <div className="flex items-center gap-1 bg-[#FAF7F2] p-0.5 rounded-full border border-stone-200">
                {["precise", "normal", "fast"].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setTeleopSpeed(sp)}
                    className={`px-2 py-0.5 rounded-full capitalize font-bold transition-all cursor-pointer ${
                      teleopSpeed === sp
                        ? "bg-[#FF3820] text-white shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {sp === "precise" ? "0.5x" : sp === "normal" ? "1.0x" : "2.0x"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Docked & Rapid DC Charging Alert Banner */}
        {(distanceM <= 0.25 || isChargingActive) && (
          <div className="mb-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-between text-white animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(16,185,129,0.9)] animate-pulse">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-emerald-400 tracking-wide uppercase">
                    ⚡ ROBOT DOCKED & RAPID DC CHARGING ACTIVE
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/40">
                    TERMINAL LOCKED
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80 font-mono mt-0.5">
                  Proximity: {(distanceM * 100).toFixed(0)}cm | Rate: 48.4V • 24.2A Rapid DC | Target Battery: 100%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <div className="text-right">
                <span className="text-xs text-emerald-300/80 block uppercase">Battery State</span>
                <span className="text-xl font-black text-white">{batteryLevel}%</span>
              </div>
              <div className="w-20 h-3 rounded-full bg-emerald-950 border border-emerald-500/50 p-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-500"
                  style={{ width: `${batteryLevel}%` }}
                />
              </div>
            </div>
          </div>
        )}

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
            />
            <DockingMap2D
              robotPose={robotPose}
              onRobotMove={(newPose) => setRobotPose(newPose)}
              isDocking={isDocking}
              mobileGpsPose={mobileGpsPose}
              mobileMotion={mobileMotion}
              isPhoneConnected={isPhoneConnected}
              destinationPoint={destinationPoint}
              onDestinationChange={handleDestinationChange}
              isCharging={distanceM <= 0.25 || isChargingActive}
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
            />
          </div>
        )}

        {activeView === "arena" && (
          <div className="w-full h-[500px] lg:h-[580px]">
            <DockingMap2D
              robotPose={robotPose}
              onRobotMove={(newPose) => setRobotPose(newPose)}
              isDocking={isDocking}
              mobileGpsPose={mobileGpsPose}
              mobileMotion={mobileMotion}
              isPhoneConnected={isPhoneConnected}
              destinationPoint={destinationPoint}
              onDestinationChange={handleDestinationChange}
              isCharging={distanceM <= 0.25 || isChargingActive}
            />
          </div>
        )}
      </main>

      {/* ============================================================
          3. 6-DOF APRILTAG ALIGNMENT HUD & TELEMETRY BAR
          ============================================================ */}
      <footer className="frame-gilded p-4 sm:p-5 shadow-lg backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
          
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
                    distanceM <= 0.25 || isChargingActive || fsmState === "DOCKED"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-400 font-black"
                      : isLateralWithinTol && isHeadingWithinTol
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-[#FF3820]/10 text-[#FF3820] border border-[#FF3820]/30"
                  }`}
                >
                  {distanceM <= 0.25 || isChargingActive || fsmState === "DOCKED"
                    ? "LOCKED IN GATE (±2CM)"
                    : isLateralWithinTol && isHeadingWithinTol
                    ? "IN TOLERANCE (±2CM)"
                    : "CALIBRATING"}
                </span>
              </div>
              <span className="text-[10px] font-mono text-stone-500 mt-1 block">
                HOMOGRAPHY: 6-DOF LOCKED
              </span>
            </div>
          </div>

          {/* Card 4: FSM Operational Phase */}
          <div className="flex items-center gap-3.5 p-2 rounded-2xl bg-white/60 border border-[#C5A059]/25">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-xs ${
              distanceM <= 0.25 || isChargingActive || fsmState === "DOCKED"
                ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                : "bg-[#FAF7F2] border-[#C5A059]/40 text-[#8C6D31]"
            }`}>
              {distanceM <= 0.25 || isChargingActive || fsmState === "DOCKED" ? (
                <Zap className="w-5 h-5 text-emerald-600 animate-bounce" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#C5A059]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono font-bold text-[#8C6D31] uppercase tracking-wider">
                MISSION FSM PHASE
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-sans font-black tracking-wide text-[#1A1715]">
                  {isEmergencyStopped ? (
                    "E-STOP TRIPPED"
                  ) : distanceM <= 0.25 || isChargingActive || fsmState === "DOCKED" ? (
                    <span className="text-emerald-700 flex items-center gap-1.5">
                      <span>CHARGING ACTIVE ⚡</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {batteryLevel}%
                      </span>
                    </span>
                  ) : controlMode === "manual" ? (
                    "MANUAL PILOT"
                  ) : fsmState === "OBSTACLE_STOP" ? (
                    <span className="text-red-600">OBSTACLE STOP</span>
                  ) : fsmState === "FINE_ALIGN" ? (
                    "FINE ALIGNMENT"
                  ) : (
                    "APPROACH PHASE"
                  )}
                </span>
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  distanceM <= 0.25 || isChargingActive ? "bg-emerald-500" : "bg-[#FF3820]"
                }`} />
              </div>
              <span className="text-[10px] font-mono text-stone-500 mt-0.5 block">
                {distanceM <= 0.25 || isChargingActive
                  ? `CHARGING DOCK DWELL: COMPLETE`
                  : `DWELL: ${dwellTime.toFixed(1)}s / 1.0s`}
              </span>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
