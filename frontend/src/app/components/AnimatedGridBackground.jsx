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
    const gridSize = 50; // Clean, calm grid cell size
    const pulses = [];

    // Calm color palette matching Member 3 perception motifs:
    // Cyan (Line Centroid), Ocean Blue (Trajectory), and Soft Emerald (Clear Corridor)
    const calmColors = [
      { start: "rgba(6, 182, 212, 0)", mid: "rgba(6, 182, 212, 0.5)", end: "rgba(14, 165, 233, 0.85)" }, // Calm Cyan
      { start: "rgba(37, 99, 235, 0)", mid: "rgba(37, 99, 235, 0.45)", end: "rgba(99, 102, 241, 0.8)" },  // Serene Blue/Indigo
      { start: "rgba(16, 185, 129, 0)", mid: "rgba(16, 185, 129, 0.4)", end: "rgba(20, 184, 166, 0.75)" }, // Soft Corridor Teal
    ];

    // Initialize random light pulses along grid lines
    for (let i = 0; i < 16; i++) {
      pulses.push({
        isVertical: Math.random() > 0.5,
        coord: Math.floor(Math.random() * (Math.random() > 0.5 ? width : height) / gridSize) * gridSize,
        pos: Math.random() * (Math.random() > 0.5 ? height : width),
        speed: 0.9 + Math.random() * 1.5, // Calm, smooth gliding speed
        length: 70 + Math.random() * 90,
        palette: calmColors[i % calmColors.length],
      });
    }

    let time = 0;

    const render = () => {
      time += 0.012;

      // Mouse smoothing
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      // 1. Crisp, pure white-porcelain background
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      // 2. Soft, calm radial ambient illumination near mouse
      if (mouseRef.current.x > 0) {
        const mouseGrad = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          280
        );
        mouseGrad.addColorStop(0, "rgba(6, 182, 212, 0.06)");
        mouseGrad.addColorStop(0.5, "rgba(37, 99, 235, 0.03)");
        mouseGrad.addColorStop(1, "rgba(248, 250, 252, 0)");
        ctx.fillStyle = mouseGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Subtle Silver/Slate Grid Lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.16)"; // delicate slate-200 line

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

      // 4. Subtle Intersecting Crosshairs
      const crossSize = 3;
      for (let x = 0; x <= width; x += gridSize * 2) {
        for (let y = 0; y <= height; y += gridSize * 2) {
          const dx = x - mouseRef.current.x;
          const dy = y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let pointAlpha = 0.2;
          let pointColor = "rgba(148, 163, 184, ";

          if (dist < 180) {
            pointAlpha = 0.7 * (1 - dist / 180);
            pointColor = "rgba(6, 182, 212, ";
          }

          const breath = Math.sin(time * 2 + (x + y) * 0.01) * 0.05;
          ctx.strokeStyle = `${pointColor}${Math.max(0.08, pointAlpha + breath)})`;
          ctx.beginPath();
          ctx.moveTo(x - crossSize, y);
          ctx.lineTo(x + crossSize, y);
          ctx.moveTo(x, y - crossSize);
          ctx.lineTo(x, y + crossSize);
          ctx.stroke();
        }
      }

      // 5. Calm Moving Line Pulses (Cyan, Ocean Blue & Soft Teal)
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

        grad.addColorStop(0, pulse.palette.start);
        grad.addColorStop(0.6, pulse.palette.mid);
        grad.addColorStop(1, pulse.palette.end);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
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

      // 6. Central Soft Glow Behind Card
      const centerGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        100,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.6
      );
      centerGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      centerGrad.addColorStop(0.5, "rgba(248, 250, 252, 0.7)");
      centerGrad.addColorStop(1, "rgba(241, 245, 249, 0.9)");
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
      className="fixed inset-0 pointer-events-none z-0 bg-[#f8fafc]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
