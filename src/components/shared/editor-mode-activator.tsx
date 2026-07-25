"use client";

import { useLayoutEffect } from "react";

// Sets data-editor on <html> synchronously before the browser paints so the
// CSS rules that suppress BackgroundEngine + CursorLight take effect in the
// same frame — zero visual flash. Removed on unmount so navigating away
// from the editor restores the global ambient effects immediately.
export function EditorModeActivator() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-editor", "true");
    return () => document.documentElement.removeAttribute("data-editor");
  }, []);

  return null;
}
