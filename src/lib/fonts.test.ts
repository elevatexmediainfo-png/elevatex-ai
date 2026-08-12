import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Caption pipeline fix (2026-08-17, stabilization audit finding #5) —
// lib/fonts.ts calls next/font/google at import time, which requires
// Next's own build-time SWC transform to produce real values; imported
// directly under plain vitest (confirmed empirically while building this
// fix — `Inter is not a function`), every export in that file throws
// immediately. This was already true before this fix (Inter/JetBrains
// Mono/Noto Sans Devanagari), not something this change introduced. So
// this test verifies the file's own SOURCE TEXT instead of importing it —
// the same "can't build a real render harness, so verify the contract
// text-based" approach this codebase already uses for GPT prompts
// (gpt5.provider.test.ts's own userMessage.toContain() assertions). The
// real runtime behavior (does next/font/google actually load these fonts)
// is verified by Next's own build, not here — this test only guards
// against a regression to the exact shape TextLayer/text-style.ts depend
// on (the two CSS variable names, the weights the caption pipeline needs).
const FONTS_SOURCE = readFileSync(join(__dirname, "fonts.ts"), "utf-8");

describe("lib/fonts.ts — Poppins/Montserrat are actually loaded", () => {
  it("imports Poppins and Montserrat from next/font/google (the existing mechanism, no new package)", () => {
    expect(FONTS_SOURCE).toContain("next/font/google");
    expect(FONTS_SOURCE).toMatch(/import\s*\{[^}]*\bPoppins\b[^}]*\}\s*from\s*"next\/font\/google"/);
    expect(FONTS_SOURCE).toMatch(/import\s*\{[^}]*\bMontserrat\b[^}]*\}\s*from\s*"next\/font\/google"/);
  });

  it("declares the exact CSS variable names text-style.ts's CAPTION_FONT_FAMILY_CSS_VARS depends on", () => {
    expect(FONTS_SOURCE).toContain('variable: "--font-poppins"');
    expect(FONTS_SOURCE).toContain('variable: "--font-montserrat"');
  });

  it("loads the weights the caption pipeline actually needs (700/800/900 emphasis range)", () => {
    const poppinsBlock = FONTS_SOURCE.slice(FONTS_SOURCE.indexOf("Poppins({"), FONTS_SOURCE.indexOf("});", FONTS_SOURCE.indexOf("Poppins({")));
    const montserratBlock = FONTS_SOURCE.slice(FONTS_SOURCE.indexOf("Montserrat({"), FONTS_SOURCE.indexOf("});", FONTS_SOURCE.indexOf("Montserrat({")));
    for (const block of [poppinsBlock, montserratBlock]) {
      expect(block).toContain('"700"');
      expect(block).toContain('"800"');
      expect(block).toContain('"900"');
    }
  });

  it("mounts both fonts into fontVariables, the string applied on <body> in app/layout.tsx (inherited by every route, including the compositor's own headless export route)", () => {
    expect(FONTS_SOURCE).toMatch(/fontVariables\s*=\s*`[^`]*\$\{poppins\.variable\}[^`]*\$\{montserrat\.variable\}[^`]*`/);
  });

  it("does not remove or change the existing Inter, JetBrains Mono, or Noto Sans Devanagari fonts", () => {
    expect(FONTS_SOURCE).toContain('variable: "--font-inter"');
    expect(FONTS_SOURCE).toContain('variable: "--font-jetbrains-mono"');
    expect(FONTS_SOURCE).toContain('variable: "--font-noto-devanagari"');
    expect(FONTS_SOURCE).toMatch(/fontVariables\s*=\s*`\$\{inter\.variable\}/);
  });
});
