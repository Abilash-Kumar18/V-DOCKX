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
  Footprints,
  Gauge,
  CheckCircle2,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Power,
  Sliders,
  Maximize2,
  Crosshair,
} from "lucide-react";

export default function MobileCameraPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const holdTimerRef = useRef(null);

  // Activation & Connection States
  const [isActivated, setIsActivated] = useState(true);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [fps, setFps] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [packetCount, setPacketCount] = useState(0);
  const [isPcConnected, setIsPcConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("split"); // "split" | "radar" | "hud"

  // Motion Sensor Sensitivity
  const [motionSensitivity, setMotionSensitivity] = useState("high"); // "high" | "normal" | "low"
  const [motionState, setMotionState] = useState({
    isMoving: false,
    speedMps: 0.0,
    accelMagnitude: 0.0,
    surge: 0.0,
    sensorActive: false,
    stepCount: 0,
  });

  // Mobile Orientation (0 deg = North/Dock, 90 deg = East/Right, -90 deg = West/Left, 180 deg = South/Back)
  const [compassHeading, setCompassHeading] = useState(0);
  const [tiltPitch, setTiltPitch] = useState(0);
  const [tiltRoll, setTiltRoll] = useState(0);
  const zeroHeadingOffsetRef = useRef(0);

  // Normalized 2D Arena Coordinates (meters: x: 0.12m - 1.88m, y: 0.20m - 1.88m)
  // Default start entrance: x = 1.15m, y = 1.65m
  const [arenaPose, setArenaPose] = useState({ x: 1.15, y: 1.65 });
  const arenaPoseRef = useRef({ x: 1.15, y: 1.65 });
  const compassHeadingRef = useRef(0);
  const tiltPitchRef = useRef(0);
  const tiltRollRef = useRef(0);
  const motionStateRef = useRef(motionState);

  // Destination Dock Anchor
  const [targetDock, setTargetDock] = useState({ x: 1.0, y: 0.35 });
  const targetDockRef = useRef({ x: 1.0, y: 0.35 });
  const distToDock = Math.hypot(arenaPose.x - targetDock.x, arenaPose.y - targetDock.y);
  const isInChargingGate = distToDock <= 0.25;

  // Battery charging state when docked
  const [batteryPct, setBatteryPct] = useState(84);
  const [isUndockedManual, setIsUndockedManual] = useState(false);

  // Gravity isolation & velocity integration
  const gravityRef = useRef({ x: 0, y: 0, z: 9.8 });
  const velocityRef = useRef(0.0);
  const lastMotionTsRef = useRef(Date.now());
  const isTransmittingRef = useRef(false);

  // Fixed 2D arena obstacle hazard zones
  const obstacleZones = [
    { x: 0.35, y: 0.95, radius: 0.18, label: "A" },
    { x: 1.65, y: 1.15, radius: 0.18, label: "B" },
  ];

  // Keep references synced
  useEffect(() => {
    arenaPoseRef.current = arenaPose;
  }, [arenaPose]);

  useEffect(() => {
    compassHeadingRef.current = compassHeading;
  }, [compassHeading]);

  useEffect(() => {
    tiltPitchRef.current = tiltPitch;
    tiltRollRef.current = tiltRoll;
  }, [tiltPitch, tiltRoll]);

  useEffect(() => {
    motionStateRef.current = motionState;
  }, [motionState]);

  useEffect(() => {
    targetDockRef.current = targetDock;
  }, [targetDock]);

  // Battery charging increment loop when docked
  useEffect(() => {
    if (isInChargingGate && !isUndockedManual) {
      const timer = setInterval(() => {
        setBatteryPct((b) => Math.min(100, b + 1));
      }, 900);
      return () => clearInterval(timer);
    }
  }, [isInChargingGate, isUndockedManual]);

  useEffect(() => {
    if (distToDock > 0.32) {
      setIsUndockedManual(false);
    }
  }, [distToDock]);

  // Haptic feedback helper
  const triggerHaptic = (pattern = 25) => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(pattern);
      } catch (_) {}
    }
  };

  // 1. Phone Camera Streaming Initializer
  const initCamera = async (mode = facingMode) => {
    setErrorMsg(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg("HTTP Notice: Chrome restricts camera to HTTPS. Live 6-DoF sensor tracking & PC sync are running!");
        setIsCameraActive(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 480 },
          height: { ideal: 360 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setErrorMsg(null);
        triggerHaptic(40);
      }
    } catch (err) {
      console.warn("Camera init notice:", err.message);
      setErrorMsg("Camera access blocked by browser. Operating in high-precision Sensor & HUD mode.");
      setIsCameraActive(false);
    }
  };

  const handleFlipCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    initCamera(nextMode);
    triggerHaptic(30);
  };

  // 2. Calibrate Forward Orientation (Zero Heading)
  const handleCalibrateForward = () => {
    triggerHaptic([30, 40, 60]);
    const currentRaw = compassHeadingRef.current + zeroHeadingOffsetRef.current;
    zeroHeadingOffsetRef.current = currentRaw;
    setCompassHeading(0);
    compassHeadingRef.current = 0;
    transmitTelemetry(arenaPoseRef.current, { ...motionStateRef.current, isMoving: false }, 0);
  };

  // 3. Inertial Motion Sensor Listener (`devicemotion`)
  const handleDeviceMotion = useCallback(
    (event) => {
      const now = Date.now();
      const dt = Math.max(0.02, Math.min(0.2, (now - lastMotionTsRef.current) / 1000));
      lastMotionTsRef.current = now;

      let linX = 0;
      let linY = 0;
      let linZ = 0;

      if (
        event.acceleration &&
        (event.acceleration.x !== null || event.acceleration.y !== null || event.acceleration.z !== null)
      ) {
        linX = event.acceleration.x || 0;
        linY = event.acceleration.y || 0;
        linZ = event.acceleration.z || 0;
      } else if (event.accelerationIncludingGravity) {
        const rawX = event.accelerationIncludingGravity.x || 0;
        const rawY = event.accelerationIncludingGravity.y || 0;
        const rawZ = event.accelerationIncludingGravity.z || 0;

        const alpha = 0.82;
        gravityRef.current.x = alpha * gravityRef.current.x + (1 - alpha) * rawX;
        gravityRef.current.y = alpha * gravityRef.current.y + (1 - alpha) * rawY;
        gravityRef.current.z = alpha * gravityRef.current.z + (1 - alpha) * rawZ;

        linX = rawX - gravityRef.current.x;
        linY = rawY - gravityRef.current.y;
        linZ = rawZ - gravityRef.current.z;
      }

      const mag = Math.sqrt(linX * linX + linY * linY + linZ * linZ);
      const accelMagnitude = Number(mag.toFixed(2));

      const threshold =
        motionSensitivity === "high" ? 0.22 : motionSensitivity === "normal" ? 0.38 : 0.60;

      const isMoving = mag > threshold;

      // Dynamic tilt-to-steer (roll smoothly turns the robot left/right)
      if (Math.abs(tiltRollRef.current) > 12) {
        const rollRate = (tiltRollRef.current > 0 ? 1 : -1) * Math.min(35, (Math.abs(tiltRollRef.current) - 12) * 1.5);
        setCompassHeading((prev) => {
          let next = Math.round(prev + rollRate * dt);
          if (next > 180) next -= 360;
          if (next < -180) next += 360;
          return next;
        });
      }

      if (isMoving) {
        const accelDelta = (mag - threshold) * (motionSensitivity === "high" ? 0.70 : 0.50);
        const rawVel = velocityRef.current + accelDelta * dt;
        velocityRef.current = Math.min(0.75, Math.max(0.08, rawVel));

        // Advance coordinates along calibrated heading:
        // 0 deg = North/Dock (-dy), 90 deg = East/Right (+dx), -90 deg = West/Left (-dx)
        const headingRad = (compassHeadingRef.current * Math.PI) / 180;
        const stepDist = velocityRef.current * dt;
        const dx = Math.sin(headingRad) * stepDist;
        const dy = -Math.cos(headingRad) * stepDist;

        setArenaPose((prev) => ({
          x: Math.max(0.12, Math.min(1.88, Number((prev.x + dx).toFixed(3)))),
          y: Math.max(0.20, Math.min(1.88, Number((prev.y + dy).toFixed(3)))),
        }));

        setMotionState((prev) => ({
          isMoving: true,
          speedMps: Number(velocityRef.current.toFixed(2)),
          accelMagnitude,
          surge: Number(linZ.toFixed(2)),
          sensorActive: true,
          stepCount: prev.stepCount + 1,
        }));
      } else {
        velocityRef.current *= 0.80;
        if (velocityRef.current < 0.02) velocityRef.current = 0.0;

        setMotionState((prev) => ({
          ...prev,
          isMoving: false,
          speedMps: 0.0,
          accelMagnitude,
          sensorActive: true,
        }));
      }
    },
    [motionSensitivity]
  );

  // 4. Device Orientation Listener
  const handleDeviceOrientation = useCallback((e) => {
    let rawHeading = 0;
    if (typeof e.webkitCompassHeading === "number") {
      rawHeading = e.webkitCompassHeading;
    } else if (e.alpha !== null) {
      rawHeading = 360 - e.alpha;
    }

    let calibrated = Math.round(rawHeading - zeroHeadingOffsetRef.current);
    calibrated = ((calibrated + 180) % 360) - 180;
    setCompassHeading(calibrated);

    if (e.beta !== null) setTiltPitch(Math.round(e.beta));
    if (e.gamma !== null) setTiltRoll(Math.round(e.gamma));
  }, []);

  // One-touch user activation handler
  const activateSensorsAndCamera = async () => {
    triggerHaptic(40);
    setIsActivated(true); // Dismisses setup modal immediately!

    // iOS 13+ sensor permissions
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        const motionPerm = await DeviceMotionEvent.requestPermission();
        if (motionPerm === "granted") {
          window.addEventListener("devicemotion", handleDeviceMotion, true);
        }
      } catch (e) {
        console.warn("Motion permission rejected:", e);
      }
    } else {
      window.addEventListener("devicemotion", handleDeviceMotion, true);
    }

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      try {
        const orientPerm = await DeviceOrientationEvent.requestPermission();
        if (orientPerm === "granted") {
          window.addEventListener("deviceorientation", handleDeviceOrientation, true);
        }
      } catch (e) {
        console.warn("Orientation permission rejected:", e);
      }
    } else {
      window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    }

    setMotionState((prev) => ({ ...prev, sensorActive: true }));
    await initCamera();
  };

  useEffect(() => {
    // Attempt auto-activation for non-iOS browsers
    if (typeof DeviceMotionEvent === "undefined" || typeof DeviceMotionEvent.requestPermission !== "function") {
      window.addEventListener("devicemotion", handleDeviceMotion, true);
      window.addEventListener("deviceorientation", handleDeviceOrientation, true);
      setMotionState((prev) => ({ ...prev, sensorActive: true }));
    }

    return () => {
      window.removeEventListener("devicemotion", handleDeviceMotion, true);
      window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
    };
  }, [handleDeviceMotion, handleDeviceOrientation]);

  // 5. High-Frequency Telemetry & Camera Frame Dispatcher
  const transmitTelemetry = async (overridePose = null, overrideMotion = null, overrideHeading = null) => {
    if (isTransmittingRef.current) return;
    isTransmittingRef.current = true;

    const currentPose = overridePose || arenaPoseRef.current;
    const currentMotion = overrideMotion || motionStateRef.current;
    const currentHeading = overrideHeading !== null ? overrideHeading : compassHeadingRef.current;

    let frameDataUrl = null;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Grab frame from live camera if ready
    if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
      try {
        const ctx = canvas.getContext("2d");
        const w = 400;
        const h = Math.floor((video.videoHeight / video.videoWidth) * w) || 300;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        frameDataUrl = canvas.toDataURL("image/jpeg", 0.45);
      } catch (_) {}
    } else if (canvas) {
      // Light studio synthetic perspective frame matching the PC luxury theme
      try {
        const ctx = canvas.getContext("2d");
        const w = 400;
        const h = 300;
        canvas.width = w;
        canvas.height = h;

        // Warm architectural cream background
        ctx.fillStyle = "#FAF7F2";
        ctx.fillRect(0, 0, w, h);

        const pitchOffset = tiltPitchRef.current * 1.5;
        const rollRad = (tiltRollRef.current * Math.PI) / 180;
        const midY = h * 0.45 + pitchOffset;

        ctx.save();
        ctx.translate(w / 2, midY);
        ctx.rotate(rollRad);

        // Ground floor gradient
        const floorGrad = ctx.createLinearGradient(0, 0, 0, h - midY);
        floorGrad.addColorStop(0, "#EFEAE1");
        floorGrad.addColorStop(1, "#DFD7C8");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(-w, 0, w * 2, h);

        // Horizon bar
        ctx.strokeStyle = "#C5A059";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-140, 0);
        ctx.lineTo(140, 0);
        ctx.stroke();

        ctx.restore();

        // Aiming Crosshairs
        ctx.strokeStyle = "rgba(255, 56, 32, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 20, h / 2);
        ctx.lineTo(w / 2 + 20, h / 2);
        ctx.moveTo(w / 2, h / 2 - 20);
        ctx.lineTo(w / 2 + 20, h / 2);
        ctx.stroke();

        // Architectural Telemetry Stamp
        ctx.fillStyle = "#1A1715";
        ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
        ctx.fillText(`PHONE ROBOT [LIVE TELEMETRY & CV]`, 16, 24);
        ctx.fillStyle = "#8C6D31";
        ctx.font = "bold 9.5px monospace";
        ctx.fillText(
          `Pose: [${currentPose.x.toFixed(2)}m, ${currentPose.y.toFixed(2)}m] | Hdg: ${currentHeading}°`,
          16,
          40
        );

        frameDataUrl = canvas.toDataURL("image/jpeg", 0.42);
      } catch (_) {}
    }

    const payload = {
      frame: frameDataUrl,
      pose: {
        x: currentPose.x,
        y: currentPose.y,
        heading: currentHeading,
        pitch: tiltPitchRef.current,
        roll: tiltRollRef.current,
        lat: 42.3601,
        lng: -71.0589,
        isGpsActive: true,
      },
      motion: {
        isMoving: currentMotion.isMoving,
        speedMps: currentMotion.speedMps,
        accel: currentMotion.accelMagnitude,
        surge: currentMotion.surge,
        sensorActive: currentMotion.sensorActive,
      },
    };

    try {
      // 1. Send to Next.js video broadcaster
      const res = await fetch("/api/camera/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsPcConnected(true);
        setPacketCount((p) => p + 1);
        const json = await res.json();
        if (
          json.destination &&
          typeof json.destination.x === "number" &&
          (Math.abs(json.destination.x - targetDockRef.current.x) > 0.02 ||
            Math.abs(json.destination.y - targetDockRef.current.y) > 0.02)
        ) {
          targetDockRef.current = json.destination;
          setTargetDock(json.destination);
        }
      }

      // 2. Direct LAN sync to FastAPI backend
      if (typeof window !== "undefined" && window.location.hostname) {
        try {
          fetch(`http://${window.location.hostname}:8000/api/robot/motion`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pose: payload.pose,
              motion: payload.motion,
            }),
          }).catch(() => {});
        } catch (_) {}
      }
    } catch (err) {
      console.warn("Telemetry transmission silence:", err);
    } finally {
      isTransmittingRef.current = false;
    }
  };

  // 6. Steady 16 Hz Telemetry Transmission Loop (Mounts once with empty dependency array)
  useEffect(() => {
    let frameCount = 0;
    let lastFpsTime = Date.now();

    const interval = setInterval(async () => {
      await transmitTelemetry();
      frameCount++;

      const now = Date.now();
      if (now - lastFpsTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastFpsTime = now;
      }
    }, 65); // ~15-16 Hz broadcast

    return () => clearInterval(interval);
  }, []); // Run steadily without restarting on state changes!

  // 7. Direct Arena Kinematic Controls: Moves immediately to that exact side
  const handleDirectionMove = (direction) => {
    triggerHaptic(20);

    let newX = arenaPoseRef.current.x;
    let newY = arenaPoseRef.current.y;
    let newHeading = compassHeadingRef.current;
    let isMoving = true;

    const step = 0.09; // 9 cm per nudge

    switch (direction) {
      case "forward":
        // Move UP towards Destination Dock
        newY = Math.max(0.20, newY - step);
        newHeading = 0;
        break;
      case "back":
        // Move DOWN away from Dock
        newY = Math.min(1.88, newY + step);
        newHeading = 180;
        break;
      case "left":
        // Move LEFT towards left wall
        newX = Math.max(0.12, newX - step);
        newHeading = -90;
        break;
      case "right":
        // Move RIGHT towards right wall
        newX = Math.min(1.88, newX + step);
        newHeading = 90;
        break;
      case "turn_left":
        newHeading -= 15;
        if (newHeading < -180) newHeading += 360;
        break;
      case "turn_right":
        newHeading += 15;
        if (newHeading > 180) newHeading -= 360;
        break;
      case "stop":
        isMoving = false;
        velocityRef.current = 0.0;
        break;
      default:
        break;
    }

    setCompassHeading(newHeading);

    const newPose = {
      x: Number(newX.toFixed(3)),
      y: Number(newY.toFixed(3)),
    };

    const newMotion = {
      isMoving,
      speedMps: isMoving ? 0.22 : 0.0,
      accelMagnitude: isMoving ? 0.42 : 0.0,
      surge: direction === "forward" ? 0.35 : direction === "back" ? -0.35 : 0.0,
      sensorActive: true,
      stepCount: motionState.stepCount + (isMoving ? 1 : 0),
    };

    setArenaPose(newPose);
    setMotionState(newMotion);

    // Immediately transmit to PC without waiting for timer
    transmitTelemetry(
      { ...newPose, heading: newHeading },
      newMotion,
      newHeading
    );

    if (direction !== "stop") {
      setTimeout(() => {
        setMotionState((prev) => ({ ...prev, isMoving: false, speedMps: 0.0 }));
      }, 320);
    }
  };

  // Continuous hold support for directional buttons
  const startHoldingDirection = (dir) => {
    handleDirectionMove(dir);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    holdTimerRef.current = setInterval(() => {
      handleDirectionMove(dir);
    }, 110);
  };

  const stopHoldingDirection = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleResetPose = () => {
    triggerHaptic(40);
    const startPose = { x: 1.15, y: 1.65 };
    setArenaPose(startPose);
    setCompassHeading(0);
    setIsUndockedManual(false);
    transmitTelemetry({ ...startPose, heading: 0 }, null, 0);
  };

  const handleUndock = () => {
    triggerHaptic(50);
    setIsUndockedManual(true);
    // Back out 25 cm from dock
    const newY = Math.min(1.88, arenaPose.y + 0.25);
    const newPose = { ...arenaPose, y: newY };
    setArenaPose(newPose);
    transmitTelemetry(newPose);
  };

  const showChargingScreen = isInChargingGate && !isUndockedManual;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1A1715] flex flex-col justify-between p-3 select-none touch-manipulation font-sans">
      {/* Hidden processing canvases and camera video element */}
      <video ref={videoRef} playsInline muted autoPlay className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* ============================================================
          1. FULL-SCREEN LIGHT & ELEGANT CHARGING CELEBRATION DISPLAY
          ============================================================ */}
      {showChargingScreen ? (
        <div className="fixed inset-0 z-50 bg-[#FAF7F2]/95 backdrop-blur-2xl flex flex-col justify-between p-6 animate-in fade-in zoom-in duration-300">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-500/40 flex items-center justify-center text-emerald-600 shadow-sm">
                <Zap className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-800 tracking-wider uppercase block">
                  TERMINAL DOCKED
                </span>
                <span className="text-[10px] font-mono text-stone-500">
                  Autonomous Docking Complete
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-mono font-bold border border-emerald-500/40 shadow-xs">
              RAPID DC ⚡
            </span>
          </div>

          {/* Central Battery Charging Graphic */}
          <div className="flex flex-col items-center justify-center my-auto space-y-6">
            {/* Elegant 3D Glass Battery Container */}
            <div className="relative w-44 h-72 rounded-3xl border-4 border-emerald-500 bg-white p-3 flex flex-col justify-end shadow-[0_10px_35px_rgba(16,185,129,0.25)]">
              {/* Battery Terminal Tip */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-14 h-3.5 rounded-t-lg bg-emerald-500 border-2 border-emerald-400 shadow-sm" />

              {/* Animated Liquid Charge Fill */}
              <div
                className="w-full rounded-2xl bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 transition-all duration-700 shadow-md flex items-center justify-center"
                style={{ height: `${batteryPct}%` }}
              >
                <Zap className="w-10 h-10 text-white animate-pulse" />
              </div>

              {/* Percentage Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black font-mono text-stone-900 drop-shadow-sm">
                  {batteryPct}%
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-widest mt-1 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-200">
                  CHARGING ACTIVE
                </span>
              </div>
            </div>

            {/* Electrical Metrology Specs */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs text-center font-mono">
              <div className="p-2.5 rounded-xl bg-white border border-[#C5A059]/30 shadow-xs">
                <span className="text-[9px] text-stone-500 block uppercase font-sans">CHARGE RATE</span>
                <span className="text-sm font-bold text-emerald-700">48.4V • 24.2A</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#C5A059]/30 shadow-xs">
                <span className="text-[9px] text-stone-500 block uppercase font-sans">TERMINAL LOCK</span>
                <span className="text-sm font-bold text-stone-800">LOCKED (±1cm)</span>
              </div>
            </div>
          </div>

          {/* Undock Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleUndock}
              className="w-full py-3.5 rounded-2xl bg-[#FF3820] hover:bg-[#FF3820]/90 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-md active:scale-95 transition-transform"
            >
              Undock & Resume Navigation
            </button>
            <p className="text-center text-[10px] font-mono text-stone-500">
              Robot successfully aligned and docked at station terminal
            </p>
          </div>
        </div>
      ) : null}

      {/* ============================================================
          TOP STATUS BAR & CONNECTIVITY (LIGHT & ELEGANT LUXURY THEME)
          ============================================================ */}
      <header className="flex items-center justify-between p-3 rounded-2xl bg-white/85 backdrop-blur-md border border-[#C5A059]/35 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isInChargingGate
                ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.7)] animate-pulse"
                : isPcConnected
                ? "bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                : "bg-stone-200 text-stone-600"
            }`}
          >
            {isInChargingGate ? <Zap className="w-4 h-4 text-white" /> : <Radio className="w-4 h-4 text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight text-[#1A1715]">V-DOCKX MOBILE</span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border ${
                  isInChargingGate
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : isPcConnected
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                }`}
              >
                {isInChargingGate ? "DOCKED ⚡" : isPcConnected ? "PC SYNCED" : "ACTIVE 🟢"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-600 mt-0.5">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                {fps || 16} FPS
              </span>
              <span>•</span>
              <span>[{arenaPose.x.toFixed(2)}m, {arenaPose.y.toFixed(2)}m]</span>
              <span>•</span>
              <span className="text-[#8C6D31] font-bold">{compassHeading}°</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCalibrateForward}
            className="px-2.5 py-1.5 rounded-xl bg-white border border-[#C5A059]/40 text-xs font-mono font-bold text-[#8C6D31] hover:bg-[#FAF7F2] active:scale-95 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
            title="Calibrate Current Direction as Forward (0 deg)"
          >
            <Compass className="w-3.5 h-3.5 text-[#C5A059]" />
            <span className="text-[10px]">SET FWD</span>
          </button>

          {isCameraActive && (
            <button
              type="button"
              onClick={handleFlipCamera}
              className="p-2 rounded-xl bg-white border border-[#C5A059]/40 text-stone-700 hover:bg-[#FAF7F2] active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Flip Camera"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="p-2 rounded-xl bg-white border border-[#C5A059]/40 text-stone-700 hover:bg-[#FAF7F2] active:scale-95 transition-all shadow-2xs cursor-pointer"
            title="Setup Guide & Camera Instructions"
          >
            <AlertCircle className="w-3.5 h-3.5 text-[#C5A059]" />
          </button>
        </div>
      </header>

      {/* Dismissible Informational Notice Banner */}
      {errorMsg && (
        <div className="my-1 p-2 rounded-xl bg-amber-50/90 border border-amber-300 text-stone-800 text-[10px] flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-sans leading-tight text-amber-900">{errorMsg}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold cursor-pointer hover:bg-amber-300 text-[9.5px]"
            >
              Help
            </button>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 font-bold cursor-pointer hover:bg-stone-300 text-[9.5px]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          VIEWPORT MODE SELECTOR CAPSULE
          ============================================================ */}
      <div className="flex items-center justify-center my-1.5">
        <div className="flex items-center bg-[#EFE9DF]/70 p-1 rounded-full border border-[#C5A059]/30 text-xs font-bold font-mono">
          <button
            type="button"
            onClick={() => setActiveTab("split")}
            className={`px-3.5 py-1 rounded-full transition-all cursor-pointer ${
              activeTab === "split"
                ? "bg-[#FF3820] text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            ✦ SPLIT VIEW
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("radar")}
            className={`px-3.5 py-1 rounded-full transition-all cursor-pointer ${
              activeTab === "radar"
                ? "bg-[#FF3820] text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            ☩ RADAR ARENA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hud")}
            className={`px-3.5 py-1 rounded-full transition-all cursor-pointer ${
              activeTab === "hud"
                ? "bg-[#FF3820] text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            👁 VISION & GYRO
          </button>
        </div>
      </div>

      {/* ============================================================
          MAIN INTERACTIVE VIEWPORTS (RADAR + VISION HUD)
          ============================================================ */}
      <main className="flex-1 flex flex-col gap-2 min-h-0 relative">
        {/* 1. MINI 2D RADAR ARENA (LIGHT LUXURY CONCRETE AESTHETIC) */}
        {(activeTab === "split" || activeTab === "radar") && (
          <div
            className={`relative rounded-2xl overflow-hidden border border-[#C5A059]/40 bg-white shadow-sm flex flex-col justify-between p-3 ${
              activeTab === "split" ? "h-[195px]" : "flex-1 min-h-[300px]"
            }`}
          >
            {/* SVG Arena Vector Renderer */}
            <svg
              viewBox="0 0 200 200"
              className="absolute inset-0 w-full h-full p-2"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Warm light architectural floor grid */}
              <defs>
                <pattern id="lightArenaGrid" width="25" height="25" patternUnits="userSpaceOnUse">
                  <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(197, 160, 89, 0.18)" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="200" height="200" fill="#FAF7F2" />
              <rect width="200" height="200" fill="url(#lightArenaGrid)" />
              <rect x="2" y="2" width="196" height="196" fill="none" stroke="#1A1715" strokeWidth="2" />

              {/* Axis Reference */}
              <line x1="100" y1="2" x2="100" y2="198" stroke="rgba(197, 160, 89, 0.3)" strokeDasharray="3,3" />
              <line x1="2" y1="100" x2="198" y2="100" stroke="rgba(197, 160, 89, 0.3)" strokeDasharray="3,3" />

              {/* Obstacle Zones */}
              {obstacleZones.map((obs) => {
                const ox = obs.x * 100;
                const oy = obs.y * 100;
                const or = obs.radius * 100;
                const isNearObs = Math.hypot(arenaPose.x - obs.x, arenaPose.y - obs.y) <= obs.radius + 0.12;

                return (
                  <g key={obs.label}>
                    <circle
                      cx={ox}
                      cy={oy}
                      r={or}
                      fill={isNearObs ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.10)"}
                      stroke={isNearObs ? "#DC2626" : "rgba(220, 38, 38, 0.6)"}
                      strokeWidth={isNearObs ? "2" : "1.2"}
                    />
                    <text
                      x={ox}
                      y={oy + 3}
                      fill="#DC2626"
                      fontSize="7"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      OBS {obs.label}
                    </text>
                  </g>
                );
              })}

              {/* Destination Dock Terminal */}
              {(() => {
                const dx = targetDock.x * 100;
                const dy = targetDock.y * 100;
                return (
                  <g>
                    <circle
                      cx={dx}
                      cy={dy}
                      r={isInChargingGate ? "24" : "16"}
                      fill={isInChargingGate ? "rgba(16, 185, 129, 0.25)" : "rgba(197, 160, 89, 0.18)"}
                      stroke={isInChargingGate ? "#10B981" : "#C5A059"}
                      strokeWidth="1.5"
                      strokeDasharray={isInChargingGate ? "none" : "4,2"}
                      className={isInChargingGate ? "animate-pulse" : ""}
                    />
                    <rect
                      x={dx - 11}
                      y={dy - 9}
                      width="22"
                      height="18"
                      rx="3"
                      fill={isInChargingGate ? "#10B981" : "#1A1715"}
                      stroke={isInChargingGate ? "#34D399" : "#C5A059"}
                      strokeWidth="1.5"
                    />
                    <text
                      x={dx}
                      y={dy + 3.5}
                      fill={isInChargingGate ? "#FFFFFF" : "#C5A059"}
                      fontSize="6"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {isInChargingGate ? "⚡ DOCK" : "DOCK"}
                    </text>
                  </g>
                );
              })()}

              {/* Laser Guidance Beam connecting Robot to Destination Dock */}
              {(() => {
                const rx = arenaPose.x * 100;
                const ry = arenaPose.y * 100;
                const dx = targetDock.x * 100;
                const dy = targetDock.y * 100;
                return (
                  <line
                    x1={rx}
                    y1={ry}
                    x2={dx}
                    y2={dy}
                    stroke={isInChargingGate ? "#10B981" : "rgba(255, 56, 32, 0.6)"}
                    strokeWidth="1.8"
                    strokeDasharray="4,3"
                  />
                );
              })()}

              {/* Mobile Phone Robot Marker with Heading Nose Pointer */}
              {(() => {
                const rx = arenaPose.x * 100;
                const ry = arenaPose.y * 100;
                const headingRad = (compassHeading * Math.PI) / 180;
                const pointerX = rx + Math.sin(headingRad) * 15;
                const pointerY = ry - Math.cos(headingRad) * 15;

                return (
                  <g>
                    {/* Motion Aura */}
                    <circle
                      cx={rx}
                      cy={ry}
                      r="11"
                      fill={motionState.isMoving ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 56, 32, 0.2)"}
                      className={motionState.isMoving ? "animate-ping" : ""}
                    />
                    {/* Robot Body */}
                    <rect
                      x={rx - 8}
                      y={ry - 10}
                      width="16"
                      height="20"
                      rx="3.5"
                      fill="#FF3820"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                      transform={`rotate(${compassHeading}, ${rx}, ${ry})`}
                    />
                    {/* Heading Pointer Arrow */}
                    <line x1={rx} y1={ry} x2={pointerX} y2={pointerY} stroke="#1A1715" strokeWidth="2.5" />
                    <circle cx={pointerX} cy={pointerY} r="2.5" fill="#FF3820" stroke="#FFFFFF" strokeWidth="1" />
                  </g>
                );
              })()}
            </svg>

            {/* Top Bar Info on Radar */}
            <div className="relative z-10 flex items-center justify-between text-[10px] font-mono pointer-events-none">
              <div className="bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-[#C5A059]/40 flex items-center gap-1 text-[#FF3820] shadow-xs">
                <MapPin className="w-3 h-3" />
                <span>[{arenaPose.x.toFixed(2)}m, {arenaPose.y.toFixed(2)}m]</span>
              </div>
              <div
                className={`px-2.5 py-0.5 rounded-full font-bold border ${
                  isInChargingGate
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-sm animate-pulse"
                    : "bg-white/90 text-stone-800 border-[#C5A059]/40 shadow-xs"
                }`}
              >
                {isInChargingGate ? "⚡ DOCKED & CHARGING" : `DOCK DIST: ${distToDock.toFixed(2)}m`}
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-[9px] font-mono text-stone-600 pointer-events-none">
              <span>ARENA: 2.0m × 2.0m</span>
              <span className="text-[#8C6D31] font-bold">
                HEADING: {compassHeading}°
              </span>
            </div>
          </div>
        )}

        {/* 2. VISION & ARTIFICIAL HORIZON COCKPIT HUD */}
        {(activeTab === "split" || activeTab === "hud") && (
          <div
            className={`relative rounded-2xl overflow-hidden border border-[#C5A059]/40 bg-white shadow-sm flex items-center justify-center ${
              activeTab === "split" ? "h-[155px]" : "flex-1 min-h-[280px]"
            }`}
          >
            {/* Live Camera View if playing */}
            {isCameraActive ? (
              <video
                ref={(node) => {
                  if (node && videoRef.current && videoRef.current.srcObject) {
                    node.srcObject = videoRef.current.srcObject;
                    node.play().catch(() => {});
                  }
                }}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : (
              /* Light Studio Animated Horizon Cockpit View */
              <div className="w-full h-full relative overflow-hidden bg-gradient-to-b from-[#FAF8F5] to-[#EFEAE1] flex items-center justify-center">
                <div
                  className="absolute inset-0 transition-transform duration-75"
                  style={{
                    transform: `rotate(${tiltRoll * 0.8}deg) translateY(${tiltPitch * 1.2}px)`,
                  }}
                >
                  <div className="w-full h-[1.5px] bg-[#C5A059] absolute top-1/2 left-0 shadow-[0_0_8px_#C5A059]" />
                  <div className="w-[120px] h-[2px] bg-[#FF3820] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  <div className="w-[1.5px] h-[40px] bg-[#C5A059] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
            )}

            {/* Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3">
              <div className="flex items-center justify-between text-[10px] font-mono pointer-events-auto">
                <span className="bg-white/85 px-2.5 py-0.5 rounded-full border border-[#C5A059]/40 text-[#8C6D31] flex items-center gap-1 font-bold shadow-2xs">
                  <Compass className="w-3 h-3 text-[#C5A059]" />
                  HDG: {compassHeading}°
                </span>
                <button
                  type="button"
                  onClick={() => initCamera()}
                  className="bg-white/95 px-2.5 py-1 rounded-full border border-[#C5A059]/50 text-stone-800 text-[10px] font-bold shadow-2xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer hover:bg-[#FAF7F2]"
                >
                  <Camera className={`w-3.5 h-3.5 ${isCameraActive ? "text-emerald-600" : "text-[#FF3820]"}`} />
                  <span>{isCameraActive ? "CAM ACTIVE" : "START CAMERA"}</span>
                </button>
              </div>

              {/* Central Aiming Reticle */}
              <div className="self-center flex flex-col items-center">
                <div
                  className={`w-14 h-14 border-2 rounded-full flex items-center justify-center transition-all ${
                    isInChargingGate
                      ? "border-emerald-500 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                      : "border-dashed border-[#FF3820]/70 animate-pulse"
                  }`}
                >
                  {isInChargingGate ? (
                    <Zap className="w-6 h-6 text-emerald-600 animate-bounce" />
                  ) : (
                    <div className="w-2.5 h-2.5 bg-[#FF3820] rounded-full" />
                  )}
                </div>
                <span className="text-[9px] font-mono font-bold mt-1 bg-white/90 px-2 py-0.5 rounded-full text-stone-800 border border-[#C5A059]/30 shadow-2xs">
                  {isInChargingGate ? "CHARGING TERMINAL LOCKED" : `GATE: ${(distToDock * 100).toFixed(0)}cm`}
                </span>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-stone-700 font-bold">
                <span className="bg-white/85 px-2 py-0.5 rounded-full border border-stone-200">
                  SPEED: {motionState.speedMps} m/s
                </span>
                <span className="bg-white/85 px-2 py-0.5 rounded-full border border-stone-200 text-[#FF3820]">
                  ACCEL: {motionState.accelMagnitude} m/s²
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================
          BOTTOM ERGONOMIC DIRECTIONAL CONTROLLER (LIGHT & ELEGANT)
          Moves the robot in the exact direction tapped
          ============================================================ */}
      <footer className="mt-2 space-y-1.5">
        <div className="p-3 rounded-2xl bg-white/90 backdrop-blur-md border border-[#C5A059]/35 shadow-xs">
          {/* Top Info & Mode Row */}
          <div className="flex items-center justify-between text-[10px] font-mono text-stone-600 pb-2 border-b border-stone-100">
            <div className="flex items-center gap-1">
              <span className="text-stone-500 font-bold font-sans">SENSITIVITY:</span>
              <button
                type="button"
                onClick={() => setMotionSensitivity("high")}
                className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  motionSensitivity === "high"
                    ? "bg-[#FF3820] text-white font-bold shadow-2xs"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                HIGH
              </button>
              <button
                type="button"
                onClick={() => setMotionSensitivity("normal")}
                className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                  motionSensitivity === "normal"
                    ? "bg-[#FF3820] text-white font-bold shadow-2xs"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                NORM
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCalibrateForward}
                className="px-2.5 py-0.5 rounded-full bg-[#FAF7F2] hover:bg-stone-100 text-[#8C6D31] font-bold border border-[#C5A059]/40 active:scale-95 transition-all cursor-pointer"
                title="Zero Heading"
              >
                CALIB 0°
              </button>

              <button
                type="button"
                onClick={handleResetPose}
                className="px-2.5 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold active:scale-95 transition-all cursor-pointer"
              >
                RESET
              </button>
            </div>
          </div>

          {/* Directional Teleoperation Pad: Forward, Reverse, Left, Right */}
          <div className="flex items-center justify-between pt-2.5">
            {/* Left Metrology Info */}
            <div className="space-y-1.5 text-[9px] font-mono text-stone-700">
              <div className="bg-[#FAF7F2] px-2.5 py-1 rounded-xl border border-[#C5A059]/30">
                <span className="text-stone-500 block text-[8px] uppercase font-sans">DOCK PROXIMITY</span>
                <span className={`text-xs font-bold ${isInChargingGate ? "text-emerald-600" : "text-amber-700"}`}>
                  {isInChargingGate ? "LOCKED ⚡" : `${(distToDock * 100).toFixed(0)} cm`}
                </span>
              </div>
              <div className="bg-[#FAF7F2] px-2.5 py-1 rounded-xl border border-[#C5A059]/30">
                <span className="text-stone-500 block text-[8px] uppercase font-sans">ROBOT HEADING</span>
                <span className="text-xs font-bold text-stone-800">
                  {compassHeading}° HDG
                </span>
              </div>
            </div>

            {/* Ergonomic Direct Direction D-Pad (Moves in the exact direction tapped) */}
            <div className="flex flex-col items-center gap-1.5">
              {/* Forward ▲ (Moves straight towards the dock / North) */}
              <button
                type="button"
                onPointerDown={() => startHoldingDirection("forward")}
                onPointerUp={stopHoldingDirection}
                onPointerLeave={stopHoldingDirection}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startHoldingDirection("forward");
                }}
                onTouchEnd={stopHoldingDirection}
                className="w-16 h-11 rounded-2xl bg-[#FF3820] hover:bg-[#FF3820]/90 text-white font-mono font-black text-xs shadow-md active:scale-95 transition-transform flex items-center justify-center cursor-pointer gap-1"
                title="Drive Forward Towards Dock"
              >
                <ArrowUp className="w-4 h-4 stroke-[3]" />
                <span>FWD</span>
              </button>

              {/* Middle Row: Left ◀, Brake Stop, Right ▶ */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onPointerDown={() => startHoldingDirection("left")}
                  onPointerUp={stopHoldingDirection}
                  onPointerLeave={stopHoldingDirection}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    startHoldingDirection("left");
                  }}
                  onTouchEnd={stopHoldingDirection}
                  className="w-12 h-10 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 text-stone-800 font-mono font-bold text-xs border border-[#C5A059]/40 active:scale-95 transition-transform flex items-center justify-center cursor-pointer shadow-2xs"
                  title="Move Left"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectionMove("stop")}
                  className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-100 text-[#FF3820] font-mono font-black text-[9.5px] border border-red-200 active:scale-95 transition-transform flex items-center justify-center shadow-2xs cursor-pointer"
                  title="Emergency Brake"
                >
                  STOP
                </button>

                <button
                  type="button"
                  onPointerDown={() => startHoldingDirection("right")}
                  onPointerUp={stopHoldingDirection}
                  onPointerLeave={stopHoldingDirection}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    startHoldingDirection("right");
                  }}
                  onTouchEnd={stopHoldingDirection}
                  className="w-12 h-10 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 text-stone-800 font-mono font-bold text-xs border border-[#C5A059]/40 active:scale-95 transition-transform flex items-center justify-center cursor-pointer shadow-2xs"
                  title="Move Right"
                >
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Back ▼ (Moves away from dock / South) */}
              <button
                type="button"
                onPointerDown={() => startHoldingDirection("back")}
                onPointerUp={stopHoldingDirection}
                onPointerLeave={stopHoldingDirection}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startHoldingDirection("back");
                }}
                onTouchEnd={stopHoldingDirection}
                className="w-16 h-9 rounded-xl bg-[#FAF7F2] hover:bg-stone-100 text-stone-800 font-mono font-bold text-xs border border-[#C5A059]/40 active:scale-95 transition-transform flex items-center justify-center cursor-pointer shadow-2xs gap-1"
                title="Drive Reverse"
              >
                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>REV</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ============================================================
          INTERACTIVE QUICK SETUP & CAMERA GUIDE MODAL
          ============================================================ */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-[#1A1715]/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#FAF7F2] rounded-3xl border border-[#C5A059]/50 shadow-2xl max-w-sm w-full p-5 text-[#1A1715] flex flex-col gap-4 font-sans max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FF3820]/10 border border-[#FF3820]/30 flex items-center justify-center text-[#FF3820]">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1715]">
                    V-DOCKX ROBOT GUIDE
                  </h3>
                  <p className="text-[10px] font-mono text-stone-500">Phone & PC Synchronization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-7 h-7 rounded-full bg-stone-200/70 hover:bg-stone-300 text-stone-700 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Feature 1: Real-time Sensors & Motion */}
            <div className="p-3 rounded-2xl bg-white border border-[#C5A059]/30 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                <Navigation className="w-3.5 h-3.5 text-[#FF3820]" />
                <span>1. Real-Time Tracking (Active)</span>
              </div>
              <p className="text-[10px] text-stone-600 leading-relaxed">
                • <strong>Tilt & Turn:</strong> Rotating or tilting your phone automatically turns and steers the robot on both your phone screen and the PC monitor.
              </p>
              <p className="text-[10px] text-stone-600 leading-relaxed">
                • <strong>Direction D-Pad:</strong> Tap <strong className="text-[#FF3820]">▲ FWD</strong> to drive towards the dock. Tap <strong>◀ LEFT</strong> or <strong>▶ RIGHT</strong> to move laterally.
              </p>
            </div>

            {/* Feature 2: Autonomous Docking & Battery Charging */}
            <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-300 shadow-2xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>2. Docking & Rapid DC Charging</span>
              </div>
              <p className="text-[10px] text-emerald-900/80 leading-relaxed">
                When you guide the robot to the dock terminal (within <strong>25 cm</strong>), both your phone and PC will automatically trigger the full-screen <strong>Rapid DC Battery Charging Screen</strong>!
              </p>
            </div>

            {/* Feature 3: Real Camera Video on Chrome Android */}
            <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-300 shadow-2xs space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Camera className="w-3.5 h-3.5 text-amber-700" />
                <span>3. Real Camera Stream on Chrome</span>
              </div>
              <p className="text-[10px] text-stone-700 leading-relaxed">
                Mobile Chrome blocks cameras on plain HTTP LAN IPs. To allow it:
              </p>
              <ol className="text-[9.5px] font-mono text-stone-800 space-y-1 pl-3 list-decimal">
                <li>
                  Open a new tab in Chrome: <br />
                  <span className="text-amber-800 font-bold select-all">chrome://flags</span>
                </li>
                <li>Search for: <strong>unsafely-treat-insecure-origin-as-secure</strong></li>
                <li>Add: <span className="bg-amber-100 px-1 py-0.5 rounded font-bold">http://192.168.137.101:3000</span></li>
                <li>Choose <strong>Enabled</strong> and tap <strong>Relaunch</strong>.</li>
              </ol>
              <p className="text-[9.5px] text-stone-500 italic">
                *Note: Sensor tracking and PC motion work 100% even without the camera!
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowGuideModal(false);
                  initCamera();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#FF3820] hover:bg-[#FF3820]/90 text-white font-mono font-bold text-[11px] uppercase tracking-wider shadow-sm active:scale-95 transition-transform"
              >
                Try Camera Now
              </button>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-700 font-mono font-bold text-[11px] hover:bg-stone-50 active:scale-95 transition-transform"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
