"use client";

import React, { useEffect, useRef } from "react";

const GLYPHS = [
  "PDF",
  "ZIP",
  "TAR",
  "PNG",
  "JPG",
  "WEBP",
  "DOCX",
  "CSV",
  "JSON",
  "SVG",
  "XML",
  "MD",
  "7Z",
  "GZ",
  "⇄",
  "01",
];

export function GlyphMatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isReducedMotion = mediaQuery.matches;

    const handleMediaChange = (e: MediaQueryListEvent) => {
      isReducedMotion = e.matches;
    };
    mediaQuery.addEventListener("change", handleMediaChange);

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    const fontSize = 11;
    const colWidth = 32;
    let columns = 0;
    let drops: number[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);

      columns = Math.floor(width / colWidth);
      drops = [];
      for (let i = 0; i < columns; i++) {
        // Randomize initial vertical position
        drops[i] = Math.random() * (height / fontSize);
      }
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    let lastTime = 0;
    const interval = 80; // ~12 fps for subtle, non-distracting drift

    const draw = (currentTime: number) => {
      if (!ctx || width === 0 || height === 0) return;

      if (isReducedMotion) {
        // Render a single static subtle pattern without motion loop
        ctx.clearRect(0, 0, width, height);
        ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
        ctx.fillStyle = "rgba(79, 70, 229, 0.04)";
        for (let i = 0; i < columns; i += 2) {
          const glyph = GLYPHS[(i * 3) % GLYPHS.length];
          const y = (i * 24) % height;
          ctx.fillText(glyph, i * colWidth, y);
        }
        return;
      }

      if (currentTime - lastTime < interval) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }
      lastTime = currentTime;

      // Soft trail clearing
      ctx.fillStyle = "rgba(247, 248, 252, 0.15)";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Alternate colors between subtle slate and primary tint
        ctx.fillStyle =
          i % 3 === 0 ? "rgba(79, 70, 229, 0.05)" : "rgba(107, 114, 128, 0.05)";

        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = i * colWidth;
        const y = drops[i] * fontSize;

        ctx.fillText(glyph, x, y);

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.4;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]"
      />
    </div>
  );
}
