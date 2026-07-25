"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTheme } from "next-themes";

// 4 large blurred mesh blobs. Parallax depth: near layers move faster.
// Opacity-breathing loop ensures they never feel fully static.
// baseOpacity values are dark-mode tuned (near-black ground); LIGHT_FACTOR
// dials them back for a light ground, where the same alpha reads as a much
// more assertive tinted wash rather than a subtle atmosphere.
const LIGHT_FACTOR = 0.45;

const BLOBS = [
  { className: "-left-32 -top-20 size-[480px]", color: "99,102,241", baseOpacity: 0.13, duration: 32, parallax: 65 },
  { className: "-right-24 top-10 size-[440px]", color: "168,85,247", baseOpacity: 0.11, duration: 38, parallax: 40 },
  { className: "left-1/3 bottom-0 size-[420px]", color: "6,182,212", baseOpacity: 0.09, duration: 28, parallax: 22 },
  { className: "right-1/4 bottom-1/3 size-[380px]", color: "59,130,246", baseOpacity: 0.08, duration: 35, parallax: 12 },
];

function ParallaxBlob({
  className,
  color,
  baseOpacity,
  duration,
  parallax,
  scrollYProgress,
}: (typeof BLOBS)[number] & { scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const y = useTransform(scrollYProgress, [0, 1], [0, parallax]);
  return (
    <motion.div
      className={`absolute rounded-full blur-[120px] ${className}`}
      style={{ backgroundColor: `rgba(${color},${baseOpacity})`, y }}
      animate={{ opacity: [baseOpacity * 0.65, baseOpacity, baseOpacity * 0.65] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
    />
  );
}

// Layered scroll-reactive ambient atmosphere. Every animated property is
// transform/opacity/background-color — compositor only, no layout triggers.
export function AmbientBackground() {
  const { scrollYProgress } = useScroll();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isLight = mounted && resolvedTheme === "light";
  const factor = isLight ? LIGHT_FACTOR : 1;

  const washColor = useTransform(
    scrollYProgress,
    [0, 0.33, 0.66, 1],
    isLight
      ? [
          "rgba(99,102,241,0.018)",
          "rgba(59,130,246,0.018)",
          "rgba(6,182,212,0.016)",
          "rgba(168,85,247,0.018)",
        ]
      : [
          "rgba(99,102,241,0.04)",
          "rgba(59,130,246,0.04)",
          "rgba(6,182,212,0.035)",
          "rgba(168,85,247,0.04)",
        ]
  );

  const ringScale = useTransform(scrollYProgress, [0, 0.4], [1, 1.35]);
  const ringOpacity = useTransform(scrollYProgress, [0, 0.4], [0.45 * factor, 0.10 * factor]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLOBS.map((b, i) => (
        <ParallaxBlob key={i} {...b} baseOpacity={b.baseOpacity * factor} scrollYProgress={scrollYProgress} />
      ))}

      {/* Holographic focal ring — expands and fades on scroll */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-0 size-[600px] -translate-x-1/2 rounded-full"
        style={{
          scale: ringScale,
          opacity: ringOpacity,
          background: "radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 70%)",
        }}
      />

      {/* Section-transition wash — full-bleed, near-invisible, evolves with scroll */}
      <motion.div className="absolute inset-0" style={{ backgroundColor: washColor }} />
    </div>
  );
}
