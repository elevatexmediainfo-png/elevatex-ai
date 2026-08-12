import { Inter, JetBrains_Mono, Montserrat, Noto_Sans_Devanagari, Poppins } from "next/font/google";

// Section 12.1 — dual-font strategy: Inter (Latin) + Noto Sans Devanagari (Hindi).
// JetBrains Mono covers referral codes, hex values, GST numbers, code snippets.

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Caption pipeline fix (2026-08-17, stabilization audit finding #5) — the
// AI Auto-Edit caption prompt (gpt5.provider.ts's CAPTION_VOICE_AND_
// HIGHLIGHT_GUIDANCE) instructs GPT to set caption style.fontFamily to
// "Poppins" or "Montserrat", and the manual editor's own font picker
// (AVAILABLE_FONTS, lib/admin/config.ts) already lists "Poppins" as a
// choice — but neither font was ever actually LOADED anywhere in this
// codebase, confirmed by a full repo grep for fonts.googleapis.com/
// next/font/google/GoogleFont before this fix: the browser silently fell
// back to the generic system sans-serif whenever either name was set.
// Same EXISTING next/font/google mechanism as Inter/Noto Sans Devanagari
// above — no new package, no new font-loading architecture. Weights cover
// what the caption pipeline actually asks for: 400 (a plain/readable
// fallback), 600/700 (GPT's own "style.fontWeight 700-900" guidance's
// lower end), 800 (TextLayer's new strong-default weight, compositor-
// stage.tsx), 900 (heaviest, matches "ExtraBold" emphasis).
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["400", "600", "700", "800", "900"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["400", "600", "700", "800", "900"],
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const fontVariables = `${inter.variable} ${notoSansDevanagari.variable} ${jetbrainsMono.variable} ${poppins.variable} ${montserrat.variable}`;

// Caption pipeline fix (2026-08-17) — the --font-poppins/--font-montserrat
// CSS custom property NAMES set above (set on <body> via fontVariables,
// app/layout.tsx, which every route — including the AI Auto-Edit
// compositor and the headless export route it's stepped through, see
// export-worker.ts's page.goto("/editor/[id]/render") — already inherits
// through the SAME root layout, no separate mounting needed) are consumed
// by lib/video-editor/text-style.ts's CAPTION_FONT_FAMILY_CSS_VARS/
// resolveCaptionFontFamily(). Deliberately NOT re-declared/exported from
// THIS file: this module calls next/font/google at import time, which
// requires Next's own build pipeline — importing it from a plain vitest
// unit test (no such pipeline) is unsafe. text-style.ts is the existing,
// already-tested, framework-agnostic home for exactly this class of pure
// render-style logic (see that file's own resolveRunColor, 2026-08-15) —
// its CSS variable NAMES must stay in sync with the ones this file
// defines above; there is intentionally only ONE place (here) that ever
// calls Poppins({...})/Montserrat({...}) themselves.
