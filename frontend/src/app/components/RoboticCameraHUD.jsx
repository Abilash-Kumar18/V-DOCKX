"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Layers,
  Settings2,
  Smartphone,
  Check,
  ExternalLink,
  HelpCircle,
  Link as LinkIcon,
  RefreshCw,
  Sliders,
  Radio,
} from "lucide-react";

export default function RoboticCameraHUD({
  distanceM = 0.65,
  lateralOffsetM = 0.02,
  headingErrorDeg = -2.1,
  isDocking = false,
  phoneFrame: propPhoneFrame = null,
  isPhoneConnected: propIsPhoneConnected = false,
  mobileGpsPose = null,
}) {
  const videoRef = useRef(null);
  const mjpegImgRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const animRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // 'environment' | 'user'
  const [cameraError, setCameraError] = useState(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [showUsbGuide, setShowUsbGuide] = useState(false);

  // Network IP Stream option (e.g. IP Webcam or DroidCam USB)
  const [streamUrl, setStreamUrl] = useState("");
  const [isUsingStreamUrl, setIsUsingStreamUrl] = useState(false);

  // Live Phone Camera Broadcast Feed (from /camera transmitter)
  const [phoneFrame, setPhoneFrame] = useState(null);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const phoneImgRef = useRef(null);

  const effectiveIsPhoneConnected = propIsPhoneConnected || isPhoneConnected;
  const effectivePhoneFrame = propPhoneFrame || phoneFrame;

  // Pre-load frame onto offscreen image when frame updates
  useEffect(() => {
    if (effectivePhoneFrame) {
      if (!phoneImgRef.current) {
        phoneImgRef.current = new Image();
      }
      phoneImgRef.current.src = effectivePhoneFrame;
      setIsCameraActive(true);
      setCameraError(null);
    }
  }, [effectivePhoneFrame]);

  // Poll for phone camera stream from /api/camera/frame if not provided by parent
  useEffect(() => {
    if (propPhoneFrame) return;

    let mounted = true;
    const pollPhoneStream = async () => {
      try {
        const res = await fetch("/api/camera/frame");
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.isFresh && data.frame) {
            setPhoneFrame(data.frame);
            setIsPhoneConnected(true);
            setIsCameraActive(true);
            setCameraError(null);

            if (!phoneImgRef.current) {
              phoneImgRef.current = new Image();
            }
            phoneImgRef.current.src = data.frame;
          } else {
            setIsPhoneConnected(false);
          }
        }
      } catch (e) {
        // network polling silence
      }
    };

    const interval = setInterval(pollPhoneStream, 70); // ~15 FPS polling
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [propPhoneFrame]);

  // Discover all connected cameras (including USB webcams, Android 14 USB Webcams, Iriun, DroidCam)
  const refreshDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn("Could not enumerate devices:", err);
    }
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  // Multi-Level Robust Camera Stream Initializer
  const startCamera = async (deviceId = selectedDeviceId, mode = facingMode) => {
    setCameraError(null);
    setIsUsingStreamUrl(false);

    // Stop any existing stream
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    let stream = null;

    // Strategy 1: Specific Device ID (e.g., USB connected Phone, Iriun, DroidCam, or selected camera)
    if (deviceId) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn("Specific device constraint failed, trying ideal mode...", err1);
      }
    }

    // Strategy 2: Ideal facingMode (non-blocking for laptops/PCs)
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err2) {
        console.warn("Ideal facingMode failed, falling back to universal video...", err2);
      }
    }

    // Strategy 3: Universal fallback { video: true }
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err3) {
        console.warn("Universal camera fallback failed:", err3);
        setCameraError(
          "Camera device not detected. Connect phone via USB in 'Webcam' mode or open via local Wi-Fi link."
        );
        setIsCameraActive(false);
        return;
      }
    }

    // Attach stream to video element
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
        setIsCameraActive(true);
        refreshDevices();
      } catch (playErr) {
        console.error("Video play error:", playErr);
      }
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsUsingStreamUrl(false);
  };

  // Connect via IP / Phone Stream URL
  const handleConnectStreamUrl = (e) => {
    if (e) e.preventDefault();
    if (!streamUrl) return;
    stopCamera();
    setIsUsingStreamUrl(true);
    setIsCameraActive(true);
    setCameraError(null);
  };

  // Flip Camera
  const flipCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isCameraActive && !isUsingStreamUrl) {
      startCamera(selectedDeviceId, nextMode);
    }
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // AR Overlay Animation Loop
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let t = 0;

    const renderOverlay = () => {
      t += 0.04;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Video Source Rendering
      if (effectiveIsPhoneConnected && phoneImgRef.current && phoneImgRef.current.complete) {
        // Draw live phone camera frame
        try {
          ctx.drawImage(phoneImgRef.current, 0, 0, w, h);
        } catch (e) {}
      } else if (!isCameraActive) {
        // Draw synthetic robotics perspective with Light Studio Background
        const horizonY = h * 0.42;

        // Light Upper Sky/Wall Plane
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "#FAF8F5");
        skyGrad.addColorStop(1, "#EFEAE1");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // Light Architectural Ground / Floor Plane
        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#E7E0D3");
        floorGrad.addColorStop(0.3, "#DFD7C8");
        floorGrad.addColorStop(1, "#D6CCB9");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, h - horizonY);

        // Perspective Floor Grid Lines
        ctx.strokeStyle = "rgba(140, 109, 49, 0.18)";
        ctx.lineWidth = 1;
        for (let gx = -4; gx <= 4; gx++) {
          ctx.beginPath();
          ctx.moveTo(w / 2 + gx * 24, horizonY);
          ctx.lineTo(w / 2 + gx * 120, h);
          ctx.stroke();
        }
      }

      if (showOverlays) {
        const horizonY = h * 0.42;

        // Proximity condition: turns bright RED when distance <= 0.45m
        const isCriticalProximity = distanceM <= 0.45;
        const isCautionProximity = !isCriticalProximity && distanceM <= 0.80;

        // Dynamic rail colors based on proximity
        const primaryRailColor = isCriticalProximity
          ? "#FF1F1F"
          : isCautionProximity
          ? "#F59E0B"
          : "#10B981";

        const primaryRailGlow = isCriticalProximity
          ? `rgba(255, 31, 31, ${0.45 + 0.3 * Math.sin(t * 8)})`
          : isCautionProximity
          ? "rgba(245, 158, 11, 0.3)"
          : "rgba(16, 185, 129, 0.25)";

        // Target Dock marker position
        const tagScale = Math.max(0.4, 1.2 - distanceM * 0.7);
        const tagW = 85 * tagScale;
        const tagH = 85 * tagScale;
        const tagX = w / 2 - tagW / 2 + lateralOffsetM * 260;
        const tagY = horizonY - tagH * 0.7;
        const tagCenterX = tagX + tagW / 2;
        const tagCenterY = tagY + tagH / 2;

        // Dynamic Steer Curvature (based on heading error and lateral displacement)
        const steerOffset = lateralOffsetM * 280 + headingErrorDeg * 2.2;

        // ============================================================
        // 1. AUTOMOTIVE DYNAMIC PARKING GUIDE LINES ("Imaginary Lines")
        // ============================================================
        const trackHalf = 175; // Half vehicle track width at bottom of camera
        const botLeftX = w / 2 - trackHalf + steerOffset * 0.3;
        const botRightX = w / 2 + trackHalf + steerOffset * 0.3;
        const botY = h;

        const topLeftX = tagCenterX - 42;
        const topRightX = tagCenterX + 42;
        const topY = horizonY + 18;

        // Curve control points for Left and Right Rails
        const midY = horizonY + (h - horizonY) * 0.48;
        const midLeftX = (botLeftX + topLeftX) / 2 + steerOffset * 0.55;
        const midRightX = (botRightX + topRightX) / 2 + steerOffset * 0.55;

        // Outer Glow Corridor (Dynamic Safe Drive Zone)
        ctx.beginPath();
        ctx.moveTo(topLeftX, topY);
        ctx.quadraticCurveTo(midLeftX, midY, botLeftX, botY);
        ctx.lineTo(botRightX, botY);
        ctx.quadraticCurveTo(midRightX, midY, topRightX, topY);
        ctx.closePath();
        ctx.fillStyle = isCriticalProximity
          ? `rgba(255, 31, 31, ${0.12 + 0.08 * Math.sin(t * 8)})`
          : isCautionProximity
          ? "rgba(245, 158, 11, 0.08)"
          : "rgba(16, 185, 129, 0.08)";
        ctx.fill();

        // Draw Left Guide Rail
        ctx.strokeStyle = primaryRailGlow;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(topLeftX, topY);
        ctx.quadraticCurveTo(midLeftX, midY, botLeftX, botY);
        ctx.stroke();

        ctx.strokeStyle = primaryRailColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(topLeftX, topY);
        ctx.quadraticCurveTo(midLeftX, midY, botLeftX, botY);
        ctx.stroke();

        // Draw Right Guide Rail
        ctx.strokeStyle = primaryRailGlow;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(topRightX, topY);
        ctx.quadraticCurveTo(midRightX, midY, botRightX, botY);
        ctx.stroke();

        ctx.strokeStyle = primaryRailColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(topRightX, topY);
        ctx.quadraticCurveTo(midRightX, midY, botRightX, botY);
        ctx.stroke();

        // ============================================================
        // 2. AUTOMOTIVE DISTANCE GATES (1.5m, 1.0m, 0.5m, STOP 0.25m)
        // ============================================================
        const distanceGates = [
          { dist: 1.5, progress: 0.18, label: "1.5m", color: "#10B981" },
          { dist: 1.0, progress: 0.40, label: "1.0m", color: "#10B981" },
          { dist: 0.5, progress: 0.70, label: "0.5m", color: "#F59E0B" },
          { dist: 0.25, progress: 0.90, label: "STOP (0.25m)", color: "#FF1F1F" },
        ];

        distanceGates.forEach((gate) => {
          const u = gate.progress;
          // Quadratic Bézier evaluation: B(u) = (1-u)^2*P0 + 2(1-u)u*P1 + u^2*P2
          const oneMinusU = 1 - u;
          const gxL = oneMinusU * oneMinusU * topLeftX + 2 * oneMinusU * u * midLeftX + u * u * botLeftX;
          const gyL = oneMinusU * oneMinusU * topY + 2 * oneMinusU * u * midY + u * u * botY;

          const gxR = oneMinusU * oneMinusU * topRightX + 2 * oneMinusU * u * midRightX + u * u * botRightX;
          const gyR = oneMinusU * oneMinusU * topY + 2 * oneMinusU * u * midY + u * u * botY;

          const isBreached = distanceM <= gate.dist;
          const gateColor = isBreached || isCriticalProximity ? "#FF1F1F" : gate.color;

          // Crossbar connecting left and right rail
          ctx.strokeStyle = gateColor;
          ctx.lineWidth = isBreached ? 3 : 2;
          ctx.beginPath();
          ctx.moveTo(gxL, gyL);
          ctx.lineTo(gxR, gyR);
          ctx.stroke();

          // Gate Hash Ticks
          ctx.beginPath();
          ctx.moveTo(gxL - 10, gyL);
          ctx.lineTo(gxL + 6, gyL);
          ctx.moveTo(gxR - 6, gyR);
          ctx.lineTo(gxR + 10, gyR);
          ctx.stroke();

          // Distance Tag
          ctx.fillStyle = gateColor;
          ctx.font = "bold 9px monospace";
          ctx.fillText(gate.label, gxR + 14, gyR + 3);
        });

        // ============================================================
        // 3. DYNAMIC SHORTEST REROUTING PATH LINE
        // ============================================================
        // When approaching or navigating, calculates the next shortest collision-free path line!
        const pathStartX = w / 2;
        const pathStartY = h - 10;
        const pathEndX = tagCenterX;
        const pathEndY = tagCenterY + tagH / 2;
        const pathMidX = (pathStartX + pathEndX) / 2 + (isCriticalProximity ? (lateralOffsetM * 120) : 0);
        const pathMidY = (pathStartY + pathEndY) / 2;

        if (isCriticalProximity) {
          // In critical proximity, draw the dynamic recalculated shortest recovery spline in neon cyan/white!
          ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(pathStartX, pathStartY);
          ctx.quadraticCurveTo(pathMidX + 25, pathMidY, pathEndX, pathEndY);
          ctx.stroke();

          // Recalculated Shortest Path Line
          ctx.strokeStyle = "#06B6D4";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pathStartX, pathStartY);
          ctx.quadraticCurveTo(pathMidX + 25, pathMidY, pathEndX, pathEndY);
          ctx.stroke();

          // Flowing directional pulse along the shortest reroute
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.lineDashOffset = -t * 22;
          ctx.beginPath();
          ctx.moveTo(pathStartX, pathStartY);
          ctx.quadraticCurveTo(pathMidX + 25, pathMidY, pathEndX, pathEndY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Waypoint target bead on dock
          ctx.fillStyle = "#06B6D4";
          ctx.beginPath();
          ctx.arc(pathEndX, pathEndY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Reroute Path Tag
          ctx.fillStyle = "#06B6D4";
          ctx.font = "bold 9.5px monospace";
          ctx.fillText("NEXT SHORTEST DOCK PATH [RE-MAPPED]", pathMidX + 32, pathMidY - 6);
        } else {
          // Standard center trajectory line
          ctx.strokeStyle = primaryRailColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(pathStartX, pathStartY);
          ctx.quadraticCurveTo(pathMidX, pathMidY, pathEndX, pathEndY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // ============================================================
        // 4. AUTOMOTIVE PROXIMITY ALERT BANNER (< 0.45m WARNING)
        // ============================================================
        if (isCriticalProximity) {
          const bannerW = 340;
          const bannerH = 36;
          const bannerX = w / 2 - bannerW / 2;
          const bannerY = 16;

          // Pulsing Red Warning Banner
          ctx.fillStyle = "rgba(220, 38, 38, 0.95)";
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
          ctx.fill();
          ctx.stroke();

          // Warning hazard stripes / text
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
          ctx.fillText("⚠ PROXIMITY ALERT: DOCK APPROACH < 0.45m", bannerX + 16, bannerY + 22);

          // Flashing distance readout
          ctx.font = "bold 10px monospace";
          ctx.fillStyle = "#FEF08A";
          ctx.fillText(`DIST: ${distanceM.toFixed(2)}m`, bannerX + 265, bannerY + 22);

          // Corner Proximity Hazard Brackets (like ultrasonic park assist sensors)
          ctx.strokeStyle = `rgba(255, 31, 31, ${0.6 + 0.4 * Math.sin(t * 10)})`;
          ctx.lineWidth = 3;
          // Top Left
          ctx.beginPath();
          ctx.moveTo(20, 45);
          ctx.lineTo(20, 20);
          ctx.lineTo(45, 20);
          ctx.stroke();
          // Top Right
          ctx.beginPath();
          ctx.moveTo(w - 45, 20);
          ctx.lineTo(w - 20, 20);
          ctx.lineTo(w - 20, 45);
          ctx.stroke();
          // Bottom Left
          ctx.beginPath();
          ctx.moveTo(20, h - 45);
          ctx.lineTo(20, h - 20);
          ctx.lineTo(45, h - 20);
          ctx.stroke();
          // Bottom Right
          ctx.beginPath();
          ctx.moveTo(w - 45, h - 20);
          ctx.lineTo(w - 20, h - 20);
          ctx.lineTo(w - 20, h - 45);
          ctx.stroke();
        }

        // ============================================================
        // 5. STATION APRILTAG DOCKING MARKER & 3D AXES
        // ============================================================
        const isAligned = distanceM <= 0.18;
        ctx.strokeStyle = isAligned ? "#10B981" : isCriticalProximity ? "#FF1F1F" : "#8C6D31";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(tagX, tagY, tagW, tagH);

        const markerX = tagX + tagW / 2;
        const markerY = tagY + tagH / 2;

        // 3D Coordinates Axes
        ctx.strokeStyle = "#FF3820"; // X Axis
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(markerX, markerY);
        ctx.lineTo(markerX + tagW * 0.65, markerY);
        ctx.stroke();

        ctx.strokeStyle = "#10B981"; // Y Axis
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(markerX, markerY);
        ctx.lineTo(markerX, markerY - tagH * 0.65);
        ctx.stroke();

        ctx.strokeStyle = "#8C6D31"; // Z Axis
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(markerX, markerY);
        ctx.lineTo(markerX - tagW * 0.4, markerY + tagH * 0.4);
        ctx.stroke();

        // Target Tag Label
        ctx.fillStyle = isAligned ? "#10B981" : isCriticalProximity ? "#FF1F1F" : "#1A1715";
        ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
        ctx.fillText(
          `DOCK BAY 01 [${isAligned ? "LOCKED & ALIGNED" : isCriticalProximity ? "CRITICAL PROXIMITY" : `DIST: ${distanceM.toFixed(2)}m`}]`,
          tagX - 10,
          tagY - 8
        );

        // ============================================================
        // 6. GILDED TELEMETRY PLAQUE
        // ============================================================
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.fillRect(12, 12, 280, 52);
        ctx.strokeStyle = isCriticalProximity ? "#FF1F1F" : "#C5A059";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(12, 12, 280, 52);

        // Vermillion Accent Strip on Left
        ctx.fillStyle = isCriticalProximity ? "#FF1F1F" : "#FF3820";
        ctx.fillRect(12, 12, 4, 52);

        ctx.fillStyle = "#1A1715";
        ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
        ctx.fillText(
          `${
            effectiveIsPhoneConnected
              ? "PHONE CAMERA [LIVE GPS SYNC]"
              : isUsingStreamUrl
              ? "IP CAMERA STREAM"
              : isCameraActive
              ? "WEBCAM [LIVE]"
              : "SIMULATED ENVIRONMENT"
          }`,
          24,
          28
        );
        ctx.fillStyle = isCriticalProximity ? "#DC2626" : "#78716C";
        ctx.font = "bold 10px monospace";
        ctx.fillText(
          `Dist: ${distanceM.toFixed(2)}m | Off: ${(lateralOffsetM * 100).toFixed(1)}cm | Hdg: ${headingErrorDeg}°`,
          24,
          44
        );
        if (effectiveIsPhoneConnected && mobileGpsPose?.lat) {
          ctx.fillStyle = "#8C6D31";
          ctx.font = "8.5px monospace";
          ctx.fillText(`GPS: ${mobileGpsPose.lat.toFixed(4)}°, ${mobileGpsPose.lng.toFixed(4)}°`, 24, 58);
        }
      }

      animRef.current = requestAnimationFrame(renderOverlay);
    };

    renderOverlay();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [
    isCameraActive,
    isUsingStreamUrl,
    showOverlays,
    distanceM,
    lateralOffsetM,
    headingErrorDeg,
    effectiveIsPhoneConnected,
    effectivePhoneFrame,
    mobileGpsPose,
  ]);

  return (
    <div className="flex flex-col h-full frame-gilded overflow-hidden shadow-xl bg-white">
      {/* Top Camera Controls Bar - Clean, Clear Modern Typography */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#C5A059]/30 bg-[#FAF7F2]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isCameraActive
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"
                : "bg-[#FF3820] shadow-[0_0_8px_rgba(255,56,32,0.8)]"
            }`}
          />
          <span className="text-xs font-sans font-bold text-[#1A1715] tracking-wide">
            Robotic Vision Camera
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Optical Link */}
          {isPhoneConnected ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-500/40 text-emerald-800 text-xs font-serif font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Phone Link Active</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUsbGuide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#C5A059]/40 text-[#8C6D31] hover:text-[#1A1715] hover:border-[#C5A059] text-xs font-serif font-semibold transition-colors shadow-sm"
              title="Connect mobile phone camera"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#FF3820]" />
              <span>Connect Phone</span>
            </button>
          )}

          {/* Primary Camera Toggle (Live vs Sim) */}
          {!isCameraActive ? (
            <button
              type="button"
              onClick={() => startCamera()}
              className="btn-vermillion px-3.5 py-1.5 text-xs gap-1.5 font-serif font-bold tracking-wider uppercase shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Live Camera</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="px-3.5 py-1.5 rounded-full bg-white border border-[#C5A059]/60 text-xs font-serif font-bold text-[#1A1715] hover:bg-[#FAF7F2] transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <CameraOff className="w-3.5 h-3.5 text-[#8C6D31]" />
              <span>Simulation</span>
            </button>
          )}

          {/* Minimalist Reticle Toggle */}
          <button
            type="button"
            onClick={() => setShowOverlays(!showOverlays)}
            className={`p-1.5 rounded-full border transition-colors ${
              showOverlays
                ? "bg-[#FF3820]/10 border-[#FF3820]/40 text-[#FF3820]"
                : "bg-white border-[#C5A059]/30 text-[#8C6D31] hover:bg-[#FAF7F2]"
            }`}
            title="Toggle AR Reticles"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 min-h-[300px] w-full bg-[#FAF7F2] overflow-hidden flex items-center justify-center">
        {/* Real Live HTML5 Video Element from Phone / Webcam */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isCameraActive && !isUsingStreamUrl ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* IP Phone Stream View (if using IP Webcam URL) */}
        {isUsingStreamUrl && streamUrl && (
          <img
            ref={mjpegImgRef}
            src={streamUrl}
            alt="IP Camera Stream"
            className="absolute inset-0 w-full h-full object-cover z-0"
            onError={() => {
              setCameraError("Failed to connect to IP camera stream URL.");
              setIsUsingStreamUrl(false);
            }}
          />
        )}

        {/* Live AR Canvas Overlay Layer */}
        <canvas
          ref={overlayCanvasRef}
          width={800}
          height={500}
          className="relative z-10 w-full h-full object-cover"
        />

        {/* Camera Warning Banner */}
        {cameraError && (
          <div className="absolute top-4 inset-x-4 z-20 p-3 rounded-xl bg-white/95 border-2 border-[#FF3820]/40 text-[#1A1715] text-xs text-center backdrop-blur-md shadow-xl flex flex-col items-center gap-2">
            <div>{cameraError}</div>
            <button
              type="button"
              onClick={() => setShowUsbGuide(true)}
              className="btn-vermillion px-3 py-1 text-[11px] gap-1.5"
            >
              <Smartphone className="w-3 h-3" />
              <span>Open USB & Phone Connection Guide</span>
            </button>
          </div>
        )}
      </div>

      {/* USB & Phone Camera Connection Guide Modal */}
      {showUsbGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border-2 border-[#C5A059]/40 text-[#1A1715]">
            <div className="flex items-center justify-between pb-3 border-b border-[#C5A059]/30 mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#FF3820]" />
                <h3 className="text-base font-serif font-bold text-[#1A1715]">
                  Connect Phone Camera (USB or Wi-Fi)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUsbGuide(false)}
                className="w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFE6] border border-[#C5A059]/40 text-[#1A1715] flex items-center justify-center text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#78716C]">
              {/* Method 1: Android USB Webcam */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#C5A059]/40">
                <div className="font-serif font-bold text-[#1A1715] text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#FF3820] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                    1
                  </span>
                  Android USB Webcam Mode (Zero-Install)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[#78716C] pl-1 mt-2 font-serif">
                  <li>Plug your phone into your PC via the USB cable.</li>
                  <li>
                    On your phone, swipe down notifications and tap{" "}
                    <strong>&ldquo;Charging this device via USB&rdquo;</strong>.
                  </li>
                  <li>
                    Select <strong>&ldquo;Webcam&rdquo;</strong>.
                  </li>
                  <li>
                    Click &ldquo;Refresh Devices&rdquo; below, and select your phone from the camera dropdown!
                  </li>
                </ol>
                <button
                  type="button"
                  onClick={async () => {
                    await refreshDevices();
                    startCamera();
                    setShowUsbGuide(false);
                  }}
                  className="btn-vermillion mt-3 px-3.5 py-1.5 text-xs gap-1.5 shadow-sm uppercase tracking-wider font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh & Connect Webcam</span>
                </button>
              </div>

              {/* Method 2: Open Directly on Phone via Local Link */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#C5A059]/30">
                <div className="font-serif font-bold text-[#1A1715] text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#8C6D31] text-white flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  Open on Phone via Wi-Fi / USB Tethering
                </div>
                <p className="mt-1 text-[#78716C]">
                  Open this link in Chrome on your phone (connected to same Wi-Fi or USB tethering):
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-white border border-[#C5A059]/40 font-mono text-[#FF3820] font-bold text-xs flex items-center justify-between select-all">
                  <span>http://192.168.76.15:3000/camera</span>
                </div>
                <p className="text-[10px] text-[#8C6D31] mt-1.5 leading-relaxed font-serif">
                  Your phone will instantly open its back camera and transmit live video straight into this Forward Robotic Vision HUD on your PC!
                </p>
              </div>

              {/* Method 3: IP Webcam Stream URL */}
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#C5A059]/30">
                <div className="font-serif font-bold text-[#1A1715] text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#8C6D31] text-white flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  IP Camera / DroidCam Stream URL
                </div>
                <p className="mt-1 text-[#78716C]">
                  If you run an IP camera app (e.g. DroidCam or IP Webcam), enter the stream URL:
                </p>
                <form onSubmit={handleConnectStreamUrl} className="flex gap-2 mt-2">
                  <input
                    type="url"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="http://192.168.137.X:8080/video"
                    className="flex-1 input-gallery py-1.5 text-xs font-mono"
                  />
                  <button type="submit" className="btn-vermillion px-3.5 py-1.5 text-xs whitespace-nowrap uppercase font-bold">
                    Connect
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setShowUsbGuide(false)}
                className="px-4 py-2 rounded-full bg-[#FAF7F2] border border-[#C5A059]/50 hover:bg-[#F4EFE6] text-[#1A1715] text-xs font-serif font-bold transition-colors shadow-sm"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
