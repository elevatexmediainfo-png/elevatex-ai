"use client";

import { useEffect } from "react";

// Tracks cursor position via RAF, updates CSS vars on <html>.
// The radial gradient div reads those vars at paint time — no React re-renders.
// Lerp factor 0.12 = barely perceptible lag, completely eliminates mouse jitter.
export function CursorLight() {
  useEffect(() => {
    let rafId: number;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let initialized = false;

    function onMove(e: MouseEvent) {
      if (!initialized) {
        cx = e.clientX;
        cy = e.clientY;
        initialized = true;
      }
      tx = e.clientX;
      ty = e.clientY;
    }

    function tick() {
      if (initialized) {
        cx += (tx - cx) * 0.12;
        cy += (ty - cy) * 0.12;
        const root = document.documentElement;
        root.style.setProperty("--cursor-x", `${Math.round(cx)}px`);
        root.style.setProperty("--cursor-y", `${Math.round(cy)}px`);
      }
      rafId = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="lv-cursor-light"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        pointerEvents: "none",
        // CSS vars react to DOM updates — browser repaints this without React re-renders.
        // --cursor-glow-1/-2 flip between a dark- and light-tuned alpha (globals.css).
        background:
          "radial-gradient(700px circle at var(--cursor-x, 50vw) var(--cursor-y, 50vh), var(--cursor-glow-1), var(--cursor-glow-2) 40%, transparent 70%)",
      }}
    />
  );
}
