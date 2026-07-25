"use client";

import { useLayoutEffect } from "react";

// Pins the global 3D background canvas (BackgroundScene) to one theme
// regardless of the site-wide light/dark toggle — same
// set-before-paint/clean-up-on-unmount pattern as EditorModeActivator.
// Needed for surfaces (currently: /login) that render their own dark,
// theme-independent foreground (matching bg-[#0B0F19] fallback, text-white
// throughout) and are out of this pass's scope to retheme — without this,
// a user who picked "light" on the Dashboard would see the now-light 3D
// canvas show through/around login's still-dark glass card, a real visual
// break rather than a deliberate design choice.
export function ForceSceneTheme({ theme }: { theme: "light" | "dark" }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-force-scene-theme", theme);
    return () => document.documentElement.removeAttribute("data-force-scene-theme");
  }, [theme]);

  return null;
}
