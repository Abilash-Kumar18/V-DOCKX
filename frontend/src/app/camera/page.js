"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FlipHorizontal, Radio, Wifi, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";

export default function MobileCameraPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // back camera by default
  const [fps, setFps] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [transmittedFrames, setTransmittedFrames] = useState(0);

  // Initialize phone camera
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
      setErrorMsg(
        "Camera permission denied or not accessible. Tap 'Request Camera Access' to enable."
      );
      setIsStreaming(false);
    }
  };

  // Flip camera (Back <-> Front)
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

  // Frame Transmitter Loop (Transmits frames to Next.js API / PC)
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

        await fetch("/api/camera/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frame: dataUrl }),
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
        // Network or fetch error
      } finally {
        isSending = false;
      }
    }, 45); // ~22 FPS

    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between select-none">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Mobile Bar */}
      <header className="p-4 flex items-center justify-between bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              V-DOCKX Optical Node
            </h1>
            <p className="text-[10px] text-zinc-400">Robot Eye Mobile Transmitter</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isStreaming ? `${fps} FPS` : "OFFLINE"}</span>
          </span>

          <button
            type="button"
            onClick={handleFlipCamera}
            className="p-2 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 active:bg-zinc-700"
            title="Flip Front/Back Camera"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Viewfinder Area */}
      <main className="relative flex-1 flex items-center justify-center overflow-hidden bg-zinc-950">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* Framing Crosshair Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-48 h-48 border-2 border-dashed border-cyan-400/50 rounded-2xl flex items-center justify-center">
            <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400 absolute top-2 left-2" />
            <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400 absolute top-2 right-2" />
            <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400 absolute bottom-2 left-2" />
            <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400 absolute bottom-2 right-2" />
            <span className="text-[10px] font-mono text-cyan-300 bg-black/60 px-2 py-0.5 rounded">
              ROBOT CAM VIEW
            </span>
          </div>
        </div>

        {/* Permission / Error Screen */}
        {errorMsg && (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center bg-black/90 text-center gap-4 z-20">
            <AlertCircle className="w-12 h-12 text-amber-400" />
            <p className="text-xs text-zinc-300 max-w-xs">{errorMsg}</p>
            <button
              type="button"
              onClick={() => initCamera()}
              className="px-5 py-2.5 rounded-full bg-blue-600 text-white font-bold text-xs shadow-lg flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Allow Camera Access</span>
            </button>
          </div>
        )}
      </main>

      {/* Bottom Status Panel */}
      <footer className="p-4 bg-zinc-900/90 border-t border-zinc-800 text-xs text-zinc-400 flex flex-col gap-2 z-10">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Wifi className="w-3.5 h-3.5" />
            <span>Broadcasting to PC Mission Control</span>
          </span>
          <span className="text-zinc-500">Frames: {transmittedFrames}</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-tight">
          Keep this screen open on your phone while aiming at the path. Your PC screen will display this live stream with autonomous docking overlays!
        </p>
      </footer>
    </div>
  );
}
