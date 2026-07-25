"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Premium gradient button — the single CTA accent for the dashboard.
// Gradient: #7C3AED → #2563EB. Border radius: 16px (PRD system).
// Reused across: hero prompt box, create pages, and any dashboard CTA.
// Performance: motion.button with layout-safe transforms only (scale, opacity).

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  size?: "sm" | "default" | "lg";
}

export const GradientButton = React.memo(function GradientButton({
  children,
  loading = false,
  loadingText,
  size = "default",
  className,
  disabled,
  ...props
}: GradientButtonProps) {
  const sizeClasses = {
    sm: "h-9 px-4 text-[13px] gap-1.5",
    default: "h-11 px-5 text-[14px] gap-2",
    lg: "h-13 px-7 text-[15px] gap-2.5",
  }[size];

  const isDisabled = disabled || loading;

  return (
    <motion.button
      type="button"
      whileHover={isDisabled ? {} : { scale: 1.03, y: -1 }}
      whileTap={isDisabled ? {} : { scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
      disabled={isDisabled}
      aria-busy={loading}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-[16px]",
        "font-semibold text-white select-none outline-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]",
        sizeClasses,
        className,
      )}
      style={{
        background: "linear-gradient(155deg, #8B5CF6 0%, #6D28D9 35%, #2563EB 100%)",
        boxShadow:
          "0 4px 22px rgba(124,58,237,0.42), 0 2px 10px rgba(37,99,235,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {/* Shimmer sweep — runs on a loop, pauses on loading */}
      {!loading && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.18) 50%, transparent 80%)",
            backgroundSize: "200% 100%",
          }}
          animate={{ backgroundPositionX: ["-100%", "300%"] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
            repeatDelay: 1.5,
          }}
        />
      )}

      {/* Content */}
      <span className="relative z-10 inline-flex items-center gap-[inherit]">
        {loading ? (
          <>
            <LoadingDots />
            <span>{loadingText ?? "Loading…"}</span>
          </>
        ) : (
          children
        )}
      </span>
    </motion.button>
  );
});

// Three animated dots used as a loading indicator — more premium than a
// spinning Loader2 for a hero-level button.
function LoadingDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-white/80"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}
