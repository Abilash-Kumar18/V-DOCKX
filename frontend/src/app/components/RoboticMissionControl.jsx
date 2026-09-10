"use client";

import { useState, useEffect } from "react";
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

  // Derived Telemetry Metrics
  const powerStationPos = { x: 1.0, y: 0.35 };
  const dx = robotPose.x - powerStationPos.x;
  const dy = robotPose.y - powerStationPos.y;
  const distanceM = Math.sqrt(dx * dx + dy * dy);
  const lateralOffsetM = dx;
  const targetHeadingDeg = (Math.atan2(-dy, -dx) * 180) / Math.PI;
  const headingErrorDeg = Math.round(robotPose.theta - targetHeadingDeg);

  // Autonomous Docking Simulation Loop
  useEffect(() => {
    if (!isDocking || isEmergencyStopped) return;

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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none">
      {/* 1. Header Navigation Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/90 mb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                V-DOCKX Mission Control
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                  isEmergencyStopped
                    ? "bg-red-50 border-red-200 text-red-700 animate-pulse"
                    : fsmState === "DOCKED"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : fsmState === "FINE_ALIGN"
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}
              >
                {isEmergencyStopped ? "E-STOP ACTIVATED" : fsmState}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Vision-Guided Closed-Loop Autonomous Ground Robot Docking System
            </p>
          </div>
        </div>

        {/* Action Controls & Operator Session */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Start / Pause Autonomous Docking */}
          {!isDocking ? (
            <button
              type="button"
              onClick={() => {
                setIsDocking(true);
                setIsEmergencyStopped(false);
              }}
              className="btn-primary px-4 py-2 text-xs gap-2 font-bold shadow-md shadow-blue-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Autonomous Docking</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsDocking(false)}
              className="px-4 py-2 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause Motion</span>
            </button>
          )}

          {/* Reset Arena Button */}
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            title="Reset Arena and Robot Pose"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* E-STOP Button */}
          <button
            type="button"
            onClick={handleToggleEStop}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              isEmergencyStopped
                ? "bg-red-600 text-white shadow-md animate-pulse"
                : "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{isEmergencyStopped ? "CLEAR E-STOP" : "E-STOP"}</span>
          </button>

          {/* Operator Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              {user?.avatar || "OP"}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Dual Viewport Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 mb-4">
        {/* Viewport 1: Live Phone Camera / Robotic Vision HUD */}
        <div className="h-[420px] lg:h-[500px]">
          <RoboticCameraHUD
            distanceM={distanceM}
            lateralOffsetM={lateralOffsetM}
            headingErrorDeg={headingErrorDeg}
            isDocking={isDocking}
          />
        </div>

        {/* Viewport 2: Interactive 2D Map with Blinking Power Station */}
        <div className="h-[420px] lg:h-[500px]">
          <DockingMap2D
            robotPose={robotPose}
            onRobotMove={(newPose) => setRobotPose(newPose)}
            isDocking={isDocking}
          />
        </div>
      </main>

      {/* 3. Bottom Telemetry Gauges & Tolerance Checklist */}
      <footer className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Forward Distance */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Distance (e_d)</span>
            <ArrowDownCircle className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {distanceM.toFixed(3)} <span className="text-xs font-normal text-slate-500">m</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(10, (distanceM / 1.8) * 100))}%` }}
            />
          </div>
        </div>

        {/* Lateral Offset */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Lateral (e_y)</span>
            <Sliders className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {(lateralOffsetM * 100).toFixed(1)}{" "}
            <span className="text-xs font-normal text-slate-500">cm</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex justify-between font-mono">
            <span>-3cm</span>
            <span className="text-emerald-600 font-bold">0</span>
            <span>+3cm</span>
          </div>
        </div>

        {/* Heading Error */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Heading (&theta;)</span>
            <Compass className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {headingErrorDeg > 0 ? `+${headingErrorDeg}` : headingErrorDeg}°
          </div>
          <div className="mt-2 text-[10px] text-slate-500 font-mono">
            Tolerance: &le; &plusmn;5°
          </div>
        </div>

        {/* Linear & Angular Velocity */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Command (v, &omega;)</span>
            <Gauge className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-lg font-mono font-bold text-slate-900">
            {isDocking ? "0.08" : "0.00"}{" "}
            <span className="text-xs font-normal text-slate-500">m/s</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-slate-500">
            &omega;: {isDocking ? "-0.12 rad/s" : "0.00 rad/s"}
          </div>
        </div>

        {/* Dwell Verification Gate */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Dwell Gate</span>
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-mono font-bold text-slate-900">
            {dwellTime.toFixed(1)}s{" "}
            <span className="text-xs font-normal text-slate-500">/ 1.0s</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (dwellTime / 1.0) * 100)}%` }}
            />
          </div>
        </div>

        {/* Docking Verification Result */}
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Docking Gate</span>
            <CheckCircle2
              className={`w-4 h-4 ${
                fsmState === "DOCKED" ? "text-emerald-500" : "text-slate-300"
              }`}
            />
          </div>
          <div
            className={`text-sm font-bold font-mono ${
              fsmState === "DOCKED" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {fsmState === "DOCKED" ? "DOCKED CONFIRMED" : "IN APPROACH"}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            Bay ID: #01 Verified
          </div>
        </div>
      </footer>
    </div>
  );
}
