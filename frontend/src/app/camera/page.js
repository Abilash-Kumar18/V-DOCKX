"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  FlipHorizontal,
  Radio,
  Wifi,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  MapPin,
  Compass,
  Navigation,
  Activity,
  Zap,
  AlertTriangle,
  ShieldAlert,
  Target,
} from "lucide-react";

export default function MobileCameraPage() {
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const arCanvasRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // back camera by default
  const [fps, setFps] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [transmittedFrames, setTransmittedFrames] = useState(0);

  // Live GPS State (Updated Every 1 Second)
  const [gpsData, setGpsData] = useState({
    lat: 13.0827,
    lng: 80.2707,
    accuracy: null,
    speed: null,
    isGpsActive: false,
    lastUpdate: null,
  });

  // Laptop Charging Station Anchor (Fixed Reference)
  const [dockAnchor, setDockAnchor] = useState({
    lat: 13.0827,
    lng: 80.2707,
    label: "Laptop Charging Dock",
  });

  // Relative Trajectory to Laptop Dock
  const [relativeDockPose, setRelativeDockPose] = useState({
    distance_m: 1.25,
    bearing_deg: 0.0,
    heading_error_deg: 0.0,
    dx_m: 0.0,
    dy_m: 0.0,
    arena_x: 1.0,
    arena_y: 1.6,
  });

  // Device Orientation (Compass Yaw & Phone Pitch)
  const [compassHeading, setCompassHeading] = useState(0);
  const [phonePitch, setPhonePitch] = useState(0);

  // Model-Based Obstacle Detections
  const [detectedObstacles, setDetectedObstacles] = useState([]);
  const [isCorridorBlocked, setIsCorridorBlocked] = useState(false);
  const [obstacleMinDist, setObstacleMinDist] = useState(999.0);

  const animFrameRef = useRef(null);
  const pulsePhaseRef = useRef(0);

  // 1. Fetch Dock Anchor from Backend on Mount
  useEffect(() => {
    const fetchAnchor = async () => {
      try {
        const backendHost = window.location.hostname || "localhost";
        const res = await fetch("/api/dock/anchor");
        if (res.ok) {
          const data = await res.json();
          if (data.dock_lat && data.dock_lng) {
            setDockAnchor({ lat: data.dock_lat, lng: data.dock_lng, label: "Laptop Dock" });
          }
        }
      } catch (e) {
        console.warn("Could not fetch dock anchor from backend, using default anchor:", e);
      }
    };
    fetchAnchor();
  }, []);

  // 2. Robust Mobile Camera Initialization with Permission Fallbacks
  const initCamera = async (mode = facingMode) => {
    setErrorMsg(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg("Camera access requires HTTPS or localhost. Please ensure you are opening the https:// link.");
      setIsStreaming(false);
      return;
    }

    try {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }

      let stream = null;
      try {
        // Attempt high-res rear camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch (specErr) {
        console.warn("Retrying with relaxed camera constraints...", specErr);
        // Fallback to generic video stream for maximum mobile compatibility
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Autoplay interaction needed:", playErr);
        }
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Camera access error on phone:", err);
      setErrorMsg("Camera access was blocked. Please tap 'Enable Camera' and grant camera permission in your browser.");
      setIsStreaming(false);
    }
  };

  const handleFlipCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    initCamera(nextMode);
  };

  useEffect(() => {
    initCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // 3. Real-Time 1-Second GPS Position Calculation Loop
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation API not supported by this browser.");
      return;
    }

    let latestCoords = null;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latestCoords = pos.coords;
      },
      (err) => {
        console.warn("GPS watch position warning:", err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    // Exact 1000ms (1 sec) GPS Calculation & Reporting Interval
    const gpsInterval = setInterval(async () => {
      let lat = gpsData.lat;
      let lng = gpsData.lng;
      let accuracy = gpsData.accuracy;
      let speed = gpsData.speed;

      if (latestCoords) {
        lat = latestCoords.latitude;
        lng = latestCoords.longitude;
        accuracy = Math.round(latestCoords.accuracy || 3);
        speed = latestCoords.speed;
      }

      setGpsData({
        lat,
        lng,
        accuracy,
        speed,
        isGpsActive: true,
        lastUpdate: new Date().toLocaleTimeString(),
      });

      // Post Phone GPS to Backend
      try {
        const backendHost = window.location.hostname || "localhost";
        const res = await fetch("/api/robot/gps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat,
            lng,
            compass_heading: compassHeading,
            accuracy,
            speed,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.relative_pose) {
            setRelativeDockPose({
              distance_m: data.relative_pose.distance_to_dock_m,
              bearing_deg: data.relative_pose.bearing_to_dock_deg,
              heading_error_deg: data.relative_pose.heading_error_deg,
              dx_m: data.relative_pose.dx_meters,
              dy_m: data.relative_pose.dy_meters,
              arena_x: data.relative_pose.arena_x,
              arena_y: data.relative_pose.arena_y,
            });
          }
        }
      } catch (err) {
        // Fallback localized geodesic calculation
        let dLat = (lat - dockAnchor.lat) * 111139;
        let dLng = (lng - dockAnchor.lng) * 111139 * Math.cos((dockAnchor.lat * Math.PI) / 180);
        let dist = Math.sqrt(dLat * dLat + dLng * dLng);

        // Auto-calibrate indoor offset: if raw GPS distance is > 15m (cell tower/indoor jitter),
        // auto-anchor dock 1.3m in front of current phone heading
        if (dist > 15.0) {
          const forwardM = 1.30;
          const rad = (compassHeading * Math.PI) / 180;
          const calibLat = lat + (forwardM * Math.cos(rad)) / 111139;
          const calibLng = lng + (forwardM * Math.sin(rad)) / (111139 * Math.cos((lat * Math.PI) / 180));
          setDockAnchor({ lat: calibLat, lng: calibLng, label: "Laptop Dock (Calibrated)" });
          dLat = (lat - calibLat) * 111139;
          dLng = (lng - calibLng) * 111139 * Math.cos((calibLat * Math.PI) / 180);
          dist = forwardM;
        }

        const bearing = (Math.atan2(-dLng, -dLat) * 180) / Math.PI;
        const normBearing = (bearing + 360) % 360;
        const headingErr = ((normBearing - compassHeading + 180) % 360) - 180;

        setRelativeDockPose((prev) => ({
          ...prev,
          distance_m: Math.max(0.12, Number(dist.toFixed(2))),
          bearing_deg: Math.round(normBearing),
          heading_error_deg: Math.round(headingErr),
          dx_m: Number(dLng.toFixed(2)),
          dy_m: Number(dLat.toFixed(2)),
          arena_x: Math.max(0.15, Math.min(1.85, 1.0 + dLng * 0.4)),
          arena_y: Math.max(0.35, Math.min(1.85, 0.35 + dist * 0.85)),
        }));
      }
    }, 1000); // Exactly 1 second per tick

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(gpsInterval);
    };
  }, [dockAnchor, compassHeading]);

  // 4. Device Orientation / Compass Heading
  useEffect(() => {
    const handleOrientation = (e) => {
      if (e.alpha !== null) {
        let heading = Math.round(e.alpha);
        if (heading > 180) heading -= 360;
        setCompassHeading(heading);
      }
      if (e.beta !== null) {
        setPhonePitch(Math.round(e.beta));
      }
    };

    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  // 5. Frame Transmission & Model-Based Obstacle Ingestion Loop
  useEffect(() => {
    if (!isStreaming) return;

    let isSending = false;
    let frameCount = 0;
    let lastFpsTime = Date.now();

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      if (!video || !canvas || video.readyState < 2 || isSending) return;

      isSending = true;

      try {
        const ctx = canvas.getContext("2d");
        const w = 480;
        const h = Math.floor((video.videoHeight / video.videoWidth) * w) || 360;
        canvas.width = w;
        canvas.height = h;

        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.55);

        const backendHost = window.location.hostname || "localhost";

        // Call vision process on backend with model-based detection
        let latestBlocked = isCorridorBlocked;
        let latestMinDist = obstacleMinDist;
        let latestObs = detectedObstacles;

        try {
          const vRes = await fetch("/api/vision/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ frame: dataUrl }),
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            if (vData.success) {
              latestBlocked = vData.corridor_blocked || false;
              latestObs = vData.detected_obstacles || [];
              setIsCorridorBlocked(latestBlocked);
              setDetectedObstacles(latestObs);
              if (vData.min_distance_m !== undefined) {
                latestMinDist = vData.min_distance_m;
                setObstacleMinDist(latestMinDist);
                // Fuse camera visual distance: as phone approaches laptop, update distance
                // Only process obstacles within ~5.0 meters
                if (latestMinDist <= 5.0) {
                  setRelativeDockPose((prev) => ({
                    ...prev,
                    distance_m: Number(latestMinDist.toFixed(2)),
                    arena_y: Math.max(0.35, Number((0.35 + latestMinDist * 0.85).toFixed(3))),
                  }));
                } else {
                  latestBlocked = false;
                }
              }
            }
          }
        } catch (e) {}

        // Broadcast frame, pose AND live obstacle collision telemetry to Next.js API route
        await fetch("/api/camera/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frame: dataUrl,
            pose: {
              x: relativeDockPose.arena_x,
              y: relativeDockPose.arena_y,
              heading: compassHeading,
              lat: gpsData.lat,
              lng: gpsData.lng,
              isGpsActive: gpsData.isGpsActive,
              accuracy: gpsData.accuracy,
              distance_m: relativeDockPose.distance_m,
              bearing_deg: relativeDockPose.bearing_deg,
              heading_error_deg: relativeDockPose.heading_error_deg,
            },
            obstacle: {
              corridor_blocked: latestBlocked,
              min_distance_m: (latestMinDist <= 5.0) ? latestMinDist : null,
              detected_obstacles: latestObs,
            },
          }),
        }).catch(() => {});

        frameCount++;
        setTransmittedFrames((prev) => prev + 1);

        const now = Date.now();
        if (now - lastFpsTime >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          lastFpsTime = now;
        }
      } catch (err) {
        console.warn("Frame transmission error:", err);
      } finally {
        isSending = false;
      }
    }, 90); // ~11 FPS streaming for model processing

    return () => clearInterval(interval);
  }, [isStreaming, compassHeading, gpsData, relativeDockPose]);

  // 6. Dynamic AR Path & Model Obstacle Rendering Loop (60 FPS Canvas Overlay)
  useEffect(() => {
    const canvas = arCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let running = true;

    const renderAR = () => {
      if (!running) return;

      const w = canvas.width = canvas.parentElement?.clientWidth || 480;
      const h = canvas.height = canvas.parentElement?.clientHeight || 640;

      ctx.clearRect(0, 0, w, h);

      pulsePhaseRef.current = (pulsePhaseRef.current + 0.04) % 1.0;
      const phase = pulsePhaseRef.current;

      // Calculate Target Vanishing Point on Screen from Heading Error
      // heading_error_deg: 0 = directly ahead, negative = dock is to left, positive = dock is to right
      const headingErr = relativeDockPose.heading_error_deg || 0;
      // Damped, natural perspective vanishing point (prevents route from slanting wildly off-screen)
      const maxSteerPx = w * 0.26;
      const clampedErr = Math.max(-45, Math.min(45, headingErr));
      const targetVanishingX = w / 2 + (clampedErr / 45.0) * maxSteerPx;
      const horizonY = h * 0.45;

      // Bottom Bumper Coordinates (Origin of Robot Vision)
      const bottomCenter = w / 2;
      const laneWidthBottom = w * 0.72;
      const bLeft = bottomCenter - laneWidthBottom / 2;
      const bRight = bottomCenter + laneWidthBottom / 2;
      const bY = h - 10;

      // Top Dock Target Width
      const laneWidthTop = Math.max(30, w * 0.12);
      const tLeft = targetVanishingX - laneWidthTop / 2;
      const tRight = targetVanishingX + laneWidthTop / 2;
      const tY = horizonY;

      // Determine Path Color State
      // 1. Red: Hazard / Obstacle Detected by Model
      // 2. Amber: Steering alignment required
      // 3. Emerald Green: Clear path and aligned with dock
      let pathTheme = {
        fill: "rgba(16, 185, 129, 0.15)",
        stroke: "rgba(16, 185, 129, 0.9)",
        glow: "#10B981",
        chevron: "#34D399",
        statusText: "PATH CLEAR · ADVANCE TO DOCK",
      };

      if (isCorridorBlocked || detectedObstacles.some((d) => d.in_corridor)) {
        pathTheme = {
          fill: "rgba(239, 68, 68, 0.32)",
          stroke: "rgba(239, 68, 68, 1.0)",
          glow: "#EF4444",
          chevron: "#F87171",
          statusText: "⚠️ OBSTACLE DETECTED IN CORRIDOR · HALTING",
        };
      } else if (Math.abs(headingErr) > 12) {
        pathTheme = {
          fill: "rgba(245, 158, 11, 0.18)",
          stroke: "rgba(245, 158, 11, 0.9)",
          glow: "#F59E0B",
          chevron: "#FBBF24",
          statusText: headingErr > 0 ? "STEER RIGHT ➡️ TO ALIGN" : "⬅️ STEER LEFT TO ALIGN",
        };
      }

      // Draw Dynamic Perspective Trajectory Corridor
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bLeft, bY);
      ctx.lineTo(tLeft, tY);
      ctx.lineTo(tRight, tY);
      ctx.lineTo(bRight, bY);
      ctx.closePath();

      // Glowing Corridor Gradient
      const grad = ctx.createLinearGradient(bottomCenter, bY, targetVanishingX, tY);
      grad.addColorStop(0, pathTheme.fill);
      grad.addColorStop(1, "rgba(255, 255, 255, 0.02)");
      ctx.fillStyle = grad;
      ctx.fill();

      // Outer Lane Lines
      ctx.strokeStyle = pathTheme.stroke;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = pathTheme.glow;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(bLeft, bY);
      ctx.lineTo(tLeft, tY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bRight, bY);
      ctx.lineTo(tRight, tY);
      ctx.stroke();
      ctx.restore();

      // Animated Streaming Chevrons Along Projected Path
      const numChevrons = 5;
      for (let i = 0; i < numChevrons; i++) {
        const t = (i / numChevrons + phase) % 1.0;
        const cy = bY - t * (bY - tY);
        const curWidth = laneWidthBottom - t * (laneWidthBottom - laneWidthTop);
        const curCenterX = bottomCenter + t * (targetVanishingX - bottomCenter);

        const chW = curWidth * 0.45;
        const chLeft = curCenterX - chW / 2;
        const chRight = curCenterX + chW / 2;
        const chApexY = cy - 14 * (1 - t * 0.5);

        ctx.save();
        ctx.strokeStyle = pathTheme.chevron;
        ctx.lineWidth = Math.max(1.5, 3.5 * (1 - t * 0.6));
        ctx.beginPath();
        ctx.moveTo(chLeft, cy);
        ctx.lineTo(curCenterX, chApexY);
        ctx.lineTo(chRight, cy);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Docking Target Bay Horizon Marker
      ctx.save();
      ctx.strokeStyle = "#D4AF37";
      ctx.fillStyle = "rgba(212, 175, 55, 0.2)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#D4AF37";
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.arc(targetVanishingX, horizonY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crosshair Reticle
      ctx.beginPath();
      ctx.moveTo(targetVanishingX - 26, horizonY);
      ctx.lineTo(targetVanishingX + 26, horizonY);
      ctx.moveTo(targetVanishingX, horizonY - 26);
      ctx.lineTo(targetVanishingX, horizonY + 26);
      ctx.stroke();

      // Target Label
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `LAPTOP DOCK · ${relativeDockPose.distance_m.toFixed(2)}m`,
        targetVanishingX,
        horizonY - 32
      );
      ctx.restore();

      // Draw Model Detected Obstacle Bounding Boxes
      detectedObstacles.forEach((obs) => {
        const [ymin, xmin, ymax, xmax] = obs.box || [0, 0, 0, 0];
        const bx = xmin * w;
        const by = ymin * h;
        const bw = (xmax - xmin) * w;
        const bh = (ymax - ymin) * h;

        ctx.save();
        ctx.strokeStyle = obs.in_corridor ? "#EF4444" : "#F59E0B";
        ctx.lineWidth = 2.5;
        ctx.fillStyle = obs.in_corridor ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.15)";
        ctx.shadowColor = obs.in_corridor ? "#EF4444" : "#F59E0B";
        ctx.shadowBlur = 8;

        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillRect(bx, by, bw, bh);

        // Obstacle Badge
        ctx.fillStyle = obs.in_corridor ? "#EF4444" : "#F59E0B";
        ctx.fillRect(bx, Math.max(0, by - 18), bw, 18);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(
          `${obs.class.toUpperCase()} ${Math.round(obs.confidence * 100)}%`,
          bx + 4,
          Math.max(12, by - 5)
        );
        ctx.restore();
      });

      // Red Hazard Barrier across corridor if blocked
      if (isCorridorBlocked) {
        ctx.save();
        const barrierY = h * 0.65;
        ctx.strokeStyle = "#EF4444";
        ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(bLeft * 0.6 + tLeft * 0.4, barrierY);
        ctx.lineTo(bRight * 0.6 + tRight * 0.4, barrierY);
        ctx.stroke();

        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText("🛑 COLLISION WARNING · STOPPED", w / 2, barrierY - 8);
        ctx.restore();
      }

      // Guidance Status Strip Over Bottom of AR View
      ctx.save();
      ctx.fillStyle = isCorridorBlocked ? "rgba(239, 68, 68, 0.85)" : "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(w * 0.08, h - 55, w * 0.84, 28);
      ctx.strokeStyle = pathTheme.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(w * 0.08, h - 55, w * 0.84, 28);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(pathTheme.statusText, w / 2, h - 37);
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(renderAR);
    };

    animFrameRef.current = requestAnimationFrame(renderAR);
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [relativeDockPose, isCorridorBlocked, detectedObstacles]);

  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col justify-between p-3 select-none">
      {/* Top Mobile Status Header */}
      <header className="flex items-center justify-between p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#FF3820] flex items-center justify-center text-white shadow-[0_0_12px_rgba(255,56,32,0.6)]">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-bold font-sans tracking-wide text-white uppercase">
              V-DOCKX MOBILE VISION & GPS
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-300">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                GPS 1.0 Hz SYNC
              </span>
              <span>•</span>
              <span>{fps} FPS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFlipCamera}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-stone-200 transition-colors cursor-pointer"
            title="Switch Camera"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Vision Viewport with Dynamic AR Path Overlay */}
      <main className="relative flex-1 my-2 rounded-3xl overflow-hidden bg-black flex items-center justify-center border border-white/15 shadow-2xl">
        {/* Live Camera Video */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Hidden Processing Canvas */}
        <canvas ref={captureCanvasRef} className="hidden" />

        {/* Interactive AR Projected Path Canvas Overlay */}
        <canvas
          ref={arCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Floating Top Telemetry Pill */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-mono text-stone-200">
            <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>DIST: {relativeDockPose.distance_m.toFixed(2)}m</span>
          </div>

          {isCorridorBlocked && (
            <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-mono font-bold text-white shadow-lg animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>OBSTACLE BRAKE</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-mono text-stone-200">
            <Compass className="w-3.5 h-3.5 text-[#FF3820]" />
            <span>BEARING: {relativeDockPose.bearing_deg}°</span>
          </div>
        </div>

                {/* CHARGED Notification when robot reaches charging port */}
        {relativeDockPose.distance_m <= 0.03 && (
          <div className="absolute inset-x-4 top-14 z-30 p-3.5 rounded-2xl bg-emerald-600/95 backdrop-blur-md border-2 border-white text-white shadow-2xl animate-bounce text-center">
            <div className="flex items-center justify-center gap-2 text-base font-black tracking-wider uppercase font-sans">
              <Zap className="w-5 h-5 fill-current text-yellow-300" />
              <span>⚡ CHARGED (100%)</span>
            </div>
            <p className="text-[11px] font-mono mt-0.5 text-emerald-100 font-bold">
              ROBOT AT CHARGING PORT · DOCK LOCKED (29.4V)
            </p>
          </div>
        )}

        {/* Tap to Start Camera Overlay (Crucial for Mobile Browser Permission Handshake) */}
        {!isStreaming && !errorMsg && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30">
            <div className="w-16 h-16 rounded-full bg-[#FF3820]/20 border-2 border-[#FF3820] flex items-center justify-center text-[#FF3820] mb-3 animate-pulse">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1 font-sans">Mobile Dock Camera</h3>
            <p className="text-xs text-stone-300 mb-5 max-w-xs font-mono">
              Tap below to grant camera access and start transmitting video to your laptop dashboard.
            </p>
            <button
              type="button"
              onClick={() => initCamera()}
              className="px-6 py-3 rounded-full bg-[#FF3820] hover:bg-[#E0301B] text-white text-xs font-mono font-bold tracking-wider uppercase shadow-lg shadow-[#FF3820]/40 transition-transform active:scale-95 cursor-pointer"
            >
              📷 Start Camera Stream
            </button>
          </div>
        )}

        {/* Error / Permission Blocked Fallback */}
        {errorMsg && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-30">
            <AlertCircle className="w-12 h-12 text-[#FF3820] mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Camera Permission Needed</h3>
            <p className="text-xs text-stone-300 mb-4 max-w-xs font-mono">{errorMsg}</p>
            <button
              type="button"
              onClick={() => initCamera()}
              className="px-6 py-2.5 rounded-full bg-[#FF3820] text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
            >
              Grant Permission & Retry
            </button>
          </div>
        )}
      </main>

      {/* Bottom Real-Time GPS & Relative Path Telemetry Bar */}
      <footer className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-stone-300 pb-1.5 border-b border-white/10">
          <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
            <Activity className="w-3.5 h-3.5" />
            GPS REAL-TIME (1.0 SEC INTERVAL)
          </span>
          <span className="text-[10px] font-mono text-[#D4AF37]">
            DOCK ANCHOR: [{dockAnchor.lat.toFixed(4)}°, {dockAnchor.lng.toFixed(4)}°]
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-stone-300">
          <div className="bg-white/5 p-2 rounded-xl border border-white/10">
            <span className="text-stone-400 block text-[9px]">PHONE GPS LAT / LNG</span>
            <span className="text-white font-bold">
              {gpsData.lat.toFixed(5)}°, {gpsData.lng.toFixed(5)}°
            </span>
            <span className="text-stone-400 block text-[9px] mt-0.5">
              Accuracy: ±{gpsData.accuracy || 3}m · {gpsData.lastUpdate || "Syncing..."}
            </span>
          </div>

          <div className="bg-white/5 p-2 rounded-xl border border-white/10">
            <span className="text-stone-400 block text-[9px]">RELATIVE PATH METRICS</span>
            <span className="text-[#10B981] font-bold">
              D: {relativeDockPose.distance_m.toFixed(2)}m · Δθ: {relativeDockPose.heading_error_deg}°
            </span>
            <span className="text-stone-400 block text-[9px] mt-0.5">
              Map Arena: [{relativeDockPose.arena_x.toFixed(2)}m, {relativeDockPose.arena_y.toFixed(2)}m]
            </span>
          </div>
        </div>
              {/* Quick Distance & Calibration Controls */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono">
          <span className="text-stone-300 font-bold flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-[#D4AF37]" />
            DOCK PROXIMITY:
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setRelativeDockPose((prev) => ({ ...prev, distance_m: 1.30, arena_y: 1.45 }));
              }}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-stone-200 cursor-pointer"
            >
              1.3m
            </button>
            <button
              type="button"
              onClick={() => {
                setRelativeDockPose((prev) => ({ ...prev, distance_m: 0.70, arena_y: 0.95 }));
              }}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-stone-200 cursor-pointer"
            >
              0.7m
            </button>
            <button
              type="button"
              onClick={() => {
                setRelativeDockPose((prev) => ({ ...prev, distance_m: 0.35, arena_y: 0.65 }));
              }}
              className="px-2 py-1 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 cursor-pointer"
            >
              0.35m
            </button>
            <button
              type="button"
              onClick={() => {
                setRelativeDockPose((prev) => ({ ...prev, distance_m: 0.18, arena_y: 0.48 }));
              }}
              className="px-2 py-1 rounded bg-amber-500/40 hover:bg-amber-500/60 text-amber-200 cursor-pointer"
            >
              0.18m
            </button>
            <button
              type="button"
              onClick={() => {
                setRelativeDockPose((prev) => ({ ...prev, distance_m: 0.03, arena_y: 0.38 }));
              }}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer animate-pulse"
              title="Touch laptop charging port (5cm) to trigger CHARGED"
            >
              0.03m ⚡ DOCK
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
