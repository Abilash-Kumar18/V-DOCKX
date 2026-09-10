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
      const sy = fy * fy * (3 - 2 * fx);

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
      time += 0.009;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = width * 0.42;

      // 1. Soft, ethereal blue/indigo ambient glow behind sphere in light mode
      const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.3);
      haloGrad.addColorStop(0, "rgba(59, 130, 246, 0.22)");
      haloGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.10)");
      haloGrad.addColorStop(1, "rgba(248, 250, 252, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 2. Base sphere clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // 3. Pearlescent Crystalline Gradient Base (Light Mode)
      const sphereGrad = ctx.createRadialGradient(
        cx - radius * 0.32,
        cy - radius * 0.38,
        radius * 0.05,
        cx,
        cy,
        radius
      );
      sphereGrad.addColorStop(0, "#ffffff"); // bright pearl highlight
      sphereGrad.addColorStop(0.25, "#e0e7ff"); // soft indigo shimmer
      sphereGrad.addColorStop(0.55, "#c7d2fe"); // sky blue transition
      sphereGrad.addColorStop(0.85, "#818cf8"); // cobalt pearl depth
      sphereGrad.addColorStop(1, "#3730a3"); // deep sapphire base shadow
      ctx.fillStyle = sphereGrad;
      ctx.fillRect(0, 0, width, height);

      // 4. Subtle Prismatic Iridescent Refractions
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
            const rotX = nx * Math.cos(time) - nz * Math.sin(time);
            const rotZ = nx * Math.sin(time) + nz * Math.cos(time);

            const nVal = fbm(rotX * 2.5 + 8, ny * 2.5 + rotZ * 1.1);

            const idx = (py * boxSize + px) * 4;
            if (nVal > 0.45) {
              const boost = (nVal - 0.45) * 35;
              // Delicate cyan-indigo refractive caustic highlights
              data[idx] = Math.min(255, data[idx] + boost * 0.4);     // R
              data[idx + 1] = Math.min(255, data[idx + 1] + boost * 0.8); // G
              data[idx + 2] = Math.min(255, data[idx + 2] + boost * 1.2); // B
            }
          }
        }
      }
      ctx.putImageData(imgData, (cx - radius) * dpr, (cy - radius) * dpr);

      // 5. Crisp Specular Top-Light Reflection
      const specGrad = ctx.createRadialGradient(
        cx - radius * 0.28,
        cy - radius * 0.32,
        0,
        cx - radius * 0.25,
        cy - radius * 0.28,
        radius * 0.55
      );
      specGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      specGrad.addColorStop(0.3, "rgba(255, 255, 255, 0.4)");
      specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = specGrad;
      ctx.fillRect(0, 0, width, height);

      // 6. Refined Rim Shading / Inner Glass Edge
      const rimGrad = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius);
      rimGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
      rimGrad.addColorStop(0.85, "rgba(49, 46, 129, 0.15)");
      rimGrad.addColorStop(1, "rgba(30, 27, 75, 0.4)");
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
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="relative z-10 drop-shadow-lg"
      />
    </div>
  );
}
