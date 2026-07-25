"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared Framer Motion micro-animation primitives for the Cloud Video
// Editor (2026-07-13 visual pass) — the whole point of building these once
// here is that every consumer applies the SAME transition (~200ms,
// easeOut), not a slightly-different one hand-tuned per call site. None of
// these touch drag/trim/resize interaction code (timeline-panel.tsx's own
// rAF-batched pointer handlers) — they're strictly hover/press/mount
// affordances on elements that aren't mid-gesture, so they can't compete
// with that code's direct style writes for the same frame.
const MICRO_TRANSITION = { duration: 0.2, ease: "easeOut" } as const;

// ---- Primary CTA button (Export, Upload media, Start Export, ...) ----
// Wraps Button's new `variant="editorPrimary"` (button.tsx) in the hover/
// press scale, the same wrapper-around-the-interactive-element pattern
// components/dashboard/gradient-tool-card.tsx already established
// elsewhere in this app. `size="none"` is intentionally NOT overridable —
// editorPrimary bakes in its own height/padding, so letting a caller pass
// a competing `size` would just create the exact per-instance-hand-styling
// mess this pass is meant to remove.
export function MotionPrimaryButton({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { scale: 1.03 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={MICRO_TRANSITION}
      className={className}
    >
      <Button variant="editorPrimary" size="none" className="w-full" {...props}>
        {children}
      </Button>
    </motion.div>
  );
}

// ---- Hover-scale card (media library grid/upload cards) ----
// whileHover only, deliberately no whileTap: every card this wraps also
// carries a real `draggable` attribute for HTML5 drag-to-timeline — a
// press-triggered transform from whileTap would apply before the browser
// captures the native drag-ghost image, shrinking it. Hover has no such
// interaction with dragstart, so it's safe.
//
// Two real DOM nodes, not one, and deliberately not `display:contents` on
// the inner one: motion.div's TypeScript types redefine onDragStart/onDrag/
// onDragEnd for Framer's OWN pan-gesture system (a real, confirmed type
// conflict with the native HTML5 DragEvent these cards need for
// drag-to-timeline), and native drag-and-drop on a `display:contents`
// element is inconsistent across browsers. So the outer motion.div owns
// only the hover-scale animation and the card's box styling (border/
// radius/shadow/overflow-hidden, via `className`, plus `position:relative`
// so the card's absolute-positioned favorite/add/remove buttons anchor
// correctly); a plain inner <div> — untouched by Framer Motion's types —
// carries the real `draggable`/`onDragStart`/`title` native attributes.
export function MotionCard({
  className,
  draggable,
  onDragStart,
  title,
  children,
}: {
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  title?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      transition={MICRO_TRANSITION}
      className={cn("group relative z-0 hover:z-10", className)}
    >
      <div draggable={draggable} onDragStart={onDragStart} title={title} className="flex h-full w-full flex-col">
        {children}
      </div>
    </motion.div>
  );
}

// ---- Panel-switch fade-in ----
// Entrance-only (no exit animation): the Creative Studio Sidebar swaps
// between structurally-different panels (Uploads' grid vs. Fonts' list vs.
// Brand Kit's form, all different heights), so cross-fading old-out/new-in
// would briefly show both and jump the layout. A plain fade-in on the
// newly-mounted panel gets the "panel switch isn't an abrupt cut" feel
// asked for without that risk.
export function MotionPanelFade({ panelKey, className, children }: { panelKey: string; className?: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={panelKey}
      initial={reduceMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={MICRO_TRANSITION}
      className={className}
    >
      {children}
    </motion.div>
  );
}
