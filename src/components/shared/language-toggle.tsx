"use client";

import * as React from "react";
import { Globe } from "lucide-react";

import { cn } from "@/lib/utils";

// PRD Section 11 (SCR-002 / SCR-008) — Globe icon + "हिंदी" label, top-right
// of marketing/auth screens. Toggles instantly via i18n lookup (no page
// reload). Full i18next wiring lands with the localisation milestone — for
// now this is a self-contained visual toggle so the landing page reflects
// the intended interaction.
export function LanguageToggle({ className }: { className?: string }) {
  const [lang, setLang] = React.useState<"en" | "hi">("en");

  return (
    <button
      type="button"
      onClick={() => setLang((l) => (l === "en" ? "hi" : "en"))}
      aria-label={lang === "en" ? "Switch to Hindi" : "Switch to English"}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-300 px-3 text-label-sm text-neutral-700 transition-colors hover:border-brand-navy hover:bg-brand-navy-light hover:text-brand-navy",
        className
      )}
    >
      <Globe className="size-4" />
      <span lang={lang === "hi" ? "hi" : "en"}>
        {lang === "en" ? "हिंदी" : "English"}
      </span>
    </button>
  );
}
