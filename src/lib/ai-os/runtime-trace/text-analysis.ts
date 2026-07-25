import { measurePrompt, countEnumLeaks } from "../prompt-compiler";
import type { TextMetrics } from "./types";

// Phase 10.6D — Text analysis utilities.
// Reuses Phase 10.6A's own measurement methodology (measurePrompt,
// countEnumLeaks) wherever a stage's output is text — the same heuristic
// already proven against 500 real campaigns in prompt-compiler/regression.test.ts
// — rather than inventing a second, competing definition of "visual token
// ratio" for the trace to report.

/** Chars/4 heuristic — the same approximation used throughout this pipeline
 *  (provider-translator/shared/section-builders.ts's own estimateTokens). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function textMetricsFor(text: string): TextMetrics {
  if (!text) return { tokenCount: 0, visualTokenRatio: 0, abstractTokenRatio: 0 };
  const measured = measurePrompt(text);
  return {
    tokenCount: estimateTokens(text),
    visualTokenRatio: measured.visualTokenRatio,
    abstractTokenRatio: measured.abstractPct,
  };
}

export function enumLeakageFor(text: string): number {
  return countEnumLeaks(text);
}

/** Splits into clause-level fragments (matches the granularity Phase 10.6C's
 *  own duplication checks used) and returns the share that are exact
 *  duplicates of an earlier fragment. 0 when there are too few fragments to
 *  be meaningful. */
export function duplicateRatio(text: string): number {
  const clauses = text
    .split(/[.,]\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 12);
  if (clauses.length < 2) return 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const c of clauses) {
    if (seen.has(c)) duplicates++;
    seen.add(c);
  }
  return Math.round((duplicates / clauses.length) * 1000) / 1000;
}

/** Significant-word overlap — same technique already established in this
 *  codebase (hero-fusion.ts's overlapsExisting, prompt-compiler's
 *  isNearDuplicate): normalise, drop short/stop-ish words, compare sets. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "with", "this", "that", "from", "into",
  "onto", "their", "its", "his", "her", "who", "while", "being", "never",
  "always", "near", "just", "only", "then", "than", "also", "of", "in", "on",
  "at", "to", "is", "are", "was", "were", "been", "not", "as", "for", "by",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );
}

/** True when `candidate` (typically one sentence of a final provider prompt)
 *  substantially overlaps `source` (typically one PromptSpecification field's
 *  value) — the matching primitive the influence graph is built from. */
export function textOverlaps(source: string, candidate: string): boolean {
  if (!source || !candidate) return false;
  const lowerSource = source.toLowerCase();
  const lowerCandidate = candidate.toLowerCase();
  if (lowerCandidate.length > 8 && lowerSource.includes(lowerCandidate)) return true;
  const sourceWords = significantWords(source);
  const candidateWords = significantWords(candidate);
  if (candidateWords.size === 0) return false;
  let shared = 0;
  for (const w of candidateWords) if (sourceWords.has(w)) shared++;
  return shared / candidateWords.size >= 0.6;
}

/** Splits a final prompt string into sentence/clause-level units for
 *  provenance attribution — coarser than duplicateRatio's fragments (keeps
 *  full stops as the primary boundary; commas only for very long runs). */
export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .flatMap((s) => (s.length > 220 ? s.split(/,\s+/) : [s]))
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}
