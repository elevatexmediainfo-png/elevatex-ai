import type { UniversalPrompt } from "../schema";

// The brief's curated "always avoid" bank, merged with whatever
// negative_constraints the Creative Brain already inferred — never
// replaced, only extended — de-duplicated case-insensitively so a
// model-supplied "blurry" and the curated "blurry output" don't both
// survive as near-duplicates.
const CURATED_AVOID_BANK = [
  "generic AI look",
  "cheap design",
  "clipart",
  "low quality",
  "bad anatomy",
  "poor typography",
  "crowded layout",
  "wrong colors",
  "artifacts",
  "watermarks",
  "low resolution",
  "blurry output",
  "stock photo appearance",
];

export function buildNegativeConstraints(prompt: UniversalPrompt): string[] {
  const merged = [...prompt.negative_constraints, ...CURATED_AVOID_BANK];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of merged) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
