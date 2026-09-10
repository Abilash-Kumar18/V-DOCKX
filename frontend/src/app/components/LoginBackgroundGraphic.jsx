"use client";

import React, { useEffect, useRef, useState } from "react";

export default function LoginBackgroundGraphic() {
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const posRef = useRef({ currentX: 0, currentY: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    let animationFrameId;

    const handleMouseMove = (e) => {
      // Normalized between -1 and 1
      const targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      const targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      posRef.current.targetX = targetX;
      posRef.current.targetY = targetY;
    };

    const updateParallax = () => {
      // Smooth lerp interpolation
      posRef.current.currentX += (posRef.current.targetX - posRef.current.currentX) * 0.05;
      posRef.current.currentY += (posRef.current.targetY - posRef.current.currentY) * 0.05;

      setMousePos({
        x: posRef.current.currentX,
        y: posRef.current.currentY,
      });

      animationFrameId = requestAnimationFrame(updateParallax);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animationFrameId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Parallax offsets for different depth layers
  const layer1X = mousePos.x * -10;
  const layer1Y = mousePos.y * -10;

  const layer2X = mousePos.x * 20;
  const layer2Y = mousePos.y * 20;

  const layer3X = mousePos.x * 36;
  const layer3Y = mousePos.y * 36;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0"
    >
      {/* ============================================================
          LAYER 1: DEEP AMBIENT GLOWS & BLUEPRINT RETICLE GRID
          ============================================================ */}
      <div
        className="absolute inset-0 transition-transform ease-out"
        style={{
          transform: `translate3d(${layer1X}px, ${layer1Y}px, 0)`,
        }}
      >
        {/* Deep ambient multi-stop blushes */}
        <div className="absolute -top-48 -left-48 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-[#C5A059]/20 via-[#FAF7F2]/50 to-transparent blur-3xl opacity-80" />
        <div className="absolute top-1/4 -right-52 w-[750px] h-[750px] rounded-full bg-gradient-to-bl from-[#FF3820]/15 via-[#FAF7F2]/40 to-transparent blur-3xl opacity-80" />
        <div className="absolute -bottom-52 left-1/4 w-[800px] h-[800px] rounded-full bg-gradient-to-tr from-[#C5A059]/16 via-[#EFE7DC]/60 to-transparent blur-3xl opacity-90" />

        {/* Precision Architectural / Telemetry Dot Matrix Grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.24]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="login-blueprint-grid" width="64" height="64" patternUnits="userSpaceOnUse">
              <path
                d="M 64 0 L 0 0 0 64"
                fill="none"
                stroke="#C5A059"
                strokeWidth="0.75"
                strokeDasharray="2 4"
              />
              <circle cx="0" cy="0" r="1.5" fill="#8C6D31" />
              <circle cx="64" cy="0" r="1.5" fill="#8C6D31" />
              <circle cx="0" cy="64" r="1.5" fill="#8C6D31" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-blueprint-grid)" />
        </svg>
      </div>

      {/* ============================================================
          LAYER 2: GEOMETRIC SHAPES, TRACKS & RETICLES (MID-DEPTH)
          ============================================================ */}
      <div
        className="absolute inset-0 transition-transform ease-out"
        style={{
          transform: `translate3d(${layer2X}px, ${layer2Y}px, 0)`,
        }}
      >
        {/* Wavy Meandering Trajectory Ribbons & Traveling Data Packets */}
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="stream-vermillion" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF3820" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#E5352B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#C5A059" stopOpacity="0.2" />
            </linearGradient>

            <linearGradient id="stream-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C5A059" stopOpacity="0.6" />
              <stop offset="60%" stopColor="#8C6D31" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FF3820" stopOpacity="0.15" />
            </linearGradient>

            <filter id="packet-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track 1: Upper left to lower middle with smooth rounded turns (Inspired by reference) */}
          <path
            id="flight-path-1"
            d="M -50,220 L 280,220 Q 340,220 340,280 L 340,420 Q 340,480 400,480 L 580,480 Q 640,480 640,540 L 640,780"
            fill="none"
            stroke="url(#stream-gold)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Flowing dashed overlay on Track 1 */}
          <path
            d="M -50,220 L 280,220 Q 340,220 340,280 L 340,420 Q 340,480 400,480 L 580,480 Q 640,480 640,540 L 640,780"
            fill="none"
            stroke="#FF3820"
            strokeWidth="3.5"
            strokeDasharray="14 36"
            strokeLinecap="round"
            className="animate-dash-flow"
            opacity="0.75"
          />

          {/* Traveling Laser Comet Packet on Track 1 */}
          <circle r="5" fill="#FF3820" filter="url(#packet-glow)">
            <animateMotion
              dur="7s"
              repeatCount="indefinite"
              path="M -50,220 L 280,220 Q 340,220 340,280 L 340,420 Q 340,480 400,480 L 580,480 Q 640,480 640,540 L 640,780"
            />
          </circle>

          {/* Track 2: Right side trajectory track */}
          <path
            id="flight-path-2"
            d="M 1500,160 L 1150,160 Q 1090,160 1090,220 L 1090,340 Q 1090,400 1030,400 L 880,400 Q 820,400 820,460 L 820,700 Q 820,760 880,760 L 1150,760"
            fill="none"
            stroke="url(#stream-vermillion)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 1500,160 L 1150,160 Q 1090,160 1090,220 L 1090,340 Q 1090,400 1030,400 L 880,400 Q 820,400 820,460 L 820,700 Q 820,760 880,760 L 1150,760"
            fill="none"
            stroke="#C5A059"
            strokeWidth="3.5"
            strokeDasharray="16 40"
            strokeLinecap="round"
            className="animate-dash-flow"
            opacity="0.65"
          />

          {/* Traveling Golden Pulse Packet on Track 2 */}
          <circle r="4.5" fill="#C5A059" filter="url(#packet-glow)">
            <animateMotion
              dur="9s"
              repeatCount="indefinite"
              path="M 1500,160 L 1150,160 Q 1090,160 1090,220 L 1090,340 Q 1090,400 1030,400 L 880,400 Q 820,400 820,460 L 820,700 Q 820,760 880,760 L 1150,760"
            />
          </circle>

          {/* Waypoint Connection Nodes */}
          <g opacity="0.85">
            <circle cx="280" cy="220" r="5" fill="#FF3820" />
            <circle cx="340" cy="420" r="5" fill="#C5A059" />
            <circle cx="580" cy="480" r="5" fill="#FF3820" />
            <circle cx="1090" cy="220" r="5" fill="#C5A059" />
            <circle cx="1030" cy="400" r="5" fill="#FF3820" />
            <circle cx="820" cy="460" r="5" fill="#C5A059" />
          </g>
        </svg>

        {/* Dual Vertical Beacon Lines (Directly matching vertical lines above Welcome in reference image) */}
        <div className="absolute top-0 left-[18%] flex gap-4 pointer-events-none opacity-60">
          <div className="w-[3px] h-48 bg-gradient-to-b from-[#FF3820]/70 via-[#FF3820]/30 to-transparent rounded-full shadow-[0_0_10px_rgba(255,56,32,0.4)]" />
          <div className="w-[3px] h-36 bg-gradient-to-b from-[#C5A059]/70 via-[#C5A059]/30 to-transparent rounded-full shadow-[0_0_10px_rgba(197,160,89,0.4)]" />
        </div>

        {/* Bottom Left Diamond / Rhombus Wireframe (Directly matching rhombus in reference image) */}
        <div className="absolute bottom-12 left-10 sm:left-24 w-44 h-44 border-2 border-[#C5A059]/30 rotate-45 rounded-2xl pointer-events-none opacity-50 shadow-sm flex items-center justify-center">
          <div className="w-28 h-28 border border-dashed border-[#FF3820]/30 rounded-xl" />
        </div>

        {/* Orbital Perception Radar Circles with Crosshairs */}
        <div className="absolute top-12 left-20 sm:left-44 w-60 h-60 rounded-full border border-[#C5A059]/35 animate-pulse-soft pointer-events-none flex items-center justify-center">
          <div className="w-44 h-44 rounded-full border border-dashed border-[#C5A059]/45 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full border border-[#FF3820]/35" />
          </div>
          <span className="absolute top-0 w-2.5 h-0.5 bg-[#C5A059]" />
          <span className="absolute bottom-0 w-2.5 h-0.5 bg-[#C5A059]" />
          <span className="absolute left-0 h-2.5 w-0.5 bg-[#C5A059]" />
          <span className="absolute right-0 h-2.5 w-0.5 bg-[#C5A059]" />
        </div>

        {/* Bottom-Right Large Fiducial Orbital Ring (Matching giant arc in reference template) */}
        <div className="absolute -bottom-36 right-[20%] w-[460px] h-[460px] rounded-full border-2 border-[#C5A059]/25 pointer-events-none flex items-center justify-center animate-pulse-soft">
          <div className="w-[360px] h-[360px] rounded-full border border-dashed border-[#FF3820]/30" />
        </div>
      </div>

      {/* ============================================================
          LAYER 3: FLOATING GLASS CAPSULES & FIDUCIAL TAGS (FOREGROUND DEPTH)
          ============================================================ */}
      <div
        className="absolute inset-0 transition-transform ease-out"
        style={{
          transform: `translate3d(${layer3X}px, ${layer3Y}px, 0)`,
        }}
      >
        {/* Giant Diagonal Pill 1 (Top-Right): Dual-Tone Frosted Glass Capsule (Modeled from Reference) */}
        <div
          className="absolute -top-14 right-[-30px] sm:right-12 w-[460px] h-[120px] rounded-full border border-[#C5A059]/45 shadow-[0_24px_60px_rgba(197,160,89,0.22)] animate-float-capsule-1 backdrop-blur-md overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(248, 243, 235, 0.7) 45%, rgba(197, 160, 89, 0.35) 100%)",
          }}
        >
          {/* Inner dual-tone split pill (Distinct highlight as in reference image) */}
          <div className="absolute top-2 left-2 bottom-2 w-1/3 rounded-full bg-gradient-to-r from-[#FF3820]/25 to-transparent border border-white/60 backdrop-blur-xs" />
          <div className="absolute inset-2 rounded-full border border-white/70 pointer-events-none" />
        </div>

        {/* Slender Diagonal Capsule 2 (Upper Mid-Right) */}
        <div
          className="absolute top-32 right-[25%] w-[280px] h-[56px] rounded-full border-2 border-[#FF3820]/35 shadow-md animate-float-capsule-1"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 56, 32, 0.14) 0%, rgba(255, 255, 255, 0.65) 100%)",
          }}
        >
          <div className="absolute inset-1.5 rounded-full border border-white/80" />
        </div>

        {/* Giant Reverse Diagonal Capsule 3 (Bottom-Right) */}
        <div
          className="absolute -bottom-28 right-6 sm:right-28 w-[520px] h-[135px] rounded-full border border-[#FF3820]/35 shadow-[0_28px_70px_rgba(255,56,32,0.16)] animate-float-capsule-1 backdrop-blur-sm"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.88) 0%, rgba(255, 242, 238, 0.7) 40%, rgba(255, 56, 32, 0.25) 100%)",
          }}
        >
          <div className="absolute inset-2 rounded-full border border-white/60 pointer-events-none" />
        </div>

        {/* Reverse-Angle Pill 4 (Bottom-Left) */}
        <div
          className="absolute bottom-20 -left-16 w-[400px] h-[96px] rounded-full border border-[#C5A059]/40 shadow-[0_20px_50px_rgba(197,160,89,0.16)] animate-float-capsule-2 backdrop-blur-xs"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(246, 241, 234, 0.65) 60%, rgba(197, 160, 89, 0.28) 100%)",
          }}
        />

        {/* Slender Capsule 5 (Mid-Left) */}
        <div
          className="absolute top-1/3 -left-10 w-[240px] h-[48px] rounded-full border border-[#FF3820]/30 shadow-sm animate-float-capsule-2"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 56, 32, 0.15) 0%, rgba(255, 255, 255, 0.7) 100%)",
          }}
        />

        {/* Tactical AprilTag Fiducial Watermarks in the Corners */}
        <div className="absolute top-6 left-8 hidden md:flex items-center gap-3 text-[10px] font-mono tracking-widest text-[#8C6D31]/80 font-bold bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#C5A059]/30 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#FF3820] animate-ping" />
          <span>ARENA_COORD: [42.3601° N, 71.0589° W]</span>
          <span>•</span>
          <span>SYS_STATUS: ONLINE</span>
        </div>

        <div className="absolute top-6 right-8 hidden md:flex items-center gap-3 text-[10px] font-mono tracking-widest text-[#8C6D31]/80 font-bold bg-white/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#C5A059]/30 shadow-xs">
          <span>APRILTAG_ARRAY: ACTIVE</span>
          <span>•</span>
          <span>FOV: 120° DUAL_SENSE</span>
        </div>

        <div className="absolute bottom-6 left-8 hidden md:flex items-center gap-3 text-[10px] font-mono tracking-widest text-stone-500 bg-white/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-stone-200/60 shadow-xs">
          <span>MISSION_CLOCK: 00:00:00 UTC</span>
          <span>•</span>
          <span>RAS_PROTOCOL_V3</span>
        </div>

        <div className="absolute bottom-6 right-8 hidden md:flex items-center gap-3 text-[10px] font-mono tracking-widest text-stone-500 bg-white/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-stone-200/60 shadow-xs">
          <span>SECURITY: OPERATOR_VERIFIED</span>
        </div>
      </div>
    </div>
  );
}
