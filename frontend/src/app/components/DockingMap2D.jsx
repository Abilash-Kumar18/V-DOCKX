"use client";

import { useEffect, useRef, useState } from "react";
import { Zap, Navigation, MapPin, Compass, Play, RotateCcw } from "lucide-react";

export default function DockingMap2D({
  robotPose = { x: 0.5, y: 1.6, theta: -85 }, // meters and degrees
  onRobotMove,
  isDocking = false,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);

  // Power Station fixed position (in normalized meters)
  const powerStation = { x: 1.0, y: 0.25, width: 0.35, height: 0.15 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let t = 0;

    const render = () => {
      t += 0.035;

      const w = canvas.width;
      const h = canvas.height;

      // Coordinate scaling (meters to canvas pixels)
      // Arena size: 2.0m width x 2.0m height
      const scaleX = w / 2.0;
      const scaleY = h / 2.0;

      // 1. Clean porcelain light map background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      // 2. Subtle architectural floor grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
      const gridStepM = 0.25; // 25cm grid squares
      for (let x = 0; x <= 2.0; x += gridStepM) {
        ctx.beginPath();
        ctx.moveTo(x * scaleX, 0);
        ctx.lineTo(x * scaleX, h);
        ctx.stroke();
      }
      for (let y = 0; y <= 2.0; y += gridStepM) {
        ctx.beginPath();
        ctx.moveTo(0, y * scaleY);
        ctx.lineTo(w, y * scaleY);
        ctx.stroke();
      }

      // 3. High-contrast floor guide line (Floor path towards station)
      ctx.strokeStyle = "rgba(203, 213, 225, 0.9)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(1.0 * scaleX, 0.35 * scaleY);
      ctx.lineTo(1.0 * scaleX, 1.85 * scaleY);
      ctx.stroke();

      // Center guide dashed track
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(1.0 * scaleX, 0.35 * scaleY);
      ctx.lineTo(1.0 * scaleX, 1.85 * scaleY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Safety Clearance Corridor (Zone)
      ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo((1.0 - 0.25) * scaleX, 0.35 * scaleY);
      ctx.lineTo((1.0 + 0.25) * scaleX, 0.35 * scaleY);
      ctx.lineTo((1.0 + 0.45) * scaleX, 1.85 * scaleY);
      ctx.lineTo((1.0 - 0.45) * scaleX, 1.85 * scaleY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 5. Blinking Power Station / Charging Dock (Fixed Point)
      const psX = powerStation.x * scaleX;
      const psY = powerStation.y * scaleY;

      // Pulsing electromagnetic beacon light rings (blinking power light)
      const pulseCount = 3;
      for (let i = 0; i < pulseCount; i++) {
        const pRad = ((t * 22 + i * 20) % 55) + 8;
        const pAlpha = Math.max(0, 1 - pRad / 60);
        ctx.strokeStyle = `rgba(16, 185, 129, ${pAlpha * 0.75})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(psX, psY, pRad, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Power Station Mounting Base
      ctx.fillStyle = "#f1f5f9";
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 2;
      const psW = powerStation.width * scaleX;
      const psH = powerStation.height * scaleY;
      ctx.beginPath();
      ctx.roundRect(psX - psW / 2, psY - psH / 2, psW, psH, 6);
      ctx.fill();
      ctx.stroke();

      // Electrical Charging Contact Points
      ctx.fillStyle = "#eab308"; // Brass charging contacts
      ctx.fillRect(psX - 16, psY + psH / 2 - 3, 10, 5);
      ctx.fillRect(psX + 6, psY + psH / 2 - 3, 10, 5);

      // Power Station Center Blinking LED
      const ledGlow = Math.sin(t * 5) * 0.4 + 0.6;
      ctx.fillStyle = `rgba(16, 185, 129, ${ledGlow})`;
      ctx.beginPath();
      ctx.arc(psX, psY - 2, 6, 0, Math.PI * 2);
      ctx.fill();

      // Power Station Label
      ctx.fillStyle = "#065f46";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("⚡ POWER STATION", psX, psY - psH / 2 - 8);

      // 6. Path Trajectory connecting Robot to Power Station
      const robX = robotPose.x * scaleX;
      const robY = robotPose.y * scaleY;

      ctx.strokeStyle = "rgba(37, 99, 235, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(robX, robY);
      ctx.lineTo(psX, psY + psH / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 7. Robot Base (Dynamic Point)
      // Camera Vision Cone (Projected from Robot's front)
      const headingRad = (robotPose.theta * Math.PI) / 180;
      const fovAngle = 0.55; // ~32 degrees
      const viewDist = 0.55 * scaleY;

      const coneGrad = ctx.createRadialGradient(robX, robY, 5, robX, robY, viewDist);
      coneGrad.addColorStop(0, "rgba(6, 182, 212, 0.35)");
      coneGrad.addColorStop(0.7, "rgba(37, 99, 235, 0.12)");
      coneGrad.addColorStop(1, "rgba(37, 99, 235, 0)");

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(robX, robY);
      ctx.arc(robX, robY, viewDist, headingRad - fovAngle, headingRad + fovAngle);
      ctx.closePath();
      ctx.fill();

      // Robot Chassis (Circular mobile base)
      ctx.save();
      ctx.translate(robX, robY);
      ctx.rotate(headingRad);

      // Chassis Shadow & Body
      ctx.shadowColor = "rgba(15, 23, 42, 0.15)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Wheels
      ctx.fillStyle = "#334155";
      ctx.fillRect(-14, -22, 28, 5); // Top wheel
      ctx.fillRect(-14, 17, 28, 5);  // Bottom wheel

      // Forward Camera Sensor Glyph on Robot Front
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.arc(14, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      // Heading indicator line
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(22, 0);
      ctx.stroke();

      ctx.restore();

      // Robot Label & Live Coordinates Stamp
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("🤖 V-DOCKX ROBOT", robX, robY + 32);

      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      ctx.fillText(
        `X:${robotPose.x.toFixed(2)}m Y:${robotPose.y.toFixed(2)}m`,
        robX,
        robY + 44
      );

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [robotPose, isDocking]);

  // Click on map to move robot (manual target placement)
  const handleCanvasClick = (e) => {
    if (!onRobotMove || isDocking) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 2.0;
    const clickY = ((e.clientY - rect.top) / rect.height) * 2.0;

    // Calculate heading towards power station
    const dx = powerStation.x - clickX;
    const dy = powerStation.y - clickY;
    const thetaDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    onRobotMove({
      x: Math.max(0.2, Math.min(1.8, Number(clickX.toFixed(2)))),
      y: Math.max(0.5, Math.min(1.8, Number(clickY.toFixed(2)))),
      theta: Math.round(thetaDeg),
    });
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
      {/* 2D Map Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800 tracking-wide uppercase font-mono">
            2D Top-Down Navigation Arena
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Power Station
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            Robot Base
          </span>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative flex-1 min-h-[300px] w-full bg-white flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          onClick={handleCanvasClick}
          className="w-full h-full max-h-[460px] object-contain cursor-crosshair rounded-xl border border-slate-100"
          title="Click anywhere to reposition the robot"
        />

        {/* Floating Arena Scale Badge */}
        <div className="absolute bottom-4 left-4 px-2.5 py-1 rounded-md bg-white/90 border border-slate-200 text-[10px] font-mono text-slate-500 shadow-sm">
          Arena: 2.0m &times; 2.0m (Grid: 25cm)
        </div>

        {/* Click hint */}
        <div className="absolute top-4 right-4 px-2.5 py-1 rounded-md bg-blue-50/90 border border-blue-200 text-[10px] font-mono text-blue-700 shadow-sm">
          Click map to position robot
        </div>
      </div>
    </div>
  );
}
