"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

import { formatBytes } from "@/lib/format";

interface AnimatedCounterProps {
  value: number;
  // A function prop can't cross the Server -> Client Component boundary
  // (Next can't serialize it into the RSC payload) — so this is a fixed
  // discriminator the client component formats locally, not an arbitrary
  // formatter passed in from the server.
  unit?: "bytes";
}

function format(value: number, unit?: "bytes"): string {
  if (unit === "bytes") return formatBytes(value);
  return value.toLocaleString("en-IN");
}

export function AnimatedCounter({ value, unit }: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 24, stiffness: 90 });
  const display = useTransform(spring, (v) => format(Math.round(v), unit));
  const [text, setText] = React.useState(format(0, unit));

  React.useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  React.useEffect(() => {
    const unsubscribe = display.on("change", (v) => setText(v));
    return unsubscribe;
  }, [display]);

  return <motion.span>{text}</motion.span>;
}
