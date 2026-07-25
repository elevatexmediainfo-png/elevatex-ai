import type { ConceptKey, IndustryKey } from "./types";
import { CONCEPT_ALIASES, INDUSTRY_ALIASES, UNIVERSAL_CONCEPTS } from "./knowledge/index";

// ─────────────────────────────────────────────────────────────────────────────
// Concept resolution
// ─────────────────────────────────────────────────────────────────────────────

export interface ConceptResolution {
  readonly normalized: ConceptKey;
  readonly aliasUsed: boolean;
  readonly known: boolean;
}

/**
 * Normalises an input concept string to its canonical key.
 * Tries direct match first; falls back to alias lookup; returns input lowercased
 * when neither succeeds (unknown concept — engine will use generic fallback).
 */
export function resolveConcept(raw: string): ConceptResolution {
  const lower = raw.trim().toLowerCase();

  // Direct hit in the universal concept map
  if (lower in UNIVERSAL_CONCEPTS) {
    return { normalized: lower, aliasUsed: false, known: true };
  }

  // Alias hit
  const aliasTarget = CONCEPT_ALIASES[lower];
  if (aliasTarget !== undefined) {
    return { normalized: aliasTarget, aliasUsed: true, known: true };
  }

  // Unknown — preserve the caller's input as-is (lowercased)
  return { normalized: lower, aliasUsed: false, known: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Industry resolution
// ─────────────────────────────────────────────────────────────────────────────

export interface IndustryResolution {
  readonly key: IndustryKey | "unknown";
  readonly aliasUsed: boolean;
  readonly known: boolean;
}

/**
 * Normalises an input industry string to its canonical IndustryKey.
 * Tokenises multi-word inputs (e.g. "dental clinic" → checks "dental clinic"
 * then individual tokens) to maximise match rate without exhaustive fuzzy logic.
 */
export function resolveIndustry(raw: string | undefined): IndustryResolution {
  if (!raw) return { key: "unknown", aliasUsed: false, known: false };

  const lower = raw.trim().toLowerCase();

  // Exact alias match
  const exact = INDUSTRY_ALIASES[lower];
  if (exact !== undefined) {
    return { key: exact, aliasUsed: true, known: true };
  }

  // Token-level match — check if any individual word resolves
  const tokens = lower.split(/\s+/);
  for (const token of tokens) {
    const match = INDUSTRY_ALIASES[token];
    if (match !== undefined) {
      return { key: match, aliasUsed: true, known: true };
    }
  }

  // Substring match — check if any alias is a substring of the input
  for (const [alias, key] of Object.entries(INDUSTRY_ALIASES)) {
    if (lower.includes(alias)) {
      return { key, aliasUsed: true, known: true };
    }
  }

  return { key: "unknown", aliasUsed: false, known: false };
}
