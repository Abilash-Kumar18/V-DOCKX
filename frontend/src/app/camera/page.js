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
} from "lucide-react";

export default function MobileCameraPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // back camera by default
  const [fps, setFps] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [transmittedFrames, setTransmittedFrames] = useState(0);

  // Mobile GPS & Orientation State
  const [gpsData, setGpsData] = useState({
    lat: 42.3601,
    lng: -71.0589,
    accuracy: null,
    isGpsActive: false,
  });
  const [compassHeading, setCompassHeading] = useState(-85);
  
  // Normalized 2D Arena Position (meters: x: 0-2m, y: 0-2m)
  const [arenaPose, setArenaPose] = useState({ x: 1.15, y: 1.65 });
  const baseGpsRef = useRef(null);
  const arenaPoseRef = useRef({ x: 1.15, y: 1.65 });

  // Update arenaPoseRef whenever state changes
  useEffect(() => {
    arenaPoseRef.current = arenaPose;
  }, [arenaPose]);

  // 1. Initialize Phone Camera
  const initCamera = async (mode = facingMode) => {
    setErrorMsg(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Camera access error on phone:", err);
      setErrorMsg("Camera permission denied. Please allow camera access in your browser settings.");
      setIsStreaming(false);
    }
  };

  // Flip Camera (Back <-> Front)
  const handleFlipCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    initCamera(nextMode);
  };

  // 2. Mobile GPS Location Watcher
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported by device.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        // Set initial benchmark anchor on first read
        if (!baseGpsRef.current) {
          baseGpsRef.current = { lat: latitude, lng: longitude };
        }

        // Compute meters displacement from benchmark anchor (1 deg lat ~ 111,000m)
        const dLatMeters = (latitude - baseGpsRef.current.lat) * 111139;
        const dLngMeters =
          (longitude - baseGpsRef.current.lng) *
          111139 *
          Math.cos((latitude * Math.PI) / 180);

        // Map displacement to 2m x 2m arena space (initial center is x=1.15, y=1.65)
        const mappedX = Math.max(0.15, Math.min(1.85, 1.15 + dLngMeters * 0.4));
        const mappedY = Math.max(0.38, Math.min(1.85, 1.65 - dLatMeters * 0.4));

        setGpsData({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          isGpsActive: true,
        });

        setArenaPose({
          x: Number(mappedX.toFixed(3)),
          y: Number(mappedY.toFixed(3)),
        });
      },
      (err) => {
        console.warn("GPS watch warning:", err.message);
        // Fallback: active simulated indoor GPS anchor
        setGpsData((prev) => ({ ...prev, isGpsActive: true }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // 3. Mobile Device Orientation / Compass Heading
  useEffect(() => {
    const handleOrientation = (e) => {
      if (e.alpha !== null) {
        // alpha is compass heading in degrees (0 - 360)
        let heading = Math.round(e.alpha);
        if (heading > 180) heading -= 360;
        setCompassHeading(heading);
      }
    };

    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  useEffect(() => {
    initCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // 4. Mobile Frame & Sensor Telemetry Transmitter Loop
  useEffect(() => {
    if (!isStreaming) return;

    let isSending = false;
    let frameCount = 0;
    let lastFpsTime = Date.now();

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4 || isSending) return;

      isSending = true;

      try {
        const ctx = canvas.getContext("2d");
        const w = 480;
        const h = Math.floor((video.videoHeight / video.videoWidth) * w) || 360;
        canvas.width = w;
        canvas.height = h;

        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.55); // compressed JPEG for ultra-low latency

        // Payload containing frame + live mobile GPS pose & heading
        const payload = {
          frame: dataUrl,
          pose: {
            x: arenaPoseRef.current.x,
            y: arenaPoseRef.current.y,
            heading: compassHeading,
            lat: gpsData.lat,
            lng: gpsData.lng,
            isGpsActive: gpsData.isGpsActive,
            accuracy: gpsData.accuracy,
          },
        };

        await fetch("/api/camera/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

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
    }, 70); // ~15 FPS broadcast rate

    return () => clearInterval(interval);
  }, [isStreaming, compassHeading, gpsData]);

  // Touch / Drag Joystick on mobile screen to steer or nudge position towards charging pad
  const handleTouchNudge = (dx, dy) => {
    setArenaPose((prev) => ({
      x: Math.max(0.15, Math.min(1.85, Number((prev.x + dx).toFixed(3)))),
      y: Math.max(0.38, Math.min(1.85, Number((prev.y + dy).toFixed(3)))),
    }));
  };

  return (
    <div className="min-h-screen bg-[#0D0D12] text-white flex flex-col justify-between p-4 select-none">
      {/* Top Mobile Status Header */}
      <header className="flex items-center justify-between p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#FF3820] flex items-center justify-center text-white shadow-[0_0_12px_rgba(255,56,32,0.6)]">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs font-bold font-sans tracking-wide text-white uppercase">
              V-DOCKX MOBILE BROADCAST
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-300">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                TRANSMITTING LIVE
              </span>
              <span>•</span>
              <span>{fps} FPS</span>
            </div>
          </div>
        </div>

        {/* Flip Camera Button */}
        <button
          type="button"
          onClick={handleFlipCamera}
          className="p-2.5 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95"
          title="Switch Camera"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>
      </header>

      {/* Main Camera Preview Viewport */}
      <main className="flex-1 my-3 relative flex items-center justify-center rounded-3xl overflow-hidden border-2 border-[#C5A059]/40 bg-black shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Reticle Overlay on Mobile Screen */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#FF3820] bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-full self-start border border-[#FF3820]/30">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              GPS POINT: [{arenaPose.x.toFixed(2)}m, {arenaPose.y.toFixed(2)}m]
            </span>
          </div>

          <div className="self-center flex flex-col items-center">
            {/* Center Aim Crosshair */}
            <div className="w-20 h-20 border-2 border-dashed border-[#FF3820]/70 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-3 h-3 bg-[#FF3820] rounded-full" />
            </div>
            <span className="text-[10px] font-mono font-bold text-white mt-1 bg-black/50 px-2 py-0.5 rounded-full">
              TARGET DOCKING BAY
            </span>
          </div>

          {/* Compass & Distance Indicator */}
          <div className="flex items-center justify-between text-[10px] font-mono text-stone-300 bg-black/60 px-3 py-1.5 rounded-full border border-white/20">
            <span>HEADING: {compassHeading}°</span>
            <span>FRAMES: {transmittedFrames}</span>
          </div>
        </div>

        {/* Error Fallback */}
        {errorMsg && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-10 h-10 text-[#FF3820] mb-3" />
            <p className="text-xs text-stone-200 mb-4 max-w-xs">{errorMsg}</p>
            <button
              type="button"
              onClick={() => initCamera()}
              className="px-5 py-2.5 rounded-full bg-[#FF3820] text-white text-xs font-bold uppercase tracking-wider"
            >
              Enable Camera
            </button>
          </div>
        )}
      </main>

      {/* Bottom Live GPS & Sensor Telemetry Bar */}
      <footer className="space-y-2">
        <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
          <div className="flex items-center justify-between text-xs font-bold text-stone-300 mb-2 pb-1.5 border-b border-white/10">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Activity className="w-3.5 h-3.5" />
              LOCATION SENSOR ACTIVE
            </span>
            <span className="text-[10px] font-mono text-[#C5A059]">
              FIXED DOCK: [1.00m, 0.35m]
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-stone-300">
            <div className="bg-white/5 p-2 rounded-xl border border-white/10">
              <span className="text-stone-400 block text-[9px]">REAL GPS LAT/LNG</span>
              <span className="text-white font-bold">
                {gpsData.lat.toFixed(4)}°, {gpsData.lng.toFixed(4)}°
              </span>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/10">
              <span className="text-stone-400 block text-[9px]">MAP 2D COORDS</span>
              <span className="text-[#FF3820] font-bold">
                X: {arenaPose.x.toFixed(2)}m | Y: {arenaPose.y.toFixed(2)}m
              </span>
            </div>
          </div>

          {/* Quick Manual Nudge Pad (in case physical room is small) */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-1">
            <span className="text-[9px] font-mono text-stone-400">WALK SIMULATOR:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleTouchNudge(0, -0.1)}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-[#FF3820] text-xs font-bold font-mono transition-colors"
                title="Walk towards dock"
              >
                Forward (Towards Dock)
              </button>
              <button
                type="button"
                onClick={() => handleTouchNudge(-0.08, 0)}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold font-mono transition-colors"
              >
                ← Left
              </button>
              <button
                type="button"
                onClick={() => handleTouchNudge(0.08, 0)}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold font-mono transition-colors"
              >
                Right →
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
