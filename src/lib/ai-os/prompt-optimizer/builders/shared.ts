// Shared utilities for all 11 Prompt Optimization Engine builders.

/** Removes common verbosity patterns from field values without changing meaning. */
export function compress(text: string, maxLength: number): string {
  if (!text || text === "unknown") return text;
  let t = text;
  // Remove source-module prefixes added by promoteField()
  t = t.replace(/^\[(scene\.[^]]+|hero\.[^]]+|composition\.[^]]+|camera\.[^]]+|lighting\.[^]]+|environment\.[^]]+|marketing\.[^]]+|brand\.[^]]+|rendering\.[^]]+|negative\.[^]]+|typography\.[^]]+)\]\s*/gi, "");
  // Remove filler opener phrases
  t = t.replace(/^(This scene must (visually )?communicate|The image must|This image should|In order to|As the creative director notes,?)\s*/gi, "");
  // Remove redundant self-referential phrases
  t = t.replace(/\b(this (scene|image|creative|ad|advertisement))\b\s*/gi, "");
  // Remove doubled spaces
  t = t.replace(/\s{2,}/g, " ").trim();
  // Phase 10.4K.4 — Semantic truncation strategy.
  // Prefer sentence boundary: a complete thought is more meaningful than a mid-clause fragment.
  // Only fall back to word boundary when no sentence fits within budget.
  if (t.length > maxLength) {
    const sentenceEnd = t.lastIndexOf(". ", maxLength);
    if (sentenceEnd > maxLength * 0.6) {
      t = t.slice(0, sentenceEnd + 1); // complete sentence — no ellipsis needed
    } else {
      const cutAt = t.lastIndexOf(" ", maxLength - 3);
      t = cutAt > maxLength * 0.7 ? t.slice(0, cutAt) + "..." : t.slice(0, maxLength - 3) + "...";
    }
  }
  return t;
}

/** Word-set based similarity (Jaccard) for duplicate detection. */
export function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Extracts named entities (noun phrases) from a field value. */
export function extractEntities(text: string): string[] {
  if (!text || text === "unknown") return [];
  // Simple noun phrase extraction: capitalize words + multi-word noun phrases
  const words = text
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !/^(this|that|with|from|into|over|under|before|after|when|where|which|their|there|here|have|been|will|would|should|could|might|must|shall)$/i.test(w));
  return [...new Set(words.slice(0, 8))];
}

/** Clamps a value to [0, 100]. */
export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
