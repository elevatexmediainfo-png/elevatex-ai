"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

// Real light/dark switch for Dashboard + Marketing (Aurora Light pass,
// 2026-07-24) — wired to the app's existing next-themes provider (root
// layout), which already toggles the .dark class and persists the choice.
// Nothing before this component gave the user an explicit way to choose;
// it only ever followed OS preference. Deliberately NOT rendered inside
// the Video Editor (Phase 4, still untouched) — mount call sites control
// that, this component has no route awareness of its own.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid a hydration mismatch — resolvedTheme is unknown on the server.
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      title={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-full",
        "border border-edge-card bg-glass-soft text-dash-ink/60",
        "hover:text-dash-ink/90 hover:border-edge-hover hover:bg-glass-card",
        "transition-colors duration-150",
        className,
      )}
    >
      {!mounted ? (
        <span className="size-4" />
      ) : isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
