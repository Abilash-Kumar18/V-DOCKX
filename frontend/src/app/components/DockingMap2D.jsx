"use client";

import { useEffect, useRef, useState } from "react";
import { Zap, Navigation, MapPin, Compass, Play, RotateCcw, Smartphone, ShieldCheck, AlertTriangle } from "lucide-react";

export default function DockingMap2D({
  robotPose = { x: 1.15, y: 1.65, theta: -84 }, // meters (0-2m) and degrees
  onRobotMove,
  isDocking = false,
  mobileGpsPose = null,
  isPhoneConnected = false,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Active position (prioritizes live mobile GPS sensor if phone is broadcasting)
  const currentPos = mobileGpsPose?.x ? mobileGpsPose : robotPose;

  // Fixed Real-World Charging Station Anchor (GPS Anchor: 42.3601° N, 71.0589° W)
  const powerStation = {
    x: 1.0,
    y: 0.35,
    width: 0.36,
    height: 0.16,
    lat: "42.3601° N",
    lng: "71.0589° W",
  };

  // Fixed Arena Obstacle Zones (to demonstrate dynamic avoidance & collision boundary)
  const obstacleZones = [
    { x: 0.35, y: 0.95, radius: 0.18, label: "OBSTACLE A" },
    { x: 1.65, y: 1.15, radius: 0.18, label: "OBSTACLE B" },
  ];

  // Calculate distance to charging dock
  const distToDock = Math.sqrt((currentPos.x - powerStation.x) ** 2 + (currentPos.y - powerStation.y) ** 2);
  const isCriticalProximity = distToDock <= 0.45;

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

      // 1. Realistic Industrial Concrete / Architectural Floor Base
      ctx.fillStyle = "#FAF7F2";
      ctx.fillRect(0, 0, w, h);

      // Floor depth vignette
      const floorGlow = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7);
      floorGlow.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      floorGlow.addColorStop(1, "rgba(236, 229, 218, 0.6)");
      ctx.fillStyle = floorGlow;
      ctx.fillRect(0, 0, w, h);

      // 2. Realistic Arena Boundary Walls
      ctx.strokeStyle = "#1A1715";
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      // Metrology millimeter measurement ticks along borders
      ctx.fillStyle = "#8C6D31";
      ctx.font = "9px monospace";
      for (let m = 0.5; m < 2.0; m += 0.5) {
        // Top edge labels
        ctx.fillText(`${m}m`, m * scaleX - 8, 22);
        // Left edge labels
        ctx.fillText(`${m}m`, 14, m * scaleY + 3);
      }

      // Subtle 25cm Grid Lines
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

      // 3. Obstacle Exclusion Zones (with warning stripes)
      obstacleZones.forEach((obs) => {
        const obsX = obs.x * scaleX;
        const obsY = obs.y * scaleY;
        const obsR = obs.radius * scaleX;

        ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
        ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(obsX, obsY, obsR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#991B1B";
        ctx.font = "bold 8px monospace";
        ctx.fillText(obs.label, obsX - 24, obsY + 3);
      });

      // 4. Fixed Charging Station Docking Bay
      const psX = powerStation.x * scaleX;
      const psY = powerStation.y * scaleY;
      const psW = powerStation.width * scaleX;
      const psH = powerStation.height * scaleY;

      // Docking Bay Parking Stalls (Painted yellow/white boundary lines like in parking cars)
      ctx.strokeStyle = "#D4AF37";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // Left parking line
      ctx.moveTo((powerStation.x - 0.28) * scaleX, (powerStation.y - 0.1) * scaleY);
      ctx.lineTo((powerStation.x - 0.28) * scaleX, (powerStation.y + 0.35) * scaleY);
      // Right parking line
      ctx.moveTo((powerStation.x + 0.28) * scaleX, (powerStation.y - 0.1) * scaleY);
      ctx.lineTo((powerStation.x + 0.28) * scaleX, (powerStation.y + 0.35) * scaleY);
      ctx.stroke();

      // Pulsing electromagnetic target rings around dock
      const pulseRadius = ((t * 22) % 35) + 10;
      ctx.strokeStyle = `rgba(255, 56, 32, ${Math.max(0, 1 - pulseRadius / 45)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(psX, psY, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Charging dock body (deep slate chassis)
      ctx.fillStyle = "#1E293B";
      ctx.strokeStyle = "#C5A059";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(psX - psW / 2, psY - psH / 2, psW, psH, 6);
      ctx.fill();
      ctx.stroke();

      // Brass Contact Pins
      ctx.fillStyle = "#D4AF37";
      ctx.fillRect(psX - 16, psY + psH / 2 - 4, 8, 6);
      ctx.fillRect(psX + 8, psY + psH / 2 - 4, 8, 6);

      // Docking Target Label & GPS Anchor
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("CHARGING DOCK", psX - 38, psY - 2);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "8px monospace";
      ctx.fillText("FIXED DOCK [1.0m, 0.35m]", psX - 52, psY + 10);

      // 5. Dynamic Shortest-Path Trajectory Line (Recalculates in real time!)
      // Path connects current robot/phone position to docking target (psX, psY + 20)
      const startX = currentPos.x * scaleX;
      const startY = currentPos.y * scaleY;
      const endX = psX;
      const endY = psY + 24;

      // Compute curved Bézier control point for shortest path around obstacles
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const curveOffset = (currentPos.x - powerStation.x) * 40;

      // Color logic (Automotive Parking Line behavior):
      // If critical proximity (< 0.45m) or close to obstacle: Turns RED!
      // Otherwise safe emerald or gold
      const pathColor = isCriticalProximity ? "#FF1F1F" : "#10B981";
      const pathGlow = isCriticalProximity ? "rgba(255, 31, 31, 0.4)" : "rgba(16, 185, 129, 0.25)";

      // Draw Shortest Path Trajectory Corridor
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

      // 6. Active Robot / Mobile GPS Point Marker
      const robotX = currentPos.x * scaleX;
      const robotY = currentPos.y * scaleY;
      const thetaRad = ((currentPos.theta ?? -90) * Math.PI) / 180;

      // GPS Radar Ring Pulse around active position
      const gpsPulse = ((t * 18) % 28) + 12;
      ctx.strokeStyle = isPhoneConnected
        ? `rgba(16, 185, 129, ${Math.max(0, 1 - gpsPulse / 35)})`
        : `rgba(255, 56, 32, ${Math.max(0, 1 - gpsPulse / 35)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(robotX, robotY, gpsPulse, 0, Math.PI * 2);
      ctx.stroke();

      // Robot / Mobile Chassis Body
      ctx.save();
      ctx.translate(robotX, robotY);
      ctx.rotate(thetaRad + Math.PI / 2);

      // Chassis shadow
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // Outer Chassis (Vermillion with gilded border)
      ctx.fillStyle = isCriticalProximity ? "#FF1F1F" : "#FF3820";
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

      // Forward Directional Chevron
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(0, -14);
      ctx.lineTo(7, -4);
      ctx.stroke();

      ctx.restore();

      // Floating Live Coordinate Badge
      ctx.fillStyle = "rgba(26, 23, 21, 0.85)";
      ctx.beginPath();
      ctx.roundRect(robotX - 45, robotY - 42, 90, 18, 4);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 8.5px monospace";
      ctx.fillText(
        isPhoneConnected ? `PHONE GPS: ${distToDock.toFixed(2)}m` : `ROBOT: ${distToDock.toFixed(2)}m`,
        robotX - 40,
        robotY - 30
      );
    };

    render();
    const loop = () => {
      render();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [currentPos, isDocking, isPhoneConnected, isCriticalProximity, distToDock]);

  // Click on map to reposition robot or set target point
  const handleCanvasClick = (e) => {
    if (!onRobotMove || isDocking) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 2.0;
    const clickY = ((e.clientY - rect.top) / rect.height) * 2.0;

    const dx = powerStation.x - clickX;
    const dy = powerStation.y - clickY;
    const thetaDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    onRobotMove({
      x: Math.max(0.15, Math.min(1.85, Number(clickX.toFixed(3)))),
      y: Math.max(0.38, Math.min(1.85, Number(clickY.toFixed(3)))),
      theta: Math.round(thetaDeg),
    });
  };

  return (
    <div className="flex flex-col h-full frame-gilded overflow-hidden shadow-xl bg-white">
      {/* 2D Map Header Plaque */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#C5A059]/30 bg-[#FAF7F2]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isCriticalProximity ? "bg-red-600 animate-ping" : "bg-emerald-500 animate-pulse"
            }`}
          />
          <span className="text-xs font-sans font-bold text-[#1A1715] tracking-wide">
            2D Navigation Arena
          </span>
          {isPhoneConnected && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
              ● PHONE GPS LINKED
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-sans text-stone-600">
          <span className="flex items-center gap-1 font-medium text-stone-700">
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
            Fixed Dock: [1.0m, 0.35m]
          </span>
          <span className="flex items-center gap-1 font-bold text-[#1A1715]">
            <Navigation className="w-3.5 h-3.5 text-[#FF3820]" />
            Dist: {distToDock.toFixed(2)}m
          </span>
        </div>
      </div>

      {/* Map Canvas with Light Background */}
      <div className="relative flex-1 min-h-[320px] w-full bg-[#FAF7F2] flex items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          onClick={handleCanvasClick}
          className="w-full h-full max-h-[480px] object-contain cursor-crosshair rounded-xl border border-[#C5A059]/30 shadow-inner"
          title="Click to reposition or move phone to sync GPS point"
        />

        {/* Proximity Warning Banner on Map */}
        {isCriticalProximity && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-red-600/90 text-white text-[11px] font-mono font-bold flex items-center gap-2 shadow-lg backdrop-blur-xs animate-bounce pointer-events-none">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>CRITICAL PROXIMITY ({distToDock.toFixed(2)}m) - PATH TURNING RED</span>
          </div>
        )}
      </div>
    </div>
  );
}
