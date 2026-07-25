"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Wand2 } from "lucide-react";

const EXAMPLE_PROMPTS = [
  "Luxury villa Facebook ad with golden hour lighting",
  "Modern minimalist restaurant Instagram post, clean aesthetic",
  "Grand opening poster for a gym, bold and energetic",
  "Professional dental clinic social media graphic, clean and trust-inspiring",
];

interface CanvasEmptyStateProps {
  onExampleClick: (prompt: string) => void;
}

export function CanvasEmptyState({ onExampleClick }: CanvasEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="flex flex-col items-center gap-10 py-6 w-full max-w-lg"
    >
      {/* Animated orb illustration */}
      <div className="relative flex size-44 items-center justify-center">
        {/* Outer ambient glow */}
        <motion.div
          animate={{ scale: [1, 1.14, 1], opacity: [0.10, 0.22, 0.10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute size-44 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.5) 0%, transparent 70%)" }}
        />

        {/* Outer orbit ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute size-36 rounded-full"
          style={{ border: "1.5px dashed rgba(124,58,237,0.18)" }}
        />

        {/* Inner orbit ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          className="absolute size-24 rounded-full"
          style={{ border: "1px solid rgba(37,99,235,0.12)" }}
        />

        {/* Core orb — floats */}
        <motion.div
          animate={{ y: [-7, 7, -7] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex size-20 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(37,99,235,0.16) 100%)",
            border: "1.5px solid rgba(124,58,237,0.28)",
            boxShadow: "0 16px 48px rgba(124,58,237,0.18), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          <Wand2 className="size-8 text-violet-400" />
        </motion.div>

        {/* Orbiting sparkle dots */}
        {[0, 120, 240].map((deg, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.75, ease: "easeInOut" }}
            className="absolute size-3 rounded-full"
            style={{
              background: "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)",
              top: `${50 - 40 * Math.cos((deg * Math.PI) / 180)}%`,
              left: `${50 + 40 * Math.sin((deg * Math.PI) / 180)}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>

      {/* Heading */}
      <div className="text-center">
        <h3 className="text-[19px] font-semibold text-white/55">Your canvas is ready</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/30">
          Describe your vision in the prompt box,
          <br />
          then click Generate to bring it to life.
        </p>
      </div>

      {/* Example prompts */}
      <div className="w-full">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/25">
          Try an example
        </p>
        <div className="flex flex-col gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <motion.button
              key={prompt}
              whileHover={{ x: 3 }}
              transition={{ duration: 0.14 }}
              onClick={() => onExampleClick(prompt)}
              className="group text-left rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-[13px] text-white/45 transition-all duration-150 hover:border-violet-500/25 hover:bg-violet-500/[0.04] hover:text-white/75"
            >
              <span className="mr-2 text-white/20 group-hover:text-violet-500/60">→</span>
              {prompt}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
