"use client";

import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Play,
  Square,
  RefreshCw,
  Sliders,
  Shield,
  ShieldAlert,
  Gauge,
  Compass,
  Cpu,
  Activity,
  ArrowDownCircle,
  Download,
  Terminal,
  LogOut,
  Camera,
  CheckCircle2,
  Clock,
  Radio,
} from "lucide-react";
import OrganicSphere from "./OrganicSphere";

export default function TelemetryHUD({ user, onLogout }) {
  // State Machine States: 'STANDBY', 'LINE_FOLLOW', 'APPROACH', 'FINE_ALIGN', 'OBSTACLE_STOP', 'DOCKED'
  const [fsmState, setFsmState] = useState("FINE_ALIGN");
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [isSimulatingObstacle, setIsSimulatingObstacle] = useState(false);
  const [isDockingActive, setIsDockingActive] = useState(true);

  // Telemetry Metrics
  const [distanceM, setDistanceM] = useState(0.245);
  const [lateralOffsetM, setLateralOffsetM] = useState(0.018);
  const [headingErrorDeg, setHeadingErrorDeg] = useState(-2.4);
  const [linearVelMps, setLinearVelMps] = useState(0.08);
  const [angularVelRps, setAngularVelRps] = useState(-0.12);
  const [dwellTimeSec, setDwellTimeSec] = useState(0.65);
  const [batteryPct, setBatteryPct] = useState(84);
  const [latencyMs, setLatencyMs] = useState(41);
  const [fps, setFps] = useState(30);

  // Telemetry Log Feed
  const [logs, setLogs] = useState([
    { ts: "20:25:01.120", state: "APPROACH", msg: "AprilTag ID 0 detected at range 0.72m" },
    { ts: "20:25:02.450", state: "APPROACH", msg: "Corridor clear: depth scan 1.84m safe" },
    { ts: "20:25:03.910", state: "FINE_ALIGN", msg: "Switched to closed-loop visual servoing" },
    { ts: "20:25:05.105", state: "FINE_ALIGN", msg: "Lateral offset within +/- 2.5cm target gate" },
  ]);

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const tickRef = useRef(0);

  // Simulation & HUD Render Loop
  useEffect(() => {
    let t = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const renderLoop = () => {
      t += 0.05;
      tickRef.current++;

      // Canvas dimensions
      const w = canvas.width;
      const h = canvas.height;

      // Clear dark camera background
      ctx.fillStyle = "#0a0c0f";
      ctx.fillRect(0, 0, w, h);

      // 1. Draw Simulated Perspective Ground Floor & Docking Line
      const horizonY = h * 0.38;
      const bottomY = h;
      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, bottomY);
      floorGrad.addColorStop(0, "#111419");
      floorGrad.addColorStop(1, "#181d24");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, w, bottomY - horizonY);

      // Floor grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let gx = -3; gx <= 3; gx++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + gx * 25, horizonY);
        ctx.lineTo(w / 2 + gx * 110, bottomY);
        ctx.stroke();
      }

      // 2. High-Contrast Guide Line (Floor Tape)
      const lineCenterX = w / 2 + (lateralOffsetM * 650);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(w / 2 + (lateralOffsetM * 180), horizonY + 20);
      ctx.lineTo(lineCenterX, bottomY);
      ctx.stroke();

      // Line Center Indicator (Cyan Guideline)
      ctx.strokeStyle = "rgba(0, 210, 230, 0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(w / 2, horizonY);
      ctx.lineTo(lineCenterX, bottomY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Safety Corridor Polygon (Trapezoid)
      const topW = 90;
      const bottomW = 320;
      const corridorBlocked = isSimulatingObstacle || isEmergencyStopped;

      ctx.beginPath();
      ctx.moveTo(w / 2 - topW / 2, horizonY + 15);
      ctx.lineTo(w / 2 + topW / 2, horizonY + 15);
      ctx.lineTo(w / 2 + bottomW / 2, bottomY);
      ctx.lineTo(w / 2 - bottomW / 2, bottomY);
      ctx.closePath();

      if (corridorBlocked) {
        // Red obstacle warning
        ctx.fillStyle = "rgba(220, 50, 50, 0.16)";
        ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 2.5;
      } else {
        // Clear path - calm muted green
        ctx.fillStyle = "rgba(80, 160, 90, 0.10)";
        ctx.strokeStyle = "rgba(120, 190, 100, 0.55)";
        ctx.lineWidth = 1.5;
      }
      ctx.fill();
      ctx.stroke();

      // 4. Station Marker / AprilTag at Docking Bay
      const tagScale = Math.max(0.35, 1 - distanceM * 0.45);
      const tagW = 75 * tagScale;
      const tagH = 75 * tagScale;
      const tagX = w / 2 - tagW / 2 + (lateralOffsetM * 300);
      const tagY = horizonY - tagH * 0.65;

      // Station docking frame
      ctx.strokeStyle = "rgba(180, 215, 80, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(tagX, tagY, tagW, tagH);

      // Station Target Reticle / 3D Axes
      const markerCenterX = tagX + tagW / 2;
      const markerCenterY = tagY + tagH / 2;

      // X-Axis (Red)
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(markerCenterX, markerCenterY);
      ctx.lineTo(markerCenterX + tagW * 0.6, markerCenterY);
      ctx.stroke();

      // Y-Axis (Green)
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(markerCenterX, markerCenterY);
      ctx.lineTo(markerCenterX, markerCenterY - tagH * 0.6);
      ctx.stroke();

      // Z-Axis (Blue)
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(markerCenterX, markerCenterY);
      ctx.lineTo(markerCenterX - tagW * 0.35, markerCenterY + tagH * 0.35);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#cde655";
      ctx.font = "10px monospace";
      ctx.fillText(
        `BAY_01 [d: ${distanceM.toFixed(2)}m]`,
        tagX - 10,
        tagY - 8
      );

      // 5. Line Centroid Crosshair (Cyan)
      const chX = lineCenterX;
      const chY = bottomY - 65;
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(chX, chY, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(chX - 22, chY);
      ctx.lineTo(chX + 22, chY);
      ctx.moveTo(chX, chY - 22);
      ctx.lineTo(chX, chY + 22);
      ctx.stroke();

      ctx.fillStyle = "#00e5ff";
      ctx.font = "9px monospace";
      ctx.fillText(`e_c: ${(lateralOffsetM * 100).toFixed(1)}cm`, chX + 18, chY - 4);

      // 6. Obstacle Intrusion Rendering (if simulated)
      if (corridorBlocked) {
        const obsW = 100;
        const obsH = 70;
        const obsX = w / 2 - obsW / 2 + 15;
        const obsY = h * 0.58;

        // Bounding Box
        ctx.strokeStyle = "#f87171";
        ctx.lineWidth = 2;
        ctx.strokeRect(obsX, obsY, obsW, obsH);

        // Warning Badge
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(obsX, obsY - 18, obsW, 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText("HAZARD: BOX 91%", obsX + 6, obsY - 5);

        // Intrusion Banner
        ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
        ctx.fillRect(w / 2 - 130, h * 0.12, 260, 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CORRIDOR INTRUSION - SAFETY HALT", w / 2, h * 0.12 + 18);
        ctx.textAlign = "left";
      }

      // Subtle Scanline HUD grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // HUD Telemetry Metadata Stamp
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "10px monospace";
      ctx.fillText(`CAM_01 [RGB 1280x720@30FPS]`, 14, 22);
      ctx.fillText(`LATENCY: ${latencyMs}ms | CONF: 94.2%`, 14, 38);

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [lateralOffsetM, distanceM, isSimulatingObstacle, isEmergencyStopped, latencyMs]);

  // Live dynamic telemetry simulation updates
  useEffect(() => {
    if (!isDockingActive || isEmergencyStopped || isSimulatingObstacle) return;

    const interval = setInterval(() => {
      // Approach towards 0.12m
      setDistanceM((prev) => {
        if (prev <= 0.125) {
          setFsmState("DOCKED");
          return 0.12;
        }
        const next = Math.max(0.12, prev - 0.005);
        if (next < 0.3) setFsmState("FINE_ALIGN");
        return next;
      });

      // Small jitter around 0 lateral offset
      setLateralOffsetM((prev) => {
        const jitter = (Math.random() - 0.5) * 0.003;
        return Number((prev * 0.95 + jitter).toFixed(3));
      });

      // Heading error converges
      setHeadingErrorDeg((prev) => {
        const delta = (Math.random() - 0.5) * 0.4;
        return Number((prev * 0.92 + delta).toFixed(1));
      });

      // Dwell timer
      setDwellTimeSec((prev) => Math.min(1.0, prev + 0.02));

      // Occasional log entry
      if (Math.random() > 0.85) {
        const now = new Date().toISOString().split("T")[1].slice(0, 12);
        setLogs((prev) => [
          {
            ts: now,
            state: fsmState,
            msg: `Telemetry tick: d=${distanceM.toFixed(3)}m, e_y=${(lateralOffsetM * 100).toFixed(1)}cm`,
          },
          ...prev.slice(0, 15),
        ]);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isDockingActive, isEmergencyStopped, isSimulatingObstacle, distanceM, lateralOffsetM, fsmState]);

  // Emergency Stop Handler
  const handleToggleEStop = () => {
    if (!isEmergencyStopped) {
      setIsEmergencyStopped(true);
      setFsmState("OBSTACLE_STOP");
      setLinearVelMps(0.0);
      setAngularVelRps(0.0);
      setLogs((prev) => [
        {
          ts: new Date().toISOString().split("T")[1].slice(0, 12),
          state: "OBSTACLE_STOP",
          msg: "EMERGENCY STOP (E-STOP) COMMANDED - ZERO VELOCITY LATCHED",
        },
        ...prev,
      ]);
    } else {
      setIsEmergencyStopped(false);
      setFsmState("FINE_ALIGN");
      setLinearVelMps(0.08);
      setAngularVelRps(-0.12);
      setLogs((prev) => [
        {
          ts: new Date().toISOString().split("T")[1].slice(0, 12),
          state: "FINE_ALIGN",
          msg: "E-STOP Cleared. Resuming closed-loop autonomous docking.",
        },
        ...prev,
      ]);
    }
  };

  // Obstacle Intrusion Toggle Handler
  const handleToggleObstacle = () => {
    const next = !isSimulatingObstacle;
    setIsSimulatingObstacle(next);
    if (next) {
      setFsmState("OBSTACLE_STOP");
      setLinearVelMps(0.0);
      setLogs((prev) => [
        {
          ts: new Date().toISOString().split("T")[1].slice(0, 12),
          state: "OBSTACLE_STOP",
          msg: "Safety Corridor blocked by dynamic object [Box 91%]. Motion stopped.",
        },
        ...prev,
      ]);
    } else {
      setFsmState("FINE_ALIGN");
      setLinearVelMps(0.08);
      setLogs((prev) => [
        {
          ts: new Date().toISOString().split("T")[1].slice(0, 12),
          state: "FINE_ALIGN",
          msg: "Corridor cleared. 1.0s dwell passed, resuming trajectory.",
        },
        ...prev,
      ]);
    }
  };

  // Export JSONL
  const handleExportJsonl = () => {
    const jsonlData = logs
      .map((l) =>
        JSON.stringify({
          timestamp: l.ts,
          state: l.state,
          distance_m: distanceM,
          lateral_offset_m: lateralOffsetM,
          heading_error_deg: headingErrorDeg,
          message: l.msg,
        })
      )
      .join("\n");

    const blob = new Blob([jsonlData], { type: "application/jsonlines" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vdockx_telemetry_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset Run
  const handleResetRun = () => {
    setDistanceM(0.85);
    setLateralOffsetM(0.028);
    setHeadingErrorDeg(-3.8);
    setDwellTimeSec(0.0);
    setFsmState("APPROACH");
    setIsEmergencyStopped(false);
    setIsSimulatingObstacle(false);
    setIsDockingActive(true);
    setLinearVelMps(0.12);
    setAngularVelRps(-0.15);
  };

  // Badge Color calculation
  const getStateBadgeColor = () => {
    if (isEmergencyStopped || fsmState === "OBSTACLE_STOP") {
      return "bg-[#331416] border-[#6b252b] text-[#f87171]";
    }
    if (fsmState === "DOCKED") {
      return "bg-[#182618] border-[#2e5430] text-[#4ade80]";
    }
    if (fsmState === "FINE_ALIGN") {
      return "bg-[#272614] border-[#595521] text-[#fbbf24]";
    }
    return "bg-[#182012] border-[#374921] text-[#cde655]";
  };

  return (
    <div className="min-h-screen bg-[#0a0c0e] text-[#f0f2f5] flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none">
      {/* 1. Header Bar: System Brand, State Badge & Top Actions */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-[#12151b] border border-[#1f242e] mb-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center">
            <OrganicSphere size={36} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white">
                V-DOCKX HUD
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${getStateBadgeColor()}`}
              >
                {isEmergencyStopped ? "E-STOP LATCHED" : fsmState}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Closed-Loop Autonomous Robot Docking & Charging Cockpit
            </p>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Obstacle Injection Toggle */}
          <button
            onClick={handleToggleObstacle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              isSimulatingObstacle
                ? "bg-[#381619] border-[#7d2c33] text-[#f87171]"
                : "bg-[#171b22] border-[#29313d] text-zinc-300 hover:bg-[#1f242e]"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isSimulatingObstacle ? "Obstacle Present" : "Inject Obstacle"}</span>
          </button>

          {/* Reset Run */}
          <button
            onClick={handleResetRun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#171b22] border border-[#29313d] text-zinc-300 hover:text-white text-xs font-semibold hover:bg-[#1f242e] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restart Run</span>
          </button>

          {/* E-STOP Button */}
          <button
            onClick={handleToggleEStop}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isEmergencyStopped
                ? "bg-[#ef4444] text-white shadow-md animate-pulse"
                : "bg-[#2e1518] border border-[#6b252b] text-[#f87171] hover:bg-[#421b20]"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{isEmergencyStopped ? "CLEAR E-STOP" : "E-STOP"}</span>
          </button>

          {/* Operator Profile Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161a22] border border-[#232a35] text-xs">
            <div className="w-6 h-6 rounded-full bg-[#1e2716] border border-[#3b4e23] text-[#cde655] font-bold flex items-center justify-center text-[10px]">
              {user?.avatar || "OP"}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-white font-medium text-[11px]">{user?.name || "Verified Operator"}</div>
              <div className="text-zinc-400 text-[10px]">{user?.role || "Telemetry Engineer"}</div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141820] border border-[#222834] text-zinc-400 hover:text-[#f87171] hover:border-[#421f24] text-xs transition-colors"
            title="Sign out of operator session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* 2. Main Cockpit Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Left 8 Columns: Live Camera HUD Viewport */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          {/* Camera Viewport Canvas */}
          <div className="relative rounded-2xl bg-[#0e1116] border border-[#1e232d] overflow-hidden shadow-xl aspect-[16/10] flex flex-col">
            {/* Top Canvas Bar */}
            <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-[#0a0c0f]/90 to-transparent">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80] animate-pulse" />
                <span className="text-xs font-mono font-medium text-zinc-300">
                  FORWARD_RGB_STREAM
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#161a22] text-zinc-400 font-mono">
                  CORRIDOR: {isSimulatingObstacle || isEmergencyStopped ? "BLOCKED" : "CLEAR"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                <span>LATENCY: {latencyMs}ms</span>
                <span>FPS: {fps}</span>
              </div>
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              className="w-full h-full object-cover"
            />

            {/* Bottom HUD Legend */}
            <div className="absolute bottom-0 inset-x-0 z-10 p-2.5 bg-gradient-to-t from-[#0a0c0f]/95 to-transparent flex items-center justify-between text-[11px] text-zinc-400 px-4">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#00e5ff]" />
                  Line Centroid (e_c)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#cde655]" />
                  Bay AprilTag Target
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-sm ${
                      isSimulatingObstacle || isEmergencyStopped
                        ? "bg-[#ef4444]"
                        : "bg-[#4ade80]"
                    }`}
                  />
                  Safety Corridor
                </span>
              </div>
              <span className="font-mono text-zinc-400">TOLERANCE: +/-3cm</span>
            </div>
          </div>

          {/* Quick Real-Time Gauges Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Forward Distance */}
            <div className="p-3.5 rounded-xl bg-[#12151b] border border-[#1f242e] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Distance (e_d)</span>
                <ArrowDownCircle className="w-3.5 h-3.5 text-[#cde655]" />
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {distanceM.toFixed(3)} <span className="text-xs font-normal text-zinc-400">m</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[#1b2029] overflow-hidden">
                <div
                  className="h-full bg-[#cde655] rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(8, (distanceM / 1.5) * 100))}%` }}
                />
              </div>
            </div>

            {/* Lateral Offset */}
            <div className="p-3.5 rounded-xl bg-[#12151b] border border-[#1f242e] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Lateral (e_y)</span>
                <Sliders className="w-3.5 h-3.5 text-[#00e5ff]" />
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {(lateralOffsetM * 100).toFixed(1)}{" "}
                <span className="text-xs font-normal text-zinc-400">cm</span>
              </div>
              <div className="mt-2 text-[10px] text-zinc-400 flex justify-between">
                <span>-3cm</span>
                <span className="text-[#4ade80]">0</span>
                <span>+3cm</span>
              </div>
            </div>

            {/* Heading Error */}
            <div className="p-3.5 rounded-xl bg-[#12151b] border border-[#1f242e] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Heading (&theta;)</span>
                <Compass className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {headingErrorDeg > 0 ? `+${headingErrorDeg}` : headingErrorDeg}°
              </div>
              <div className="mt-2 text-[10px] text-zinc-400">
                Gate: &le; &plusmn;5.0°
              </div>
            </div>

            {/* Velocity Commands */}
            <div className="p-3.5 rounded-xl bg-[#12151b] border border-[#1f242e] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Velocity [v, &omega;]</span>
                <Gauge className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="text-xl font-mono font-bold text-white">
                {linearVelMps.toFixed(2)}{" "}
                <span className="text-xs font-normal text-zinc-400">m/s</span>
              </div>
              <div className="mt-1 text-[11px] font-mono text-zinc-400">
                &omega;: {angularVelRps.toFixed(2)} rad/s
              </div>
            </div>
          </div>
        </section>

        {/* Right 4 Columns: System Status, Dwell Timer & JSONL Telemetry Stream */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          {/* Verification & Tolerances Card */}
          <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1f242e] shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
              <span>Docking Verification Gate</span>
              <CheckCircle2 className="w-4 h-4 text-[#cde655]" />
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#161a22]">
                <span className="text-zinc-300">Distance &le; 0.12m</span>
                <span
                  className={`font-mono font-semibold ${
                    distanceM <= 0.13 ? "text-[#4ade80]" : "text-zinc-400"
                  }`}
                >
                  {distanceM <= 0.13 ? "PASSED" : "PENDING"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#161a22]">
                <span className="text-zinc-300">Lateral Offset &le; &plusmn;3cm</span>
                <span
                  className={`font-mono font-semibold ${
                    Math.abs(lateralOffsetM) <= 0.03 ? "text-[#4ade80]" : "text-zinc-400"
                  }`}
                >
                  {Math.abs(lateralOffsetM) <= 0.03 ? "PASSED" : "PENDING"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#161a22]">
                <span className="text-zinc-300">Heading &le; &plusmn;5°</span>
                <span
                  className={`font-mono font-semibold ${
                    Math.abs(headingErrorDeg) <= 5.0 ? "text-[#4ade80]" : "text-zinc-400"
                  }`}
                >
                  {Math.abs(headingErrorDeg) <= 5.0 ? "PASSED" : "PENDING"}
                </span>
              </div>
            </div>

            {/* Dwell Timer Progress */}
            <div className="mt-4 pt-3 border-t border-[#1d222b]">
              <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Dwell Confirmation
                </span>
                <span className="font-mono text-[#cde655]">
                  {dwellTimeSec.toFixed(2)}s / 1.00s
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#1b2029] overflow-hidden">
                <div
                  className="h-full bg-[#cde655] rounded-full transition-all"
                  style={{ width: `${Math.min(100, (dwellTimeSec / 1.0) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Robot Hardware Health Card */}
          <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1f242e] shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
              <span>Robot Base Health</span>
              <Cpu className="w-4 h-4 text-zinc-400" />
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-[#161a22]">
                <div className="text-zinc-400 text-[11px]">Battery Level</div>
                <div className="text-lg font-mono font-bold text-white mt-0.5">
                  {batteryPct}%
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#161a22]">
                <div className="text-zinc-400 text-[11px]">Vision Mode</div>
                <div className="text-xs font-mono font-bold text-[#cde655] mt-1 truncate">
                  HYBRID LINE+TAG
                </div>
              </div>
            </div>
          </div>

          {/* Live Telemetry JSON Lines Stream */}
          <div className="p-4 rounded-2xl bg-[#12151b] border border-[#1f242e] shadow-lg flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#cde655]" />
                Telemetry Event Stream
              </h3>
              <button
                onClick={handleExportJsonl}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#cde655] hover:underline"
              >
                <Download className="w-3 h-3" />
                Export JSONL
              </button>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 p-2 rounded-xl bg-[#0c0e12] border border-[#1a1f27] max-h-56">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-tight text-zinc-300">
                  <span className="text-zinc-500">{log.ts}</span>{" "}
                  <span
                    className={
                      log.state === "OBSTACLE_STOP"
                        ? "text-[#f87171]"
                        : log.state === "DOCKED"
                        ? "text-[#4ade80]"
                        : "text-[#cde655]"
                    }
                  >
                    [{log.state}]
                  </span>{" "}
                  <span>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
