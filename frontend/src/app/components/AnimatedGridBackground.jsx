"use client";

import { useEffect, useRef } from "react";

export default function AnimatedGridBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animationId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    // Grid configuration
    const gridSize = 48; // Size of each grid cell
    const pulses = []; // Light pulses travelling along grid lines

    // Initialize random light pulses
    for (let i = 0; i < 18; i++) {
      pulses.push({
        isVertical: Math.random() > 0.5,
        coord: Math.floor(Math.random() * (Math.random() > 0.5 ? width : height) / gridSize) * gridSize,
        pos: Math.random() * (Math.random() > 0.5 ? height : width),
        speed: 1.2 + Math.random() * 2.2,
        length: 60 + Math.random() * 80,
        opacity: 0.25 + Math.random() * 0.45,
      });
    }

    let scanY = 0;
    let time = 0;

    const render = () => {
      time += 0.015;

      // Mouse smoothing
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.1;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.1;

      // Deep obsidian dark background
      ctx.fillStyle = "#080a0d";
      ctx.fillRect(0, 0, width, height);

      // 1. Subtle radial ambient gradient centered on mouse
      if (mouseRef.current.x > 0) {
        const mouseGrad = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          360
        );
        mouseGrad.addColorStop(0, "rgba(180, 215, 80, 0.06)");
        mouseGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = mouseGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Base Grid Lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";

      // Vertical lines
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Grid Intersections (Crosshairs / Points)
      const crossSize = 3;
      for (let x = 0; x <= width; x += gridSize * 2) {
        for (let y = 0; y <= height; y += gridSize * 2) {
          // Distance to mouse
          const dx = x - mouseRef.current.x;
          const dy = y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let pointAlpha = 0.12;
          let pointColor = "rgba(255, 255, 255, ";

          // Light up near mouse
          if (dist < 200) {
            pointAlpha = 0.5 * (1 - dist / 200);
            pointColor = "rgba(195, 230, 85, ";
          }

          // Gentle breathing pulse
          const breath = Math.sin(time * 2 + (x + y) * 0.01) * 0.05;
          ctx.strokeStyle = `${pointColor}${Math.max(0.04, pointAlpha + breath)})`;
          ctx.beginPath();
          ctx.moveTo(x - crossSize, y);
          ctx.lineTo(x + crossSize, y);
          ctx.moveTo(x, y - crossSize);
          ctx.lineTo(x, y + crossSize);
          ctx.stroke();
        }
      }

      // 4. Moving Pulse Beams Travelling along Grid Lines
      pulses.forEach((pulse) => {
        pulse.pos += pulse.speed;

        const maxLimit = pulse.isVertical ? height : width;
        if (pulse.pos > maxLimit + pulse.length) {
          pulse.pos = -pulse.length;
          pulse.coord =
            Math.floor(
              (Math.random() * (pulse.isVertical ? width : height)) / gridSize
            ) * gridSize;
        }

        const grad = pulse.isVertical
          ? ctx.createLinearGradient(0, pulse.pos - pulse.length, 0, pulse.pos)
          : ctx.createLinearGradient(pulse.pos - pulse.length, 0, pulse.pos, 0);

        grad.addColorStop(0, "rgba(195, 230, 85, 0)");
        grad.addColorStop(0.7, `rgba(195, 230, 85, ${pulse.opacity})`);
        grad.addColorStop(1, "rgba(225, 250, 120, 0.8)");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        if (pulse.isVertical) {
          ctx.moveTo(pulse.coord, Math.max(0, pulse.pos - pulse.length));
          ctx.lineTo(pulse.coord, Math.min(height, pulse.pos));
        } else {
          ctx.moveTo(Math.max(0, pulse.pos - pulse.length), pulse.coord);
          ctx.lineTo(Math.min(width, pulse.pos), pulse.coord);
        }
        ctx.stroke();
      });

      // 5. Subtle Sweeping Laser Scanline
      scanY = (scanY + 0.8) % (height + 200);
      const scanGrad = ctx.createLinearGradient(0, scanY - 80, 0, scanY);
      scanGrad.addColorStop(0, "rgba(180, 220, 80, 0)");
      scanGrad.addColorStop(0.5, "rgba(180, 220, 80, 0.03)");
      scanGrad.addColorStop(1, "rgba(195, 230, 85, 0.08)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 80, width, 80);

      // 6. Central Vignette to keep card focus crisp
      const centerGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        180,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75
      );
      centerGrad.addColorStop(0, "rgba(8, 10, 13, 0.72)");
      centerGrad.addColorStop(0.5, "rgba(8, 10, 13, 0.4)");
      centerGrad.addColorStop(1, "rgba(8, 10, 13, 0.88)");
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, width, height);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
