"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

// Section 12.11 — screen element appearances: fade + translateY, 200-300ms
// easeOut, staggered 30-50ms per item in lists/grids.
// Section 12.11 note — disabled entirely under prefers-reduced-motion.
export function FadeIn({
  children,
  delay = 0,
  className,
  y = 16,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.3, delay, ease: [0, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
