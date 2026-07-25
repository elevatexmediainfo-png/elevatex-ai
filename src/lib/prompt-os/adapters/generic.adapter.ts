import type { UniversalPrompt } from "../schema";

// Provider Prompt Optimization — every describeX() below used to assume
// every field was a short tag and the per-provider builders comma-joined
// them with a single trailing period. Now that the Prompt Expander Engine
// routinely fills these fields with full, already-punctuated sentences
// (e.g. style.mood combining the model's own mood with the Creative
// Brief's emotionalDirection), naive comma-joining produced literal broken
// grammar — confirmed in real production output:
// "...evoking a sense of well-being and self-care. mood, high luxury feel..."
// The shared utilities below fix that at its root: a fragment that's
// already a complete sentence is never comma-spliced or suffix-appended:
// it's kept as its own sentence. A fragment that's still a short tag keeps
// the original suffix-appending behavior unchanged.

function endsWithSentencePunctuation(s: string): boolean {
  return /[.!?]\s*$/.test(s);
}

function capitalizeFirst(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// Only appends a short descriptive suffix ("mood", "luxury feel", "angle")
// when the value is itself a short tag. A value that's already a complete
// sentence (Prompt Expander output) is returned untouched — appending a
// bare noun after a sentence-ending period is exactly the confirmed bug.
export function tagOrSentence(value: string, suffix: string): string {
  return endsWithSentencePunctuation(value) ? value : `${value} ${suffix}`;
}

// The central fix. Splits fragments into short tags (no terminal
// punctuation — comma-joined into ONE sentence, same as before) vs
// fragments that are already complete sentences (kept as their own
// sentence, properly capitalized, space-separated) — instead of always
// comma-joining everything and slapping a single period on the end.
//
// `label`, when given (e.g. "Shot with"), is prepended ONLY to the
// short-tag clause ("Shot with rule-of-thirds, centered subject.") — it is
// never glued onto an already-complete sentence, which would itself read
// as broken grammar ("Shot with The villa glows in golden light." is just
// as wrong as the original bug this fixes). Complete-sentence fragments are
// always appended afterward as their own independent, properly capitalized
// statements.
export function composeFluently(fragments: string[], label?: string): string {
  const clean = fragments.map((f) => f.trim()).filter(Boolean);
  if (!clean.length) return "";

  const shortTags: string[] = [];
  const sentences: string[] = [];
  for (const f of clean) {
    if (endsWithSentencePunctuation(f)) {
      sentences.push(capitalizeFirst(f));
    } else {
      shortTags.push(f);
    }
  }

  const parts: string[] = [];
  if (shortTags.length) {
    const tagClause = shortTags.join(", ");
    parts.push(label ? `${label} ${tagClause}.` : `${capitalizeFirst(tagClause)}.`);
  }
  parts.push(...sentences);
  return parts.join(" ");
}

// Flux/SDXL tag-style prompts are a different convention from prose — never
// full sentences. A long Expander fragment degrades into a clean tag
// (terminal punctuation stripped, first letter lowercased to match the
// surrounding tag list) rather than leaving a stray period mid-list.
export function toTag(fragment: string): string {
  const trimmed = fragment.trim().replace(/[.!?]+$/, "");
  if (!trimmed) return "";
  return endsWithSentencePunctuation(fragment) ? trimmed[0].toLowerCase() + trimmed.slice(1) : trimmed;
}

function normalizeForSimilarity(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
}

function wordSet(s: string): Set<string> {
  return new Set(normalizeForSimilarity(s).split(/\s+/).filter(Boolean));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersectionSize = [...a].filter((w) => b.has(w)).length;
  const unionSize = new Set([...a, ...b]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

// Provider Prompt Optimization, issue #5 — the Creative Director's
// attentionHook and the Creative Brain's own psychologyHooks sometimes
// describe the same idea in two near-identical sentences (confirmed in
// production: "...communicates transformation and luxury" vs "...
// immediately communicates transformation and luxury."), which exact-match
// dedup upstream doesn't catch since the wording differs mid-sentence.
// Word-overlap (Jaccard) similarity catches this without needing a full
// edit-distance library; the richer (longer) phrasing is kept.
const SIMILARITY_THRESHOLD = 0.6;

export function dedupeSimilarPhrases(phrases: string[]): string[] {
  const kept: { text: string; words: Set<string> }[] = [];
  for (const raw of phrases) {
    const text = raw.trim();
    if (!text) continue;
    const words = wordSet(text);
    const dupeIndex = kept.findIndex((k) => jaccardSimilarity(k.words, words) >= SIMILARITY_THRESHOLD);
    if (dupeIndex === -1) {
      kept.push({ text, words });
    } else if (text.length > kept[dupeIndex].text.length) {
      kept[dupeIndex] = { text, words };
    }
  }
  return kept.map((k) => k.text);
}

// Shared field-flattening helpers — every adapter pulls the same facts out
// of the Universal JSON Prompt, they just phrase/order them differently per
// vendor. Kept here (not duplicated per adapter) since the underlying data
// extraction is identical regardless of target vendor.
export function describeSubject(prompt: UniversalPrompt): string[] {
  const parts: string[] = [];
  if (prompt.style.aesthetic) parts.push(prompt.style.aesthetic);
  if (prompt.style.mood) parts.push(tagOrSentence(prompt.style.mood, "mood"));
  if (prompt.style.luxuryLevel) parts.push(tagOrSentence(prompt.style.luxuryLevel, "luxury feel"));
  if (prompt.style.modernLevel) parts.push(tagOrSentence(prompt.style.modernLevel, "modern styling"));
  if (prompt.style.minimalism) parts.push(tagOrSentence(prompt.style.minimalism, "minimalism"));
  return parts;
}

export function describeComposition(prompt: UniversalPrompt): string[] {
  const parts: string[] = [];
  if (prompt.composition.framing) parts.push(prompt.composition.framing);
  if (prompt.composition.focalPoint) parts.push(`focal point: ${prompt.composition.focalPoint}`);
  if (prompt.composition.depth) parts.push(prompt.composition.depth);
  if (prompt.composition.texture) parts.push(prompt.composition.texture);
  if (prompt.layout.composition) parts.push(prompt.layout.composition);
  if (prompt.layout.hierarchy) parts.push(`visual hierarchy: ${prompt.layout.hierarchy}`);
  if (prompt.layout.whiteSpace) parts.push(prompt.layout.whiteSpace);
  return parts;
}

// Provider Prompt Optimization, issue #2 — `objects` (the literal physical
// elements expected in the scene) was computed by the Creative Brain and
// carried all the way through the Prompt Expander, but no adapter except
// gemini.adapter.ts ever read it, so it never influenced generation at all.
export function describeObjects(prompt: UniversalPrompt): string[] {
  return prompt.objects;
}

export function describeCamera(prompt: UniversalPrompt): string[] {
  const parts: string[] = [];
  if (prompt.camera.angle) parts.push(tagOrSentence(prompt.camera.angle, "angle"));
  if (prompt.camera.lens) parts.push(prompt.camera.lens);
  if (prompt.camera.depthOfField) parts.push(prompt.camera.depthOfField);
  if (prompt.camera.perspective) parts.push(prompt.camera.perspective);
  return parts;
}

export function describeLighting(prompt: UniversalPrompt): string[] {
  const parts: string[] = [];
  if (prompt.lighting.type) parts.push(prompt.lighting.type);
  if (prompt.lighting.direction) parts.push(prompt.lighting.direction);
  if (prompt.lighting.quality) parts.push(prompt.lighting.quality);
  return parts;
}

export function describeColors(prompt: UniversalPrompt): string[] {
  const parts: string[] = [];
  if (prompt.colors.palette?.length) parts.push(`color palette: ${prompt.colors.palette.join(", ")}`);
  if (prompt.colors.harmony) parts.push(prompt.colors.harmony);
  return parts;
}

export function describeTypography(prompt: UniversalPrompt): string[] {
  const parts: string[] = [];
  if (prompt.typography.treatment) parts.push(prompt.typography.treatment);
  if (prompt.typography.fontStyle) parts.push(prompt.typography.fontStyle);
  if (prompt.layout.headlinePosition) parts.push(`headline ${prompt.layout.headlinePosition}`);
  if (prompt.layout.ctaPosition) parts.push(`CTA ${prompt.layout.ctaPosition}`);
  if (prompt.layout.logoPosition) parts.push(`logo ${prompt.layout.logoPosition}`);
  return parts;
}

export function describeMarketing(prompt: UniversalPrompt): string[] {
  const parts: string[] = [];
  if (prompt.marketing.goal) parts.push(prompt.marketing.goal);
  if (prompt.marketing.targetAudience) parts.push(`for ${prompt.marketing.targetAudience}`);
  if (prompt.marketing.psychologyHooks?.length) {
    // Each hook is its own array element (not pre-joined into one string)
    // so composeFluently() can classify EACH one individually as a short
    // tag vs. an already-complete sentence — pre-joining with ", " here
    // bypassed that classification for every hook except the last one,
    // confirmed live: "...captures interest., clear call-to-action: ..."
    // (a period directly followed by a comma).
    parts.push(...dedupeSimilarPhrases(prompt.marketing.psychologyHooks));
  }
  return parts;
}

export function describeQuality(prompt: UniversalPrompt): string[] {
  return prompt.quality.keywords ?? [];
}

export function describeNegative(prompt: UniversalPrompt): string[] {
  return prompt.negative_constraints;
}

// Fallback adapter for any image provider without a dedicated one — a
// natural descriptive paragraph weaving in every populated field, which is
// a safe default style most vendors handle reasonably well.
export function buildGenericPrompt(prompt: UniversalPrompt): string {
  const objects = describeObjects(prompt);
  const sentences: string[] = [];
  if (objects.length) sentences.push(`${capitalizeFirst(objects.join(", "))}.`);

  sentences.push(
    composeFluently([
      ...describeSubject(prompt),
      ...describeComposition(prompt),
      ...describeCamera(prompt),
      ...describeLighting(prompt),
      ...describeColors(prompt),
      ...describeTypography(prompt),
      ...describeMarketing(prompt),
      ...describeQuality(prompt),
    ])
  );

  if (prompt.negative_constraints.length) {
    sentences.push(`Avoid: ${prompt.negative_constraints.join(", ")}.`);
  }
  return sentences.filter(Boolean).join(" ");
}
