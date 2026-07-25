// Phase 10.6A — Banned language enforcement.
//
// The compiler must NEVER emit business/marketing/psychology framing in the
// compiled output, even as a side effect of enum expansion (e.g. the enum
// value "global_campaign" would naively expand to "global campaign", which
// re-introduces the banned word "campaign"). Two layers:
//   1. Targeted rephrase map — known phrases we want to KEEP the visual
//      meaning of, rewritten to avoid the banned word.
//   2. A sentence-level safety net — if a banned term survives rephrasing,
//      the whole sentence containing it is dropped rather than surgically
//      cutting the word (which risks leaving broken grammar behind).

/** Exact terms the compiler must never emit, per the Phase 10.6A brief. */
export const BANNED_TERMS: readonly string[] = [
  "campaign", "marketing", "brand", "conversion", "positioning", "awareness",
  "usp", "business", "commercial objective", "psychology", "psychological",
  "viewer should feel", "viewer must feel", "customer", "audience", "marketing intent",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BANNED_TERM_PATTERNS: RegExp[] = BANNED_TERMS.map(
  (term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i")
);

/** Known enum/phrase substitutions applied BEFORE the sentence-strip safety
 *  net, so visual meaning is preserved instead of being deleted outright. */
export const REPHRASE_MAP: Record<string, string> = {
  "global campaign": "internationally distributed production",
  "national commercial": "large-scale commercial production",
  "regional commercial": "local commercial production",
  "award winning creative": "award-recognised production",
  "brand mark placeholder": "identifying mark placeholder",
  "brand objects": "identifying mark elements",
  "brand mark": "identifying mark",
  "the brand's": "the business's physical",
  "brand's long-running story": "an established visual history",
};

export function applyRephraseMap(text: string): string {
  let result = text;
  for (const [from, to] of Object.entries(REPHRASE_MAP)) {
    result = result.replace(new RegExp(escapeRegExp(from), "gi"), to);
  }
  return result;
}

export function containsBannedLanguage(text: string): boolean {
  return BANNED_TERM_PATTERNS.some((re) => re.test(text));
}

export function findBannedTerms(text: string): string[] {
  const found: string[] = [];
  for (let i = 0; i < BANNED_TERMS.length; i++) {
    if (BANNED_TERM_PATTERNS[i].test(text)) found.push(BANNED_TERMS[i]);
  }
  return found;
}

/**
 * Splits at clause granularity, not just sentence boundaries. Hero Fusion and
 * VTE-derived text is routinely one long comma-joined "sentence" (established
 * throughout the Phase 10.5 audit series) — splitting only on periods would
 * mean a single stray banned word anywhere in that whole clause chain drops
 * the entire passage. Splitting on commas too means only the offending
 * clause is removed.
 */
function splitClauses(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|,\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Safety net: applies the rephrase map, then drops any clause that still
 * contains banned language. Returns the cleaned text and a count of how many
 * clauses were removed (for reporting). Rejoins with ", " since the source
 * text is predominantly comma-joined; trailing punctuation is normalised by
 * cleanPunctuation() downstream.
 */
export function stripBannedLanguage(text: string): { cleaned: string; removedCount: number } {
  if (!text) return { cleaned: text, removedCount: 0 };
  const rephrased = applyRephraseMap(text);
  const clauses = splitClauses(rephrased);
  const kept = clauses.filter((c) => !containsBannedLanguage(c));
  return { cleaned: kept.join(", "), removedCount: clauses.length - kept.length };
}
