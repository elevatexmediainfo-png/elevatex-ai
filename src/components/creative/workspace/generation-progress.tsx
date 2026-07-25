"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

const STAGES = [
  { label: "Understanding your vision" },
  { label: "Enhancing prompt intelligence" },
  { label: "Generating your image" },
  { label: "Upscaling detail" },
  { label: "Finishing touches" },
];

// Cumulative time thresholds (0-1) at which each stage begins
const THRESHOLDS = [0, 0.12, 0.30, 0.75, 0.90];
const CIRCUMFERENCE = 2 * Math.PI * 40; // r = 40

interface GenerationProgressProps {
  estimatedSeconds: number;
}

export const GenerationProgress = React.memo(function GenerationProgress({
  estimatedSeconds,
}: GenerationProgressProps) {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const startMs = Date.now();
    const totalMs = estimatedSeconds * 1000;
    const id = setInterval(() => {
      const elapsed = Date.now() - startMs;
      // Soft-cap at 92% — never shows 100% before the real response arrives
      setProgress(Math.min((elapsed / totalMs) * 0.92, 0.92));
    }, 120);
    return () => clearInterval(id);
  }, [estimatedSeconds]);

  // Active stage index
  let stageIdx = 0;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (progress >= THRESHOLDS[i]) {
      stageIdx = i;
      break;
    }
  }

  const pct = Math.round(progress * 100);
  const remaining = Math.max(1, Math.round(estimatedSeconds * (1 - progress)));
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-10 py-8 w-full max-w-xs">
      {/* Animated progress ring */}
      <div className="relative flex items-center justify-center size-36">
        {/* Ambient pulse */}
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.15, 0.30, 0.15] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute size-36 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.5) 0%, transparent 70%)" }}
        />

        {/* SVG ring */}
        <svg width="120" height="120" viewBox="0 0 100 100" className="absolute">
          {/* Track */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
          {/* Progress arc */}
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="url(#gp-gradient)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "50% 50%",
              transition: "stroke-dashoffset 0.15s linear",
            }}
          />
          <defs>
            <linearGradient id="gp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop stopColor="#A78BFA" />
              <stop offset="1" stopColor="#60A5FA" />
            </linearGradient>
          </defs>
        </svg>

        {/* Percentage */}
        <span className="relative text-[22px] font-bold tabular-nums text-white">{pct}%</span>
      </div>

      {/* Stage label */}
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={stageIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-[15px] font-semibold text-white"
          >
            {STAGES[stageIdx].label}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1.5 text-[13px] text-white/40">~{remaining}s remaining</p>
      </div>

      {/* Stage checklist */}
      <div className="flex flex-col gap-3 w-full">
        {STAGES.map((stage, i) => {
          const done = i < stageIdx;
          const active = i === stageIdx;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3"
            >
              <div
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                  done
                    ? "border-violet-500 bg-violet-500"
                    : active
                    ? "border-violet-400 bg-violet-400/15"
                    : "border-white/[0.10]"
                }`}
              >
                {done && <Check className="size-2.5 text-white" />}
                {active && (
                  <motion.span
                    animate={{ scale: [0.5, 1, 0.5], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                    className="size-2 rounded-full bg-violet-400"
                  />
                )}
              </div>
              <span
                className={`text-[12.5px] transition-colors duration-200 ${
                  done
                    ? "text-white/35 line-through"
                    : active
                    ? "font-medium text-white"
                    : "text-white/20"
                }`}
              >
                {stage.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});
