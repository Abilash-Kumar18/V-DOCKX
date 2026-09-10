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

  // Poll for phone camera stream from /api/camera/frame
  useEffect(() => {
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

            // Pre-load frame onto offscreen image
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
  }, []);

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
      if (isPhoneConnected && phoneImgRef.current && phoneImgRef.current.complete) {
        // Draw live phone camera frame
        try {
          ctx.drawImage(phoneImgRef.current, 0, 0, w, h);
        } catch (e) {}
      } else if (!isCameraActive) {
        // Draw synthetic robotics perspective
        const horizonY = h * 0.42;
        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, "#e2e8f0");
        floorGrad.addColorStop(1, "#cbd5e1");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, h - horizonY);

        // Perspective Grid
        ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
        ctx.lineWidth = 1;
        for (let gx = -4; gx <= 4; gx++) {
          ctx.beginPath();
          ctx.moveTo(w / 2 + gx * 24, horizonY);
          ctx.lineTo(w / 2 + gx * 120, h);
          ctx.stroke();
        }

        // Floor Path Guideline
        const lineCenterX = w / 2 + lateralOffsetM * 500;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(w / 2 + lateralOffsetM * 140, horizonY + 20);
        ctx.lineTo(lineCenterX, h);
        ctx.stroke();
      }

      if (showOverlays) {
        const horizonY = h * 0.42;

        // 1. Dynamic Safety Corridor (Trapezoid Projection)
        const topW = 100;
        const bottomW = 340;
        ctx.beginPath();
        ctx.moveTo(w / 2 - topW / 2, horizonY + 20);
        ctx.lineTo(w / 2 + topW / 2, horizonY + 20);
        ctx.lineTo(w / 2 + bottomW / 2, h);
        ctx.lineTo(w / 2 - bottomW / 2, h);
        ctx.closePath();

        ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
        ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // 2. Center Projected Path (Cyan Guide Line)
        const lineBottomX = w / 2 + lateralOffsetM * 500;
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(w / 2, horizonY + 20);
        ctx.lineTo(lineBottomX, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. Line Centroid Crosshair (e_c)
        const chX = lineBottomX;
        const chY = h - 70;
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(chX, chY, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(chX - 24, chY);
        ctx.lineTo(chX + 24, chY);
        ctx.moveTo(chX, chY - 24);
        ctx.lineTo(chX + 24, chY);
        ctx.stroke();

        ctx.fillStyle = "#0284c7";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`e_c: ${(lateralOffsetM * 100).toFixed(1)}cm`, chX + 22, chY - 4);

        // 4. Station AprilTag Docking Marker & 3D Axes
        const tagScale = Math.max(0.4, 1.2 - distanceM * 0.7);
        const tagW = 85 * tagScale;
        const tagH = 85 * tagScale;
        const tagX = w / 2 - tagW / 2 + lateralOffsetM * 260;
        const tagY = horizonY - tagH * 0.7;

        // Station Docking Bay Boundary
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(tagX, tagY, tagW, tagH);

        const markerX = tagX + tagW / 2;
        const markerY = tagY + tagH / 2;

        // 3D RGB Coordinates Axes (X Red, Y Green, Z Blue)
        ctx.strokeStyle = "#ef4444"; // X Axis
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(markerX, markerY);
        ctx.lineTo(markerX + tagW * 0.65, markerY);
        ctx.stroke();

        ctx.strokeStyle = "#10b981"; // Y Axis
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(markerX, markerY);
        ctx.lineTo(markerX, markerY - tagH * 0.65);
        ctx.stroke();

        ctx.strokeStyle = "#3b82f6"; // Z Axis
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(markerX, markerY);
        ctx.lineTo(markerX - tagW * 0.4, markerY + tagH * 0.4);
        ctx.stroke();

        // Target Tag Label
        ctx.fillStyle = "#059669";
        ctx.font = "bold 10px monospace";
        ctx.fillText(`BAY_01 [DIST: ${distanceM.toFixed(2)}m]`, tagX - 10, tagY - 8);

        // 5. HUD Top Status Overlay
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(12, 12, 250, 48);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.fillText(
          `FEED: ${
            isPhoneConnected
              ? "LIVE MOBILE PHONE EYE [CONNECTED]"
              : isUsingStreamUrl
              ? "IP PHONE STREAM"
              : isCameraActive
              ? "USB / WEBCAM OPTICS"
              : "SYNTHETIC HUD"
          }`,
          20,
          28
        );
        ctx.fillStyle = "#38bdf8";
        ctx.fillText(
          `DIST: ${distanceM.toFixed(2)}m | LAT: ${(lateralOffsetM * 100).toFixed(1)}cm`,
          20,
          44
        );
      }

      animRef.current = requestAnimationFrame(renderOverlay);
    };

    renderOverlay();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isCameraActive, isUsingStreamUrl, showOverlays, distanceM, lateralOffsetM, headingErrorDeg]);

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Top Camera Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isCameraActive ? "bg-emerald-500 animate-pulse" : "bg-blue-600"
            }`}
          />
          <span className="text-xs font-bold text-slate-800 tracking-wide uppercase font-mono">
            Forward Robotic Vision HUD
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Camera Selection Dropdown (if multiple cameras / USB phone webcam found) */}
          {availableDevices.length > 0 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value);
                if (isCameraActive && !isUsingStreamUrl) {
                  startCamera(e.target.value);
                }
              }}
              className="text-[11px] font-medium py-1 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 outline-none hover:border-slate-300"
              title="Select Camera Device"
            >
              {availableDevices.map((dev, idx) => (
                <option key={dev.deviceId || idx} value={dev.deviceId}>
                  {dev.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {/* Toggle Overlays */}
          <button
            type="button"
            onClick={() => setShowOverlays(!showOverlays)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showOverlays
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overlays</span>
          </button>

          {/* Flip Camera (Front/Back) */}
          {isCameraActive && !isUsingStreamUrl && (
            <button
              type="button"
              onClick={flipCamera}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Flip Camera (Front/Back)"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          )}

          {/* USB / Mobile Connection Status & Trigger */}
          {isPhoneConnected ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>📱 Phone Eye Connected</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUsbGuide(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors"
              title="Connect your mobile phone camera"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Connect Phone</span>
            </button>
          )}

          {/* Open Camera / Switch Stream Button */}
          {!isCameraActive ? (
            <button
              type="button"
              onClick={() => startCamera()}
              className="btn-primary px-3 py-1.5 text-xs gap-1.5 shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Open Webcam</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              <CameraOff className="w-3.5 h-3.5" />
              <span>Use Simulation</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 min-h-[300px] w-full bg-slate-900 overflow-hidden flex items-center justify-center">
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
          <div className="absolute top-4 inset-x-4 z-20 p-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs text-center backdrop-blur-md shadow-lg flex flex-col items-center gap-2">
            <div>{cameraError}</div>
            <button
              type="button"
              onClick={() => setShowUsbGuide(true)}
              className="btn-primary px-3 py-1 text-[11px] gap-1.5"
            >
              <Smartphone className="w-3 h-3" />
              <span>Open USB & Phone Connection Guide</span>
            </button>
          </div>
        )}

        {/* Live Indicator Stamp */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isCameraActive ? "bg-emerald-400 animate-pulse" : "bg-blue-400"
            }`}
          />
          <span>
            {isUsingStreamUrl
              ? "IP PHONE STREAM"
              : isCameraActive
              ? "LIVE OPTICS ACTIVE"
              : "SYNTHETIC HUD"}
          </span>
        </div>
      </div>

      {/* USB & Phone Camera Connection Guide Modal */}
      {showUsbGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Connect Phone Camera (USB or Wi-Fi)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUsbGuide(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              {/* Method 1: Android USB Webcam */}
              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100">
                <div className="font-bold text-blue-900 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  Android USB Webcam Mode (Zero-Install)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1 mt-2">
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
                  className="btn-primary mt-3 px-3 py-1.5 text-xs gap-1.5 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh & Connect Webcam</span>
                </button>
              </div>

              {/* Method 2: Open Directly on Phone via Local Link */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  Open on Phone via Wi-Fi / USB Tethering
                </div>
                <p className="mt-1 text-slate-600">
                  Open this link in Chrome on your phone (connected to same Wi-Fi or USB tethering):
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-blue-600 font-bold text-xs flex items-center justify-between select-all">
                  <span>http://192.168.76.15:3000/camera</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  Your phone will instantly open its back camera and transmit live video straight into this Forward Robotic Vision HUD on your PC!
                </p>
              </div>

              {/* Method 3: IP Webcam Stream URL */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  IP Camera / DroidCam Stream URL
                </div>
                <p className="mt-1 text-slate-600">
                  If you run an IP camera app (e.g. DroidCam or IP Webcam), enter the stream URL:
                </p>
                <form onSubmit={handleConnectStreamUrl} className="flex gap-2 mt-2">
                  <input
                    type="url"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="http://192.168.137.X:8080/video"
                    className="flex-1 input-light py-1.5 text-xs font-mono"
                  />
                  <button type="submit" className="btn-primary px-3 py-1.5 text-xs whitespace-nowrap">
                    Connect
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setShowUsbGuide(false)}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
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
