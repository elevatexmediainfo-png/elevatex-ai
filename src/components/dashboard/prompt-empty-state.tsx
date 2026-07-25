"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { LayoutTemplate } from "lucide-react";

// Purely decorative empty state — appears in the hero section before the
// user has typed anything. No interactive logic. Animated via Framer Motion
// compositor-only properties (transform + opacity) — no layout thrash.
export function PromptEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="flex flex-col items-center gap-6 py-8"
      aria-hidden
    >
      {/* Illustration */}
      <div className="relative flex items-center justify-center w-40 h-40">
        {/* Outer ambient ring */}
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.15, 0.30, 0.15] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute size-40 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)",
          }}
        />

        {/* Slow dashed orbit ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute size-28 rounded-full"
          style={{
            border: "1px dashed rgba(124,58,237,0.20)",
          }}
        />

        {/* Counter-rotating ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          className="absolute size-20 rounded-full"
          style={{
            border: "1px solid rgba(37,99,235,0.15)",
          }}
        />

        {/* Core orb — floats up and down */}
        <motion.div
          animate={{ y: [-5, 5, -5] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex size-16 items-center justify-center rounded-full"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(37,99,235,0.18) 100%)",
            border: "1.5px solid rgba(124,58,237,0.30)",
            boxShadow:
              "0 8px 32px rgba(124,58,237,0.20), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          <StarSVG />
        </motion.div>

        {/* Orbital sparkle dots */}
        {SPARKLES.map((s, i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              delay: s.delay,
              ease: "easeInOut",
            }}
            className="absolute rounded-full"
            style={{
              width: s.size,
              height: s.size,
              background:
                "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)",
              top: s.top,
              left: s.left,
              right: s.right,
              bottom: s.bottom,
            }}
          />
        ))}
      </div>

      {/* Text */}
      <div className="text-center space-y-1.5">
        <p className="text-[15px] font-semibold text-dash-ink/60 tracking-[-0.1px]">
          Your creation will appear here
        </p>
        <p className="text-[13px] text-dash-ink/30">
          Describe what you want to create above, then hit Generate
        </p>
      </div>

      {/* CTA */}
      <Link
        href="/templates"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium text-dash-ink/45 border border-dash-ink/[0.08] bg-dash-ink/[0.03] hover:text-dash-ink/70 hover:border-dash-ink/[0.14] hover:bg-dash-ink/[0.06] transition-all duration-200"
      >
        <LayoutTemplate className="size-3.5" />
        Browse video templates
      </Link>
    </motion.div>
  );
}

function StarSVG() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
    >
      <path
        d="M14 3L15.8 10.5H22L16.9 14.5L19 22L14 17.5L9 22L11.1 14.5L6 10.5H12.2L14 3Z"
        fill="url(#empty-star)"
      />
      <defs>
        <linearGradient
          id="empty-star"
          x1="6"
          y1="3"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const SPARKLES = [
  { top: "8%", left: "12%", delay: 0, size: 5 },
  { top: "15%", right: "10%", delay: 0.6, size: 4 },
  { bottom: "12%", left: "8%", delay: 1.1, size: 4 },
  { bottom: "8%", right: "14%", delay: 0.85, size: 5 },
  { top: "48%", left: "0%", delay: 0.3, size: 3 },
  { top: "52%", right: "0%", delay: 1.4, size: 3 },
];
