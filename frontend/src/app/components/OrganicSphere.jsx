"use client";

import { useEffect, useRef } from "react";

export default function OrganicSphere({ size = 110, className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = size;
    const height = size;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let animationFrameId;
    let time = 0;

    // Organic noise generator for moss/mineral textures
    const noise2D = (x, y) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const smoothNoise = (x, y) => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);

      const n00 = noise2D(i, j);
      const n10 = noise2D(i + 1, j);
      const n01 = noise2D(i, j + 1);
      const n11 = noise2D(i + 1, j + 1);

      return (
        (1 - sy) * ((1 - sx) * n00 + sx * n10) +
        sy * ((1 - sx) * n01 + sx * n11)
      );
    };

    const fbm = (x, y) => {
      let v = 0;
      let a = 0.5;
      for (let i = 0; i < 3; i++) {
        v += a * smoothNoise(x, y);
        x *= 2.1;
        y *= 2.1;
        a *= 0.5;
      }
      return v;
    };

    const render = () => {
      time += 0.008;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = width * 0.42;

      // 1. Soft, non-neon ambient halo behind sphere
      const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.25);
      haloGrad.addColorStop(0, "rgba(85, 115, 45, 0.28)");
      haloGrad.addColorStop(0.5, "rgba(55, 80, 30, 0.12)");
      haloGrad.addColorStop(1, "rgba(20, 30, 15, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // 2. Base sphere clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // 3. Deep obsidian-moss gradient base
      const sphereGrad = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.35,
        radius * 0.05,
        cx,
        cy,
        radius
      );
      sphereGrad.addColorStop(0, "#4d6b2c"); // soft olive peak
      sphereGrad.addColorStop(0.35, "#2c4018"); // deep moss
      sphereGrad.addColorStop(0.7, "#17220e"); // dark forest
      sphereGrad.addColorStop(1, "#0a0f06"); // shadow base
      ctx.fillStyle = sphereGrad;
      ctx.fillRect(0, 0, width, height);

      // 4. Organic marbling / procedural moss veins
      const imgData = ctx.getImageData(
        Math.floor((cx - radius) * dpr),
        Math.floor((cy - radius) * dpr),
        Math.floor(radius * 2 * dpr),
        Math.floor(radius * 2 * dpr)
      );
      const data = imgData.data;
      const boxSize = Math.floor(radius * 2 * dpr);

      for (let py = 0; py < boxSize; py += 2) {
        const ny = (py / boxSize) * 2 - 1;
        for (let px = 0; px < boxSize; px += 2) {
          const nx = (px / boxSize) * 2 - 1;
          const distSq = nx * nx + ny * ny;
          if (distSq <= 0.98) {
            const nz = Math.sqrt(1 - distSq);
            // 3D rotation angle
            const rotX = nx * Math.cos(time) - nz * Math.sin(time);
            const rotZ = nx * Math.sin(time) + nz * Math.cos(time);

            const nVal = fbm(rotX * 2.8 + 10, ny * 2.8 + rotZ * 1.2);

            const idx = (py * boxSize + px) * 4;
            if (nVal > 0.48) {
              const boost = (nVal - 0.48) * 45;
              // Subtle olive/forest tint adjustments without neon saturation
              data[idx] = Math.min(255, data[idx] + boost * 0.7);     // R
              data[idx + 1] = Math.min(255, data[idx + 1] + boost * 1.0); // G
              data[idx + 2] = Math.min(255, data[idx + 2] + boost * 0.3); // B
            }
          }
        }
      }
      ctx.putImageData(imgData, (cx - radius) * dpr, (cy - radius) * dpr);

      // 5. Soft specular rim light & ambient highlight
      const highlightGrad = ctx.createRadialGradient(
        cx - radius * 0.28,
        cy - radius * 0.32,
        0,
        cx - radius * 0.2,
        cy - radius * 0.2,
        radius * 0.7
      );
      highlightGrad.addColorStop(0, "rgba(185, 215, 120, 0.45)");
      highlightGrad.addColorStop(0.3, "rgba(120, 160, 65, 0.15)");
      highlightGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = highlightGrad;
      ctx.fillRect(0, 0, width, height);

      // 6. Rim light vignette along edges
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.75, cx, cy, radius);
      rimGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
      rimGrad.addColorStop(0.85, "rgba(80, 115, 45, 0.25)");
      rimGrad.addColorStop(1, "rgba(15, 25, 10, 0.9)");
      ctx.fillStyle = rimGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size]);

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background dot matrix halo */}
      <div
        className="absolute inset-0 rounded-full opacity-60 bg-dot-matrix-green pointer-events-none"
        style={{
          transform: "scale(1.4)",
          maskImage: "radial-gradient(circle, black 40%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle, black 40%, transparent 70%)",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="relative z-10 drop-shadow-md"
      />
    </div>
  );
}
