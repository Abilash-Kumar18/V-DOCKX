"use client";

import { useEffect, useRef, useState } from "react";
import { Zap, Navigation, MapPin, Compass, Play, RotateCcw, Smartphone, ShieldCheck, AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";

export default function DockingMap2D({
  robotPose = { x: 1.15, y: 1.65, theta: -84 }, // meters (0-2m) and degrees
  onRobotMove,
  isDocking = false,
  mobileGpsPose = null,
  mobileMotion = null,
  isPhoneConnected = false,
  destinationPoint = null,
  onDestinationChange = null,
  isCharging = false,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Active Destination Point (defaults to standard charging dock anchor)
  const [internalDest, setInternalDest] = useState({ x: 1.0, y: 0.35 });
  const activeDest = destinationPoint || internalDest;

  // Active robot position (prioritizes live mobile sensor if phone is connected)
  const currentPos = mobileGpsPose?.x ? mobileGpsPose : robotPose;

  // Fixed Arena Obstacle Zones (with safety clearance radii)
  const obstacleZones = [
    { x: 0.35, y: 0.95, radius: 0.18, label: "OBSTACLE A" },
    { x: 1.65, y: 1.15, radius: 0.18, label: "OBSTACLE B" },
  ];

  // Calculate distance to active destination
  const distToDock = Math.hypot(currentPos.x - activeDest.x, currentPos.y - activeDest.y);
  const isCriticalProximity = distToDock <= 0.45;
  const isDockedAndCharging = distToDock <= 0.25 || isCharging;

  // Check if robot is near or inside obstacle collision boundary
  const collidedObstacle = obstacleZones.find(
    (obs) => Math.hypot(currentPos.x - obs.x, currentPos.y - obs.y) <= obs.radius + 0.10
  );
  const isObstacleHazard = !!collidedObstacle;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let t = 0;

    const render = () => {
      t += 0.035;

      const w = canvas.width;
      const h = canvas.height;

      // Coordinate scaling: 2.0m width x 2.0m height
      const scaleX = w / 2.0;
      const scaleY = h / 2.0;

      // 1. Industrial Concrete Floor Base
      ctx.fillStyle = "#FAF7F2";
      ctx.fillRect(0, 0, w, h);

      // Floor depth vignette
      const floorGlow = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7);
      floorGlow.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      floorGlow.addColorStop(1, "rgba(236, 229, 218, 0.6)");
      ctx.fillStyle = floorGlow;
      ctx.fillRect(0, 0, w, h);

      // 2. Arena Boundary Walls
      ctx.strokeStyle = "#1A1715";
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      // Metrology millimeter measurement ticks along borders
      ctx.fillStyle = "#8C6D31";
      ctx.font = "9px monospace";
      for (let m = 0.5; m < 2.0; m += 0.5) {
        ctx.fillText(`${m}m`, m * scaleX - 8, 22);
        ctx.fillText(`${m}m`, 14, m * scaleY + 3);
      }

      // 25cm Grid Lines
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = "rgba(140, 109, 49, 0.12)";
      for (let x = 0; x <= 2.0; x += 0.25) {
        ctx.beginPath();
        ctx.moveTo(x * scaleX, 10);
        ctx.lineTo(x * scaleX, h - 10);
        ctx.stroke();
      }
      for (let y = 0; y <= 2.0; y += 0.25) {
        ctx.beginPath();
        ctx.moveTo(10, y * scaleY);
        ctx.lineTo(w - 10, y * scaleY);
        ctx.stroke();
      }

      // 3. Obstacle Exclusion Zones (with dynamic warning pulses)
      obstacleZones.forEach((obs) => {
        const obsX = obs.x * scaleX;
        const obsY = obs.y * scaleY;
        const obsR = obs.radius * scaleX;

        const isThisObsHazard = collidedObstacle?.label === obs.label;

        // Danger Aura
        ctx.fillStyle = isThisObsHazard
          ? `rgba(239, 68, 68, ${0.30 + 0.15 * Math.sin(t * 8)})`
          : "rgba(239, 68, 68, 0.08)";
        ctx.beginPath();
        ctx.arc(obsX, obsY, obsR + (isThisObsHazard ? 8 : 0), 0, Math.PI * 2);
        ctx.fill();

        // Warning Border
        ctx.strokeStyle = isThisObsHazard ? "#DC2626" : "rgba(239, 68, 68, 0.55)";
        ctx.lineWidth = isThisObsHazard ? 3 : 1.5;
        ctx.beginPath();
        ctx.arc(obsX, obsY, obsR, 0, Math.PI * 2);
        ctx.stroke();

        // Pulsing radar ring on active obstacle hazard
        if (isThisObsHazard) {
          const pulseR = obsR + ((t * 20) % 25);
          ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, 1 - (pulseR - obsR) / 25)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(obsX, obsY, pulseR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Obstacle Label
        ctx.fillStyle = isThisObsHazard ? "#DC2626" : "#EF4444";
        ctx.font = "bold 8px monospace";
        ctx.fillText(obs.label, obsX - 22, obsY + 3);
      });

      // 4. Destination / Charging Dock
      const psX = activeDest.x * scaleX;
      const psY = activeDest.y * scaleY;
      const psW = 0.36 * scaleX;
      const psH = 0.16 * scaleY;

      // Dock approach alignment guide rails
      ctx.strokeStyle = "#D4AF37";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(psX - psW / 2 - 12, psY - 10);
      ctx.lineTo(psX - psW / 2 - 12, psY + psH + 40);
      ctx.moveTo(psX + psW / 2 + 12, psY - 10);
      ctx.lineTo(psX + psW / 2 + 12, psY + psH + 40);
      ctx.stroke();

      // Charging Dock Body
      ctx.fillStyle = isDockedAndCharging ? "#059669" : "#1E293B";
      ctx.strokeStyle = isDockedAndCharging ? "#10B981" : "#C5A059";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(psX - psW / 2, psY - psH / 2, psW, psH, 6);
      ctx.fill();
      ctx.stroke();

      // Brass Contact Pins
      ctx.fillStyle = isDockedAndCharging ? "#34D399" : "#D4AF37";
      ctx.fillRect(psX - 16, psY + psH / 2 - 4, 8, 6);
      ctx.fillRect(psX + 8, psY + psH / 2 - 4, 8, 6);

      // Docking Target Label
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText(isDockedAndCharging ? "CHARGING TERMINAL" : "DESTINATION DOCK", psX - 42, psY - 2);
      ctx.fillStyle = isDockedAndCharging ? "#6EE7B7" : "#94A3B8";
      ctx.font = "8px monospace";
      ctx.fillText(`TARGET [${activeDest.x.toFixed(2)}m, ${activeDest.y.toFixed(2)}m]`, psX - 48, psY + 10);

      // 5. Dynamic Trajectory Line around Obstacles
      const startX = currentPos.x * scaleX;
      const startY = currentPos.y * scaleY;
      const endX = psX;
      const endY = psY + 24;

      // Calculate avoidance curvature
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const curveOffset = (currentPos.x - activeDest.x) * 35;

      // Color logic:
      // Obstacle Hazard -> Crimson Alert
      // Critical Proximity -> Amber / Red
      // Docked -> Brilliant Emerald
      // Clear -> Emerald
      const pathColor = isObstacleHazard
        ? "#EF4444"
        : isDockedAndCharging
        ? "#10B981"
        : isCriticalProximity
        ? "#F59E0B"
        : "#10B981";

      const pathGlow = isObstacleHazard
        ? "rgba(239, 68, 68, 0.45)"
        : isDockedAndCharging
        ? "rgba(16, 185, 129, 0.55)"
        : isCriticalProximity
        ? "rgba(245, 158, 11, 0.35)"
        : "rgba(16, 185, 129, 0.22)";

      // Draw Trajectory Corridor
      ctx.strokeStyle = pathGlow;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX + curveOffset, midY, endX, endY);
      ctx.stroke();

      // Active Trajectory Line
      ctx.strokeStyle = pathColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX + curveOffset, midY, endX, endY);
      ctx.stroke();

      // Flowing dashed guide beam
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -t * 15;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX + curveOffset, midY, endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 6. Active Robot / Mobile Phone Marker
      const robotX = currentPos.x * scaleX;
      const robotY = currentPos.y * scaleY;
      const rawAngle = typeof currentPos.theta === "number" ? currentPos.theta : (currentPos.heading ?? 0);
      const thetaRad = (rawAngle * Math.PI) / 180;

      // Dynamic Motion Trail when phone is physically moving
      if (mobileMotion?.isMoving) {
        ctx.strokeStyle = "rgba(16, 185, 129, 0.45)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(robotX, robotY);
        ctx.lineTo(
          robotX - Math.sin(thetaRad) * 22,
          robotY + Math.cos(thetaRad) * 22
        );
        ctx.stroke();
      }

      // Radar Ring Pulse around active position
      const gpsPulse = ((t * 18) % 28) + 12;
      ctx.strokeStyle = isDockedAndCharging
        ? `rgba(16, 185, 129, ${Math.max(0, 1 - gpsPulse / 35)})`
        : isObstacleHazard
        ? `rgba(239, 68, 68, ${Math.max(0, 1 - gpsPulse / 35)})`
        : isPhoneConnected
        ? `rgba(16, 185, 129, ${Math.max(0, 1 - gpsPulse / 35)})`
        : `rgba(255, 56, 32, ${Math.max(0, 1 - gpsPulse / 35)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(robotX, robotY, gpsPulse, 0, Math.PI * 2);
      ctx.stroke();

      // Robot Chassis Body
      ctx.save();
      ctx.translate(robotX, robotY);
      ctx.rotate(thetaRad);

      // Chassis shadow
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // Outer Chassis Body
      ctx.fillStyle = isDockedAndCharging
        ? "#059669"
        : isObstacleHazard
        ? "#DC2626"
        : isCriticalProximity
        ? "#FF1F1F"
        : "#FF3820";
      ctx.strokeStyle = "#C5A059";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-18, -24, 36, 48, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = "transparent";

      // Wheels
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(-22, -18, 4, 12);
      ctx.fillRect(18, -18, 4, 12);
      ctx.fillRect(-22, 6, 4, 12);
      ctx.fillRect(18, 6, 4, 12);

      // Optical Camera Lens indicator
      ctx.fillStyle = "#0284C7";
      ctx.beginPath();
      ctx.arc(0, -22, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Center Chevron Forward Indicator
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 2);
      ctx.lineTo(0, -6);
      ctx.lineTo(6, 2);
      ctx.stroke();

      ctx.restore();

      // 7. ELECTRICAL CHARGING ARCS (Lightning Animation when docked)
      if (isDockedAndCharging) {
        ctx.strokeStyle = "#34D399";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#10B981";
        ctx.shadowBlur = 12;

        // Left arc
        ctx.beginPath();
        ctx.moveTo(robotX - 8, robotY - 14);
        ctx.lineTo(
          (robotX - 8 + psX - 12) / 2 + (Math.random() - 0.5) * 8,
          (robotY - 14 + psY + psH / 2) / 2 + (Math.random() - 0.5) * 8
        );
        ctx.lineTo(psX - 12, psY + psH / 2);
        ctx.stroke();

        // Right arc
        ctx.beginPath();
        ctx.moveTo(robotX + 8, robotY - 14);
        ctx.lineTo(
          (robotX + 8 + psX + 12) / 2 + (Math.random() - 0.5) * 8,
          (robotY - 14 + psY + psH / 2) / 2 + (Math.random() - 0.5) * 8
        );
        ctx.lineTo(psX + 12, psY + psH / 2);
        ctx.stroke();

        ctx.shadowColor = "transparent";
      }

      // Robot Label Tag
      ctx.fillStyle = "#1E293B";
      ctx.font = "bold 9px monospace";
      ctx.fillText(
        isDockedAndCharging
          ? `ROBOT: CHARGING ⚡`
          : mobileMotion?.isMoving
          ? `PHONE ROBOT: ${(distToDock * 100).toFixed(0)}cm`
          : `ROBOT: ${distToDock.toFixed(2)}m`,
        robotX - 32,
        robotY + 34
      );

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentPos, distToDock, isCriticalProximity, isDockedAndCharging, isObstacleHazard, isPhoneConnected, activeDest, collidedObstacle, mobileMotion]);

  // Click on map to set custom Destination Point or manual repositioning
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickPxX = e.clientX - rect.left;
    const clickPxY = e.clientY - rect.top;

    const clickMeterX = Number(Math.max(0.2, Math.min(1.8, (clickPxX / rect.width) * 2.0)).toFixed(2));
    const clickMeterY = Number(Math.max(0.2, Math.min(1.8, (clickPxY / rect.height) * 2.0)).toFixed(2));

    // Update destination
    setInternalDest({ x: clickMeterX, y: clickMeterY });
    if (onDestinationChange) {
      onDestinationChange({ x: clickMeterX, y: clickMeterY });
    }

    // Also update backend destination
    try {
      fetch("http://localhost:8000/api/destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: clickMeterX, y: clickMeterY }),
      }).catch(() => {});
    } catch (_) {}
  };

  return (
    <div className="flex flex-col h-full frame-gilded overflow-hidden shadow-xl bg-white">
      {/* 2D Map Header Plaque */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#C5A059]/30 bg-[#FAF7F2]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isDockedAndCharging
                ? "bg-emerald-500 animate-ping"
                : isObstacleHazard
                ? "bg-red-600 animate-ping"
                : isCriticalProximity
                ? "bg-amber-500 animate-pulse"
                : "bg-emerald-500 animate-pulse"
            }`}
          />
          <span className="text-xs font-sans font-bold text-[#1A1715] tracking-wide">
            2D Navigation Arena
          </span>
          {isPhoneConnected && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
              ● PHONE MOTION SYNCED
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-sans text-stone-600">
          <span className="flex items-center gap-1 font-medium text-stone-700">
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
            Target: [{activeDest.x.toFixed(2)}m, {activeDest.y.toFixed(2)}m]
          </span>
          <span className="flex items-center gap-1 font-bold text-[#1A1715]">
            <Navigation className="w-3.5 h-3.5 text-[#FF3820]" />
            Dist: {distToDock.toFixed(2)}m
          </span>
        </div>
      </div>

      {/* Map Canvas with Click-to-Set Destination hint */}
      <div className="relative flex-1 min-h-[320px] w-full bg-[#FAF7F2] flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          onClick={handleCanvasClick}
          className="w-full h-full max-h-[480px] object-contain cursor-crosshair rounded-xl border border-[#C5A059]/30 shadow-inner"
          title="Click to set new Destination Point or move phone physically"
        />

        {/* Dynamic Warning / Status Banners */}
        {isDockedAndCharging && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-mono font-bold flex items-center gap-2 shadow-xl backdrop-blur-xs animate-bounce pointer-events-none border border-emerald-300">
            <Zap className="w-3.5 h-3.5 animate-spin text-yellow-300" />
            <span>ROBOT DOCKED & CHARGING ACTIVE [RAPID DC]</span>
          </div>
        )}

        {isObstacleHazard && !isDockedAndCharging && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-red-600 text-white text-[11px] font-mono font-bold flex items-center gap-2 shadow-xl backdrop-blur-xs animate-pulse pointer-events-none">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>OBSTACLE PROXIMITY ALERT ({collidedObstacle?.label})</span>
          </div>
        )}
      </div>

      {/* Bottom Footer Tip */}
      <div className="px-3 py-1.5 bg-[#FAF7F2] border-t border-[#C5A059]/20 flex items-center justify-between text-[10px] font-mono text-stone-500">
        <span>Click map to set destination</span>
        <span>Phone motion updates robot position</span>
      </div>
    </div>
  );
}
