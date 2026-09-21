"use client";

import { useEffect, useRef, useState } from "react";
import { Zap, Navigation, MapPin, Compass, Play, RotateCcw, Smartphone, ShieldCheck, AlertTriangle } from "lucide-react";

export default function DockingMap2D({
  robotPose = { x: 1.15, y: 1.65, theta: -84 }, // meters (0-2m) and degrees
  onRobotMove,
  isDocking = false,
  mobileGpsPose = null,
  isPhoneConnected = false,
  isCharged = false,
  distToDock: propDistToDock = null,
  obstacleTelemetry = null,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  // Micro Charging Station Target: Ultra-compact pinpoint dock (reduced radius)
  const powerStation = {
    x: 1.0,
    y: 0.35,
    width: 0.08, // 8cm micro chassis
    height: 0.03, // 3cm micro chassis
    chargeRadius: 0.03, // 3cm pinpoint physical docking radius
  };

  // Prioritize active Mobile Phone GPS / Relative pose if connected
  const currentPos = {
    x: mobileGpsPose?.arena_x ?? robotPose.x,
    y: mobileGpsPose?.arena_y ?? robotPose.y,
    theta: mobileGpsPose?.bearing_deg !== undefined ? mobileGpsPose.bearing_deg - 90 : robotPose.theta,
  };

  const dx = currentPos.x - powerStation.x;
  const dy = currentPos.y - powerStation.y;
  const distToDock = propDistToDock !== null ? propDistToDock : Math.sqrt(dx * dx + dy * dy);
  const isStationCharged = isCharged || distToDock <= 0.03;

  // Obstacle telemetry from Mobile Camera (capped at 5.0m max range)
  const minObsDist = obstacleTelemetry?.min_distance_m;
  const isCorridorBlocked = obstacleTelemetry?.corridor_blocked && minObsDist !== undefined && minObsDist <= 5.0;
  const detectedItems = (obstacleTelemetry?.detected_obstacles || []).filter(
    (d) => (d.distance_m || 999) <= 5.0
  );

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

      // Floor depth subtle radial vignette
      const floorGlow = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.7);
      floorGlow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      floorGlow.addColorStop(1, "rgba(236, 229, 218, 0.65)");
      ctx.fillStyle = floorGlow;
      ctx.fillRect(0, 0, w, h);

      // 2. Realistic Arena Boundary Walls
      ctx.strokeStyle = "#1A1715";
      ctx.lineWidth = 3.5;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      // Millimeter measurement ticks along borders
      ctx.fillStyle = "#8C6D31";
      ctx.font = "9px monospace";
      for (let m = 0.5; m < 2.0; m += 0.5) {
        ctx.fillText(`${m}m`, m * scaleX - 8, 22);
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

      // 3. Dynamic Obstacles Detected by Mobile Phone Camera (Capped at 5.0m)
      const phoneCameraObstacles = [];
      const toDockDx = powerStation.x - currentPos.x;
      const toDockDy = powerStation.y - currentPos.y;
      const toDockDist = Math.sqrt(toDockDx * toDockDx + toDockDy * toDockDy);
      const fwdX = toDockDist > 0.001 ? toDockDx / toDockDist : 0;
      const fwdY = toDockDist > 0.001 ? toDockDy / toDockDist : -1;
      const perpX = -fwdY;
      const perpY = fwdX;

      if (detectedItems.length > 0) {
        detectedItems.forEach((det) => {
          const d = det.distance_m || minObsDist || 1.1;
          if (d > 5.0) return; // Enforce 5.0m maximum collision horizon
          const box = det.box || [0, 0.4, 0.6, 0.6];
          const centerNormX = ((box[1] + box[3]) / 2) - 0.5;
          const latOffset = centerNormX * d * 0.75;

          const oX = Math.max(0.22, Math.min(1.78, currentPos.x + fwdX * d + perpX * latOffset));
          const oY = Math.max(0.42, Math.min(1.78, currentPos.y + fwdY * d + perpY * latOffset));

          phoneCameraObstacles.push({
            x: oX,
            y: oY,
            radius: Math.max(0.14, Math.min(0.22, 0.16 * (1 + (det.confidence || 0.5)))),
            label: `${(det.class || "OBSTACLE").toUpperCase()} ${Math.round((det.confidence || 0.85) * 100)}%`,
            distance: d,
            inCorridor: det.in_corridor || false,
          });
        });
      } else if (obstacleTelemetry?.corridor_blocked && minObsDist && minObsDist <= 5.0) {
        const d = minObsDist;
        const oX = Math.max(0.22, Math.min(1.78, currentPos.x + fwdX * d));
        const oY = Math.max(0.42, Math.min(1.78, currentPos.y + fwdY * d));
        phoneCameraObstacles.push({
          x: oX,
          y: oY,
          radius: 0.18,
          label: `CORRIDOR HAZARD [${d.toFixed(2)}m]`,
          distance: d,
          inCorridor: true,
        });
      }

      // Render Camera-Detected Obstacles on Arena Floor
      phoneCameraObstacles.forEach((obs) => {
        const ox = obs.x * scaleX;
        const oy = obs.y * scaleY;
        const or = obs.radius * scaleX;

        // Pulsing red hazard shockwave ring
        const hazardPulse = ((t * 15) % 18) + 4;
        ctx.fillStyle = "rgba(239, 68, 68, 0.14)";
        ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0.2, 1 - hazardPulse / 28)})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(ox, oy, or + hazardPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Core Obstacle Marker (High-visibility warning disc)
        ctx.fillStyle = "#EF4444";
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(ox, oy, or * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Warning Triangle Icon
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(ox, oy - or * 0.42);
        ctx.lineTo(ox - or * 0.35, oy + or * 0.28);
        ctx.lineTo(ox + or * 0.35, oy + or * 0.28);
        ctx.closePath();
        ctx.fill();

        // Warning Exclamation
        ctx.fillStyle = "#EF4444";
        ctx.font = "bold 9px monospace";
        ctx.fillText("!", ox - 2.5, oy + or * 0.18);

        // High-contrast floating pill label
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 1.2;
        const labelText = `⚠️ ${obs.label} [${obs.distance.toFixed(2)}m]`;
        ctx.font = "bold 8.5px monospace";
        const textWidth = ctx.measureText(labelText).width;
        ctx.beginPath();
        ctx.roundRect(ox - textWidth / 2 - 6, oy - or - 20, textWidth + 12, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#F87171";
        ctx.fillText(labelText, ox - textWidth / 2, oy - or - 9);

        // Distance vector tick from robot to obstacle
        ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(currentPos.x * scaleX, currentPos.y * scaleY);
        ctx.lineTo(ox, oy);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 4. Ultra-Compact Micro Charging Port Dock (Pinpoint radius: 3cm / 0.03m)
      const psX = powerStation.x * scaleX;
      const psY = powerStation.y * scaleY;
      const psW = powerStation.width * scaleX; // ~20px micro connector
      const psH = powerStation.height * scaleY; // ~8px micro connector

      // Compact micro dock terminal connector
      ctx.fillStyle = "#0F172A";
      ctx.strokeStyle = isStationCharged ? "#10B981" : "#C5A059";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(psX - psW / 2, psY - psH / 2, psW, psH, 2.5);
      ctx.fill();
      ctx.stroke();

      // Pinpoint Brass/Gold Contact Terminals (3px micro pads)
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(psX - 6, psY + psH / 2 - 2, 3.5, 2.5);
      ctx.fillRect(psX + 2.5, psY + psH / 2 - 2, 3.5, 2.5);

      // Micro LED Status Indicator at Dock Center (Pinpoint status light)
      ctx.fillStyle = isStationCharged ? "#10B981" : "#06B6D4";
      ctx.beginPath();
      ctx.arc(psX, psY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Delicate 4px Alignment Corner Brackets
      ctx.strokeStyle = "rgba(197, 160, 89, 0.45)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(psX - psW / 2 - 3, psY + 5);
      ctx.lineTo(psX - psW / 2 - 3, psY - psH / 2 - 3);
      ctx.lineTo(psX - psW / 2 + 5, psY - psH / 2 - 3);
      ctx.moveTo(psX + psW / 2 + 3, psY + 5);
      ctx.lineTo(psX + psW / 2 + 3, psY - psH / 2 - 3);
      ctx.lineTo(psX + psW / 2 - 5, psY - psH / 2 - 3);
      ctx.stroke();

      // Minimalist Dock Text
      ctx.fillStyle = "#64748B";
      ctx.font = "bold 8px monospace";
      ctx.fillText("DOCK [1.0m, 0.30m]", psX - 44, psY - 7);

      if (isStationCharged) {
        ctx.fillStyle = "#10B981";
        ctx.font = "bold 9.5px monospace";
        ctx.fillText("⚡ CHARGED (100%)", psX - 34, psY + psH + 11);
      }

      // ============================================================
      // 5. Intelligent Left/Right Clearance Evaluation & Sleek Path
      // ============================================================
      const robotX = currentPos.x * scaleX;
      const robotY = currentPos.y * scaleY;
      const startX = robotX;
      const startY = robotY - 14;
      const endX = psX;
      const endY = psY + psH / 2 + 2;

      const directDx = endX - startX;
      const directDy = endY - startY;
      const directDist = Math.hypot(directDx, directDy) || 1;

      // 5.1 Check if any camera obstacle encroaches the direct forward corridor
      const blockingObs = phoneCameraObstacles.find((o) => {
        const ox = o.x * scaleX;
        const oy = o.y * scaleY;
        const u = Math.max(0, Math.min(1, ((ox - startX) * directDx + (oy - startY) * directDy) / (directDist * directDist)));
        const projX = startX + u * directDx;
        const projY = startY + u * directDy;
        const distToLine = Math.hypot(ox - projX, oy - projY);
        return distToLine < (o.radius * scaleX + 16) && u > 0.08 && u < 0.92;
      });

      const isPathBlocked = !!blockingObs;

      // 5.2 Check Left and Right Area Clearance!
      let isLeftClear = true;
      let isRightClear = true;
      let leftClearanceMargin = 999;
      let rightClearanceMargin = 999;
      let chosenReroute = "DIRECT"; // "LEFT" | "RIGHT" | "BLOCKED"
      let bypassWayX = (startX + endX) / 2;
      let bypassWayY = (startY + endY) / 2;

      let leftCandidateM = null;
      let rightCandidateM = null;

      if (isPathBlocked) {
        const lateralShiftM = 0.38; // 38cm lateral clearance detour
        leftCandidateM = { x: blockingObs.x - lateralShiftM, y: blockingObs.y };
        rightCandidateM = { x: blockingObs.x + lateralShiftM, y: blockingObs.y };

        // Check Left Corridor against Arena Walls (0.22m safe boundary)
        if (leftCandidateM.x < 0.22) {
          isLeftClear = false;
          leftClearanceMargin = 0;
        } else {
          leftClearanceMargin = leftCandidateM.x - 0.22;
        }

        // Check Right Corridor against Arena Walls (1.78m safe boundary)
        if (rightCandidateM.x > 1.78) {
          isRightClear = false;
          rightClearanceMargin = 0;
        } else {
          rightClearanceMargin = 1.78 - rightCandidateM.x;
        }

        // Check clearance against any other detected obstacles
        phoneCameraObstacles.forEach((other) => {
          const dL = Math.hypot(other.x - leftCandidateM.x, other.y - leftCandidateM.y) - other.radius;
          const dR = Math.hypot(other.x - rightCandidateM.x, other.y - rightCandidateM.y) - other.radius;
          leftClearanceMargin = Math.min(leftClearanceMargin, dL);
          rightClearanceMargin = Math.min(rightClearanceMargin, dR);
        });

        if (leftClearanceMargin < 0.16) isLeftClear = false;
        if (rightClearanceMargin < 0.16) isRightClear = false;

        // Selection priority:
        // If left is clear and right is blocked -> REROUTE LEFT
        // If right is clear and left is blocked -> REROUTE RIGHT
        // If both clear -> choose side with higher safety clearance margin
        // If neither clear -> BLOCKED (Trigger Brake)
        if (isLeftClear && (!isRightClear || leftClearanceMargin >= rightClearanceMargin)) {
          chosenReroute = "LEFT";
          bypassWayX = leftCandidateM.x * scaleX;
          bypassWayY = leftCandidateM.y * scaleY;
        } else if (isRightClear) {
          chosenReroute = "RIGHT";
          bypassWayX = rightCandidateM.x * scaleX;
          bypassWayY = rightCandidateM.y * scaleY;
        } else {
          chosenReroute = "BLOCKED";
        }
      }

      // 5.3 Render Visual Clearance Assessment Indicators alongside Obstacle
      if (isPathBlocked && blockingObs && leftCandidateM && rightCandidateM) {
        const box = blockingObs.x * scaleX;
        const boy = blockingObs.y * scaleY;

        // LEFT corridor assessment indicator
        const lx = leftCandidateM.x * scaleX;
        const ly = leftCandidateM.y * scaleY;
        ctx.save();
        ctx.strokeStyle = isLeftClear ? "rgba(16, 185, 129, 0.7)" : "rgba(239, 68, 68, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(box - blockingObs.radius * scaleX, boy);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isLeftClear ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
        ctx.strokeStyle = isLeftClear ? "#10B981" : "#EF4444";
        ctx.beginPath();
        ctx.arc(lx, ly, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isLeftClear ? "#059669" : "#DC2626";
        ctx.font = "bold 7.5px monospace";
        ctx.fillText(isLeftClear ? "L: CLEAR" : "L: BLOCKED", lx - 18, ly + 14);
        ctx.restore();

        // RIGHT corridor assessment indicator
        const rx = rightCandidateM.x * scaleX;
        const ry = rightCandidateM.y * scaleY;
        ctx.save();
        ctx.strokeStyle = isRightClear ? "rgba(16, 185, 129, 0.7)" : "rgba(239, 68, 68, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(box + blockingObs.radius * scaleX, boy);
        ctx.lineTo(rx, ry);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isRightClear ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
        ctx.strokeStyle = isRightClear ? "#10B981" : "#EF4444";
        ctx.beginPath();
        ctx.arc(rx, ry, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isRightClear ? "#059669" : "#DC2626";
        ctx.font = "bold 7.5px monospace";
        ctx.fillText(isRightClear ? "R: CLEAR" : "R: BLOCKED", rx - 18, ry + 14);
        ctx.restore();
      }

      // 5.4 Render Sleek Modern Automotive Navigation Trajectory
      const isRerouting = chosenReroute === "LEFT" || chosenReroute === "RIGHT";
      const isFullyBlocked = chosenReroute === "BLOCKED";

      const primaryPathColor = isFullyBlocked
        ? "#EF4444"
        : isRerouting
        ? "#06B6D4" // Neon cyan for dynamic obstacle bypass
        : isCriticalProximity
        ? "#F59E0B"
        : "#10B981"; // Emerald green for clear direct approach

      const softGlowColor = isFullyBlocked
        ? "rgba(239, 68, 68, 0.18)"
        : isRerouting
        ? "rgba(6, 182, 212, 0.22)"
        : "rgba(16, 185, 129, 0.18)";

      // Path Drawing Helper Function
      const traceTrajectory = () => {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        if (isRerouting) {
          // Smooth 2-stage cubic bypass curve through waypoint
          const cp1X = startX * 0.3 + bypassWayX * 0.7;
          const cp1Y = startY * 0.6 + bypassWayY * 0.4;
          const cp2X = bypassWayX * 0.7 + endX * 0.3;
          const cp2Y = bypassWayY * 0.4 + endY * 0.6;
          ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
        } else {
          // Direct smooth trajectory
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          ctx.quadraticCurveTo(midX, midY, endX, endY);
        }
      };

      // Draw Soft Ambient Light Corridor (Sleek 7px glow instead of clunky ribbon)
      ctx.strokeStyle = softGlowColor;
      ctx.lineWidth = 7;
      traceTrajectory();
      ctx.stroke();

      // Sharp Laser Trajectory Core (Crisp 2.2px line)
      ctx.strokeStyle = primaryPathColor;
      ctx.lineWidth = 2.2;
      traceTrajectory();
      ctx.stroke();

      // Flowing Directional Guidance Photons (smooth micro-dashes)
      if (!isFullyBlocked) {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 10]);
        ctx.lineDashOffset = -t * 26;
        traceTrajectory();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Detour Waypoint Node Marker (Glowing cyan bypass hub)
      if (isRerouting) {
        ctx.fillStyle = "#06B6D4";
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(bypassWayX, bypassWayY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(6, 182, 212, 0.3)";
        ctx.beginPath();
        ctx.arc(bypassWayX, bypassWayY, 8.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#0891B2";
        ctx.font = "bold 8px monospace";
        ctx.fillText(`BYPASS HUB (${chosenReroute})`, bypassWayX - 32, bypassWayY - 10);
      }

      // 5.5 Sleek Clearance Assessment Overlay Badge on Top of 2D Map
      if (isPathBlocked) {
        const badgeW = 290;
        const badgeH = 26;
        const badgeX = w / 2 - badgeW / 2;
        const badgeY = 32;

        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.strokeStyle = isFullyBlocked ? "#EF4444" : "#06B6D4";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 8.5px monospace";
        // Left check status
        ctx.fillStyle = isLeftClear ? "#34D399" : "#F87171";
        ctx.fillText(`L: ${isLeftClear ? "CLEAR" : "BLOCKED"}`, badgeX + 12, badgeY + 16);

        // Divider
        ctx.fillStyle = "#475569";
        ctx.fillText("·", badgeX + 88, badgeY + 16);

        // Right check status
        ctx.fillStyle = isRightClear ? "#34D399" : "#F87171";
        ctx.fillText(`R: ${isRightClear ? "CLEAR" : "BLOCKED"}`, badgeX + 100, badgeY + 16);

        // Divider
        ctx.fillStyle = "#475569";
        ctx.fillText("·", badgeX + 176, badgeY + 16);

        // Action / Decision
        ctx.fillStyle = isFullyBlocked ? "#EF4444" : "#38BDF8";
        ctx.fillText(
          isFullyBlocked ? "⛔ BRAKE (NO PATH)" : `REROUTE ${chosenReroute} ➡️`,
          badgeX + 188,
          badgeY + 16
        );
      }

      // 6. Active Robot / Mobile GPS Point Marker
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

      // Robot Chassis Body
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

      // Forward Vision Camera Aperture Indicator
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(0, -18, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Mobile Phone Icon on Robot if phone is connected
      if (isPhoneConnected) {
        ctx.fillStyle = "#10B981";
        ctx.fillRect(-5, -6, 10, 15);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-3, -4, 6, 9);
      }

      ctx.restore();

      // Active Robot Label
      ctx.fillStyle = "#1A1715";
      ctx.font = "bold 9px monospace";
      const robotLabel = isPhoneConnected
        ? `PHONE [${currentPos.x.toFixed(2)}m, ${currentPos.y.toFixed(2)}m]`
        : `ROBOT [${currentPos.x.toFixed(2)}m, ${currentPos.y.toFixed(2)}m]`;
      ctx.fillText(robotLabel, robotX - 36, robotY + 36);

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [currentPos.x, currentPos.y, currentPos.theta, isDocking, isPhoneConnected, isStationCharged, obstacleTelemetry]);

  return (
    <div
      className="w-full h-full flex flex-col relative rounded-2xl overflow-hidden frame-gilded bg-[#FAF7F2] p-2 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        width={480}
        height={480}
        className="w-full h-full object-contain rounded-xl"
      />

      {/* Top Floating Status Indicator */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#C5A059]/40 text-[10px] font-mono font-bold text-[#1A1715] shadow-xs">
          <MapPin className="w-3 h-3 text-[#FF3820]" />
          <span>MAP 2.0m x 2.0m</span>
        </div>

        {isPhoneConnected && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 backdrop-blur-md border border-emerald-300 text-[10px] font-mono font-bold text-emerald-700 shadow-xs">
            <Smartphone className="w-3 h-3 text-emerald-600" />
            <span>PHONE DOCK-GPS</span>
          </div>
        )}

        {isCorridorBlocked && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold shadow-md animate-pulse">
            <AlertTriangle className="w-3 h-3 text-white" />
            <span>OBSTACLE [{minObsDist.toFixed(2)}m]</span>
          </div>
        )}
      </div>

      {/* Bottom Floating Telemetry Strip */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between text-[11px] font-mono font-bold text-[#1A1715] pointer-events-none">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#C5A059]/40 shadow-xs">
          <Compass className="w-3.5 h-3.5 text-[#8C6D31]" />
          <span>θ: {Math.round(currentPos.theta)}°</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#C5A059]/40 shadow-xs">
          <Navigation className="w-3.5 h-3.5 text-[#FF3820]" />
          <span>DOCK DISTANCE: {distToDock.toFixed(2)}m</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[#C5A059]/40 shadow-xs">
          <Zap className={`w-3.5 h-3.5 ${isStationCharged ? "text-emerald-500 fill-emerald-500 animate-pulse" : "text-[#C5A059]"}`} />
          <span>{isStationCharged ? "CHARGED (100%)" : distToDock <= 0.03 ? "CONTACT (3cm)" : "APPROACHING"}</span>
        </div>
      </div>
    </div>
  );
}
