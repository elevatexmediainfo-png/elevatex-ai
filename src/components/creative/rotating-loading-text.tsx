"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

interface RotatingLoadingTextProps {
  messages: string[];
  /** Used to drive the "~N sec left" countdown and the simulated progress bar. Omit for an indeterminate spinner-only state. */
  estimatedSeconds?: number;
  /** How often the message rotates. Defaults to 2500ms. */
  intervalMs?: number;
}

// Shared "still working" UI for both the prompt-enhancement step and the
// image-generation step — same rotating-message + simulated-progress
// pattern, different message lists/estimates, so neither screen is ever
// blank while waiting on a real backend call whose exact duration isn't
// known in advance.
export function RotatingLoadingText({ messages, estimatedSeconds, intervalMs = 2500 }: RotatingLoadingTextProps) {
  const [messageIndex, setMessageIndex] = React.useState(0);
  const [elapsedMs, setElapsedMs] = React.useState(0);

  React.useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, messages.length - 1));
    }, intervalMs);
    return () => clearInterval(messageTimer);
  }, [messages.length, intervalMs]);

  React.useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => setElapsedMs(Date.now() - start), 200);
    return () => clearInterval(tick);
  }, []);

  const estimatedMs = (estimatedSeconds ?? 0) * 1000;
  // Soft-capped under 100% — real completion snaps the parent to the next
  // step, this bar only ever simulates progress while still waiting.
  const progressPct = estimatedMs > 0 ? Math.min(92, (elapsedMs / estimatedMs) * 100) : undefined;
  const secondsLeft = estimatedMs > 0 ? Math.max(0, Math.ceil((estimatedMs - elapsedMs) / 1000)) : undefined;

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="size-10 animate-spin rounded-full border-3 border-brand-navy-light border-t-brand-navy" />

      <AnimatePresence mode="wait">
        <motion.p
          key={messageIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="text-label-lg text-neutral-700"
        >
          {messages[messageIndex]}
        </motion.p>
      </AnimatePresence>

      {progressPct !== undefined && (
        <div className="flex w-full max-w-xs flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <motion.div
              className="h-full rounded-full bg-brand-navy"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          {secondsLeft !== undefined && (
            <p className="text-label-sm text-neutral-400">
              {secondsLeft > 0 ? `Estimated time: ${secondsLeft} sec left` : "Almost done..."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
