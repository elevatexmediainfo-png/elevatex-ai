"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Light/dark theming, per PRD Section 12.2.3 — detects prefers-color-scheme
// and persists a user override (wired to user preferences once the backend
// milestone lands; for now it persists to localStorage like next-themes default).
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
