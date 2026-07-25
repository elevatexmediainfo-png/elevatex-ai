"use client";

// BackgroundEngine is the only import other components need. It is:
//   1. SSR-safe — the heavy Three.js canvas is dynamic-imported with ssr:false
//   2. Accessibility-aware — respects prefers-reduced-motion (no motion = null)
//   3. Zero layout impact — the canvas is position:fixed, z-index:0, pointer-events:none
//
// Usage: drop <BackgroundEngine /> anywhere in the tree. Every page automatically
// inherits the premium animated background. On reduced-motion devices the canvas
// is simply omitted; the page's own CSS background colour acts as the fallback.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const BackgroundScene = dynamic(
  () => import("./background-scene").then((m) => ({ default: m.BackgroundScene })),
  { ssr: false }
);

export function BackgroundEngine() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only render on the client, and only when the user hasn't opted into
    // reduced motion. We check once on mount — the canvas doesn't hot-reload
    // this setting (acceptable: an accessibility setting change requires a
    // page refresh in virtually all web apps).
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!mq.matches) setShow(true);
  }, []);

  if (!show) return null;
  return <BackgroundScene />;
}
