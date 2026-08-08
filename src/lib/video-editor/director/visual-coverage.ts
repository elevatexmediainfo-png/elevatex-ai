import type { ReasoningZoomItem } from "@/lib/providers/reasoning";
import type { AIBroll, AICaption, AISticker } from "@/lib/validations/ai-timeline";
import type { VarietyLedger } from "./types";
import { recordUsage } from "./variety-ledger";

// AI Video Director (2026-08-07) — "No dead screen" rule: no talking-head
// shot should remain visually unchanged for more than
// AI_EDIT_NO_DEAD_SCREEN_GAP_THRESHOLD_MS (default 2000ms). This module
// operates on the AITimelinePlan-shaped arrays directly (server-side,
// before client translation) — the SAME layer ai-edit-quality-scoring.ts
// already works on, so it can run inside the Director pipeline's own
// scoring loop with no new data dependency.
//
// Phase 1 scope (per the approved plan) — fixes are limited to the 5
// visual types that already render today: b-roll cutaway, zoom/camera-
// punch, sticker, animated caption (counted as coverage, never
// auto-inserted — captions are the Caption agent's own job), and
// motion-graphic-as-asset (a broll item tagged contentKind:"motion_graphic",
// same renderable shape as plain b-roll). Picture-in-picture, split-
// screen, blur-background, progress-bar, callout, face-punch, and
// screen-recording overlay are explicitly OUT OF SCOPE — they need new
// ClipContent fields + new compositor-stage.tsx render branches + export-
// renderer support, deferred to a future phase. The `contentKind` field
// on aiBrollSchema is the deliberate seam a Phase 2 would extend.

// Deliberately DIFFERENT from ai-timeline-translator.ts's own
// computeSurvivingSegments — that function REPACKS surviving pieces to
// gap-free positions in the FINAL, post-cut timeline's own coordinate
// space (for placing real clips). Every AITimelinePlan item (broll/zoom/
// stickers/captions) is proposed in ORIGINAL SOURCE-relative time instead
// (see gpt5.provider.ts's buildPrompt: "every timestamp you produce must
// be within [0, sourceDurationMs]") — this is the complement of the
// (already-normalized) removal windows WITHOUT repacking, so gap
// detection stays in the same coordinate space every proposed item uses.
export function computeSourceSurvivingWindows(sourceDurationMs: number, normalizedRemovalWindows: { startMs: number; endMs: number }[]): { startMs: number; endMs: number }[] {
  const windows: { startMs: number; endMs: number }[] = [];
  let cursor = 0;
  for (const w of normalizedRemovalWindows) {
    if (w.startMs > cursor) windows.push({ startMs: cursor, endMs: w.startMs });
    cursor = Math.max(cursor, w.endMs);
  }
  if (cursor < sourceDurationMs) windows.push({ startMs: cursor, endMs: sourceDurationMs });
  return windows;
}

export interface CoverageInterval {
  startMs: number;
  endMs: number;
  kind: "broll" | "zoom" | "sticker" | "caption";
}

export interface CoverageInput {
  broll: AIBroll[];
  zoom: ReasoningZoomItem[];
  stickers: AISticker[];
  captions: AICaption[];
}

// Real-world note: this runs BEFORE asset resolution (same point in the
// pipeline ai-edit-quality-scoring.ts's own scoreVisuals runs — see that
// file's own flagged bug for why "wait for resolvedAssetId" would be
// wrong here) — every PROPOSED broll/sticker item counts as coverage,
// not just ones that later resolve to a real asset. A proposal that
// later fails to resolve is a resolution-layer concern, not a coverage
// gap this pass should try to re-fill.
export function computeVisualCoverage(input: CoverageInput): CoverageInterval[] {
  const intervals: CoverageInterval[] = [
    ...input.broll.map((b) => ({ startMs: b.startMs, endMs: b.endMs, kind: "broll" as const })),
    ...input.zoom.map((z) => ({ startMs: z.startMs, endMs: z.endMs, kind: "zoom" as const })),
    ...input.stickers.map((s) => ({ startMs: s.startMs, endMs: s.endMs, kind: "sticker" as const })),
    ...input.captions.map((c) => ({ startMs: c.startMs, endMs: c.endMs, kind: "caption" as const })),
  ];
  return intervals.slice().sort((a, b) => a.startMs - b.startMs);
}

export interface DeadScreenGap {
  startMs: number;
  endMs: number;
  durationMs: number;
}

// Merge-interval pattern — same technique as ai-timeline-translator.ts's
// own normalizeSceneRemovalWindows/computeSurvivingSegments, applied here
// to find UNCOVERED sub-ranges within each surviving (talking-head)
// segment instead of surviving segments themselves.
export function findDeadScreenGaps(
  coverage: CoverageInterval[],
  survivingSegments: { startMs: number; endMs: number }[],
  gapThresholdMs: number
): DeadScreenGap[] {
  if (survivingSegments.length === 0) return [];
  const sorted = coverage.slice().sort((a, b) => a.startMs - b.startMs);

  // Merge overlapping/adjacent coverage intervals into one flat "covered" list.
  const merged: { startMs: number; endMs: number }[] = [];
  for (const c of sorted) {
    const last = merged[merged.length - 1];
    if (last && c.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, c.endMs);
    } else {
      merged.push({ startMs: c.startMs, endMs: c.endMs });
    }
  }

  const gaps: DeadScreenGap[] = [];
  for (const segment of survivingSegments) {
    let cursor = segment.startMs;
    for (const cov of merged) {
      const covStart = Math.max(cov.startMs, segment.startMs);
      const covEnd = Math.min(cov.endMs, segment.endMs);
      if (covEnd <= cursor) continue; // entirely before cursor, or before this segment
      if (covStart > cursor) {
        const gapDuration = covStart - cursor;
        if (gapDuration >= gapThresholdMs) gaps.push({ startMs: cursor, endMs: covStart, durationMs: gapDuration });
      }
      cursor = Math.max(cursor, covEnd);
      if (cursor >= segment.endMs) break;
    }
    if (cursor < segment.endMs) {
      const gapDuration = segment.endMs - cursor;
      if (gapDuration >= gapThresholdMs) gaps.push({ startMs: cursor, endMs: segment.endMs, durationMs: gapDuration });
    }
  }
  return gaps;
}

export type VisualCoverageFixKind = "broll" | "sticker" | "motion_graphic" | "zoom";

// TASK 9 (2026-08-07, "maintain a diversity score... never repeat within
// a short window") — how many of the MOST RECENT fix kinds count as "too
// recent to repeat." Deliberately a small rolling window, NOT a whole-job
// "has this kind ever been used" check — a real, pre-existing bug in this
// function's first version used the whole-job variety ledger's own
// isRepeat() for this, which meant "broll" (a category meant to legitimately
// repeat many times across one video — that's the entire point of b-roll
// density) became permanently unavailable to the auto-fixer after its very
// first use, silently biasing every later gap toward zoom/sticker. Fixed
// by tracking only the last FIX_ALTERNATION_WINDOW choices made BY THIS
// AUTO-FIXER specifically (recentKinds, threaded through
// applyNoDeadScreenFixes below) — the actual per-item VALUES (a specific
// zoom style, a specific sticker query) still use the real, whole-job
// variety ledger for their own dedup, which is the right scope for those.
export const FIX_ALTERNATION_WINDOW = 2;

// Deterministic heuristic (no LLM call — free on every quality-loop
// iteration): bigger gaps get the more substantial fix; a fix KIND used
// in the last FIX_ALTERNATION_WINDOW choices is skipped in favor of the
// next-cheapest option, so consecutive auto-fixes genuinely alternate
// instead of repeating the same category back-to-back.
export function decideFixForGap(recentKinds: VisualCoverageFixKind[], durationMs: number): VisualCoverageFixKind {
  const candidates: VisualCoverageFixKind[] =
    durationMs >= 4000 ? ["broll", "motion_graphic", "sticker", "zoom"] : durationMs >= 2500 ? ["motion_graphic", "sticker", "broll", "zoom"] : ["zoom", "sticker", "motion_graphic", "broll"];

  const tooRecent = new Set(recentKinds.slice(-FIX_ALTERNATION_WINDOW));
  for (const kind of candidates) {
    if (!tooRecent.has(kind)) return kind;
  }
  return candidates[0]; // every candidate was recently used — fall back to the size-appropriate default anyway
}

// TASK 5 — the auto-fixer's own zoom fix always uses the smallest, most
// unobtrusive named style ("micro") — an automatic safety-net insert
// should never be as visually loud as a deliberate, story-motivated zoom
// the Visuals agent itself chose.
const AUTO_FIX_ZOOM_STYLE = "micro" as const;

// Polish pass (2026-08-07, "avoid fixed spacing... nothing should feel
// algorithmic") — a real, literal tell this fixes: EVERY auto-inserted
// zoom used to land on the exact same scaleTo (112) and EVERY auto-
// inserted sticker used the exact same 2000ms duration, regardless of the
// gap. A viewer (or a frame-by-frame audit) would eventually notice the
// pattern. Deliberately NOT Math.random() — this pipeline's own testing
// discipline expects pure, reproducible functions (same input always
// produces the same output), and true randomness would make this
// function untestable without mocking. Instead, a small deterministic
// hash of the gap's own position (its startMs, which genuinely differs
// gap to gap) selects a value within a natural range — different gaps
// get genuinely different values, the SAME gap always gets the SAME
// value (reproducible, testable), and nothing here is a fixed constant.
function pseudoVariance(seed: number, min: number, max: number): number {
  // A simple, well-distributed integer hash (Knuth's multiplicative
  // method) — good enough to spread nearby seeds (e.g. gaps a few hundred
  // ms apart) across the range without an actual PRNG dependency.
  const hashed = Math.abs(Math.sin(seed * 12.9898) * 43_758.5453) % 1;
  return min + hashed * (max - min);
}

// Production fix (2026-08-08) — root cause of "B-roll often missing
// completely," traced end-to-end against a real production job: this
// function used to return the nearest CAPTION'S OWN LITERAL TEXT as the
// stock search query (e.g. "Aapke Ghar Tak" — real Hinglish caption text
// sent straight to Pixabay/Pexels). A caption is what the SPEAKER SAID,
// not a visual concept a stock library can match — real evidence: that
// exact query scored 0.33 relevance against the best result a keyword
// search could find, below the 0.5 confidence threshold, and — since an
// auto-inserted item never carries a `.generation` fallback prompt and
// this job had brollStockOnly:true — the slot was permanently dropped
// with no fallback. Deterministic-only fix (no new LLM calls, no new
// reasoning): derive an actual VISUAL CONCEPT from whatever real signal
// is available, in priority order —
//   1. GPT-5's OWN real (non-auto-inserted) b-roll proposals nearby in
//      this same plan — the model's own already-established visual
//      vocabulary for this video beats any deterministic guess.
//   2. Gemini's OWN real, already-English scene descriptions
//      (videoAnalysis.visualContext) nearby.
//   3. Literal English words spoken inline near the gap — AssemblyAI
//      transcribes Hindi speech in Devanagari script, so a token using
//      ONLY Latin letters in that same transcript is a reliable signal
//      of a genuine English word/proper-noun actually said (e.g. a
//      Hindi sentence that says "business" or "interior design" inline),
//      not a Hinglish transliteration to second-guess.
//   4. A curated Hinglish/Hindi keyword -> English visual-concept map,
//      applied to the nearest caption's text — NEVER the caption text
//      itself (see matchHinglishConcepts/HINGLISH_VISUAL_CONCEPT_MAP).
//   5. A deterministic (never random, never the literal spoken words)
//      generic editorial fallback.
// Returns a PRIMARY query plus ranked ALTERNATIVES so the caller can
// populate AIBroll.searchQueries — the resolver (ai-broll-resolver.ts)
// already tries those in order on a weak/failed primary match, so this
// alone gives auto-inserted items the same "try the next best query"
// resilience GPT-proposed items already have, with zero new call sites.
export interface VisualQueryContext {
  /** Real transcript words. Any pure-Latin-script token here is a reliable literal English word (see rule 3 above) — the rest of a Hindi transcript is Devanagari, not a Latin transliteration. */
  words?: { word: string; startMs: number; endMs: number }[];
  /** Gemini's own real, already-English scene descriptions (videoAnalysis.visualContext). */
  visualContext?: { startMs: number; endMs: number; description: string }[];
  /** GPT-5's own REAL (non-auto-inserted) b-roll proposals elsewhere in this same plan. */
  existingBroll?: AIBroll[];
}

export interface VisualQueryCandidates {
  primary: string;
  alternatives: string[];
}

// How far (ms) from the gap's own midpoint a nearby signal (an existing
// b-roll proposal, a Gemini scene description, a spoken English word) is
// still trusted as "about the same moment" — generous enough to catch a
// real nearby signal, bounded so a sparse, far-away one from an entirely
// different part of the video is never mistaken for a match. Captions are
// deliberately NOT bounded by this (see nearestCaption below) — a video
// with captions at all should always have SOME caption reasonably close.
const NEARBY_SIGNAL_WINDOW_MS = 10_000;

function nearestWithinWindow<T extends { startMs: number; endMs: number }>(items: T[] | undefined, midMs: number, windowMs: number): T | null {
  if (!items || items.length === 0) return null;
  let best: T | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const dist = midMs >= item.startMs && midMs <= item.endMs ? 0 : Math.min(Math.abs(item.startMs - midMs), Math.abs(item.endMs - midMs));
    if (dist <= windowMs && dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  }
  return best;
}

// Rule 3 — a Hindi transcript from AssemblyAI is written in Devanagari
// script (e.g. "हर", "इंसान"); a token spelled entirely in Latin letters
// in that SAME transcript is therefore a genuine English word/proper-noun
// actually spoken, not a Hinglish romanization to second-guess. Excludes
// a short list of common English function words that carry no visual
// meaning on their own.
const LATIN_WORD_RE = /^[A-Za-z][A-Za-z'-]{2,}$/;
const ENGLISH_FUNCTION_WORDS = new Set(["the", "and", "for", "with", "this", "that", "have", "from", "your", "you", "are", "was", "were", "will", "can", "has", "not", "but"]);

function isLikelyEnglishWord(word: string): boolean {
  return LATIN_WORD_RE.test(word) && !ENGLISH_FUNCTION_WORDS.has(word.toLowerCase());
}

// Rule 2/4 — a curated Hindi/Hinglish keyword -> English visual-concept
// map. Deliberately finite and topic-scoped (this app's own real content
// verticals: home/real-estate, finance, health, business, education,
// food, travel, wedding, career, fashion, tech, auto, family) rather than
// an attempt at general machine translation — every entry maps to
// concrete, stock-searchable visual nouns, never an abstract restatement
// of the Hindi word. Multiple keyword spellings/inflections deliberately
// point at the SAME concept array (plain object identity, not duplicated
// literals) so common variants ("paisa"/"paise", "shaadi"/"shadi") all
// resolve identically.
const HOME_CONCEPTS = ["house construction", "home interior", "family home", "construction worker", "new house"];
const MONEY_CONCEPTS = ["money", "investment", "finance", "saving", "calculator", "bank"];
const HEALTH_CONCEPTS = ["doctor", "healthy lifestyle", "exercise", "hospital", "medical"];
const BUSINESS_CONCEPTS = ["office", "startup", "meeting", "teamwork", "sales", "marketing"];
const EDUCATION_CONCEPTS = ["classroom", "student studying", "school", "books", "graduation"];
const FOOD_CONCEPTS = ["indian food", "cooking", "kitchen", "restaurant", "healthy food"];
const TRAVEL_CONCEPTS = ["travel", "tourist", "airport", "vacation", "suitcase"];
const WEDDING_CONCEPTS = ["wedding", "bride and groom", "wedding ceremony", "celebration"];
const JOB_CONCEPTS = ["office job", "interview", "workplace", "career", "resume"];
const FASHION_CONCEPTS = ["fashion", "clothing store", "stylish outfit", "shopping"];
const TECH_CONCEPTS = ["technology", "smartphone", "digital device", "laptop"];
const AUTO_CONCEPTS = ["car", "vehicle", "driving", "automobile", "road trip"];
const FAMILY_CONCEPTS = ["family", "family time", "parents and children", "home life"];

const HINGLISH_VISUAL_CONCEPT_MAP: Record<string, string[]> = {
  ghar: HOME_CONCEPTS, gharon: HOME_CONCEPTS, makan: HOME_CONCEPTS, ghara: HOME_CONCEPTS,
  paisa: MONEY_CONCEPTS, paise: MONEY_CONCEPTS, rupaye: MONEY_CONCEPTS, rupaya: MONEY_CONCEPTS, dhan: MONEY_CONCEPTS,
  bachao: MONEY_CONCEPTS, bachat: MONEY_CONCEPTS, nivesh: MONEY_CONCEPTS,
  sehat: HEALTH_CONCEPTS, tandurust: HEALTH_CONCEPTS, rahna: HEALTH_CONCEPTS, rahiye: HEALTH_CONCEPTS,
  vyapaar: BUSINESS_CONCEPTS, vyapar: BUSINESS_CONCEPTS, dhandha: BUSINESS_CONCEPTS,
  badhana: BUSINESS_CONCEPTS, badhao: BUSINESS_CONCEPTS, badho: BUSINESS_CONCEPTS, badhaye: BUSINESS_CONCEPTS,
  padhai: EDUCATION_CONCEPTS, padho: EDUCATION_CONCEPTS, shiksha: EDUCATION_CONCEPTS,
  khana: FOOD_CONCEPTS, khaana: FOOD_CONCEPTS, bhojan: FOOD_CONCEPTS, khaane: FOOD_CONCEPTS,
  safar: TRAVEL_CONCEPTS, yatra: TRAVEL_CONCEPTS, ghumna: TRAVEL_CONCEPTS, ghumne: TRAVEL_CONCEPTS,
  shaadi: WEDDING_CONCEPTS, shadi: WEDDING_CONCEPTS, vivah: WEDDING_CONCEPTS,
  naukri: JOB_CONCEPTS,
  kapde: FASHION_CONCEPTS,
  gaadi: AUTO_CONCEPTS, gadi: AUTO_CONCEPTS,
  parivaar: FAMILY_CONCEPTS, parivar: FAMILY_CONCEPTS,
  // Plain-English topic words also route through the map (redundant with
  // rule 3's own Latin-script detection when they appear standalone, but
  // this catches them even inside a Devanagari-dominant caption's own
  // romanized rendering, e.g. "Business Grow", "Healthy Rahna").
  healthy: HEALTH_CONCEPTS, business: BUSINESS_CONCEPTS, grow: BUSINESS_CONCEPTS, family: FAMILY_CONCEPTS,
  school: EDUCATION_CONCEPTS, college: EDUCATION_CONCEPTS, career: JOB_CONCEPTS, fashion: FASHION_CONCEPTS,
  mobile: TECH_CONCEPTS, phone: TECH_CONCEPTS, digital: TECH_CONCEPTS, technology: TECH_CONCEPTS, car: AUTO_CONCEPTS,
};

function matchHinglishConcepts(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const matched: string[] = [];
  for (const token of tokens) {
    const concepts = HINGLISH_VISUAL_CONCEPT_MAP[token];
    if (!concepts) continue;
    for (const c of concepts) {
      if (!matched.includes(c)) matched.push(c);
    }
  }
  return matched;
}

// Rule 6 — the absolute last resort, when nothing above yielded a real
// signal: a generic editorial category, NEVER the raw spoken/caption
// text. Picked deterministically from the gap's own position (same
// "reproducible, not truly random" discipline as pseudoVariance below)
// so consecutive fallback-only gaps in one video don't all show the
// identical literal string back to back.
const GENERIC_EDITORIAL_FALLBACKS = ["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"];

function pickGenericFallback(seed: number): string {
  const hashed = Math.abs(Math.sin(seed * 12.9898) * 43_758.5453) % 1;
  const idx = Math.min(GENERIC_EDITORIAL_FALLBACKS.length - 1, Math.floor(hashed * GENERIC_EDITORIAL_FALLBACKS.length));
  return GENERIC_EDITORIAL_FALLBACKS[idx];
}

export function deriveFixSearchQuery(gap: DeadScreenGap, captions: AICaption[], context: VisualQueryContext = {}): VisualQueryCandidates {
  const midMs = (gap.startMs + gap.endMs) / 2;

  // Rule 5 — GPT-5's own real proposals win over every other signal.
  const nearbyBroll = nearestWithinWindow(context.existingBroll?.filter((b) => !b.autoInserted && b.searchQuery), midMs, NEARBY_SIGNAL_WINDOW_MS);
  if (nearbyBroll?.searchQuery) {
    const alternatives = (nearbyBroll.searchQueries ?? []).filter((q) => q.trim().toLowerCase() !== nearbyBroll.searchQuery!.trim().toLowerCase());
    return { primary: nearbyBroll.searchQuery, alternatives };
  }

  // Rule 4 — Gemini's own real scene descriptions.
  const nearbyScene = nearestWithinWindow(context.visualContext?.filter((v) => v.description), midMs, NEARBY_SIGNAL_WINDOW_MS);
  if (nearbyScene?.description) {
    const words = nearbyScene.description
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    if (words.length > 0) return { primary: words.join(" "), alternatives: [] };
  }

  // Rule 3 — literal English words spoken inline near the gap.
  const nearbyEnglishWords = (context.words ?? [])
    .filter((w) => w.endMs >= gap.startMs - NEARBY_SIGNAL_WINDOW_MS && w.startMs <= gap.endMs + NEARBY_SIGNAL_WINDOW_MS)
    .map((w) => w.word)
    .filter(isLikelyEnglishWord);
  if (nearbyEnglishWords.length > 0) {
    const unique = Array.from(new Set(nearbyEnglishWords.map((w) => w.toLowerCase()))).slice(0, 5);
    return { primary: unique.join(" "), alternatives: [] };
  }

  // Rule 2 — infer the VISUAL CONCEPT of the nearest caption's text via
  // the curated map above. Never the caption text itself (rule 1).
  const nearestCaption = nearestWithinWindow(captions, midMs, Infinity);
  if (nearestCaption) {
    const concepts = matchHinglishConcepts(nearestCaption.text);
    if (concepts.length > 0) {
      return { primary: concepts[0], alternatives: concepts.slice(1) };
    }
  }

  // Rule 6 — nothing above yielded a real concept; generic, never raw speech.
  const fallback = pickGenericFallback(gap.startMs);
  return { primary: fallback, alternatives: GENERIC_EDITORIAL_FALLBACKS.filter((f) => f !== fallback).slice(0, 3) };
}

export interface NoDeadScreenFixResult {
  broll: AIBroll[];
  zoom: ReasoningZoomItem[];
  stickers: AISticker[];
  ledger: VarietyLedger;
  gapsFixed: number;
}

// The deterministic "auto-fixer" — for each dead-screen gap, decides a
// fix kind, builds a synthetic item tagged autoInserted:true + a short
// honest `reason`, and returns it ready to merge into the plan's own
// broll/zoom/stickers arrays. These synthetic items are resolved through
// the SAME resolveBrollItems()/resolveTimelinePlanAssets() calls every
// other proposed item goes through — no separate resolution path.
export function applyNoDeadScreenFixes(
  gaps: DeadScreenGap[],
  captions: AICaption[],
  ledger: VarietyLedger,
  context: VisualQueryContext = {}
): NoDeadScreenFixResult {
  const broll: AIBroll[] = [];
  const zoom: ReasoningZoomItem[] = [];
  const stickers: AISticker[] = [];
  let nextLedger = ledger;
  // Which fix KIND was picked, most recent last — this is the small
  // rolling alternation window (see decideFixForGap's own doc comment),
  // deliberately separate from nextLedger's whole-job per-VALUE dedup.
  const recentKinds: VisualCoverageFixKind[] = [];

  for (const gap of gaps) {
    const kind = decideFixForGap(recentKinds, gap.durationMs);
    recentKinds.push(kind);
    const reason = `Auto-inserted: ${(gap.durationMs / 1000).toFixed(1)}s of talking-head footage had no visual treatment (no-dead-screen rule).`;

    if (kind === "zoom") {
      // Varies 106-114% (still genuinely "micro," never a loud punch) —
      // no two auto-fixed zooms in one video land on the identical value.
      const scaleTo = Math.round(pseudoVariance(gap.startMs, 106, 114));
      zoom.push({ startMs: gap.startMs, endMs: gap.endMs, scaleFrom: 100, scaleTo, style: AUTO_FIX_ZOOM_STYLE, reason });
      nextLedger = recordUsage(nextLedger, "zoomStyles", AUTO_FIX_ZOOM_STYLE);
    } else if (kind === "sticker") {
      // Stickers only have a single `assetQuery` field (no plural
      // `searchQueries` in aiStickerSchema) — only the primary candidate
      // applies here; the ranked alternatives are unused for this branch.
      const { primary: query } = deriveFixSearchQuery(gap, captions, context);
      // Varies 1200-2000ms (and never longer than the gap itself) —
      // avoids every auto-fixed sticker reading as the identical duration.
      const stickerDurationMs = Math.min(gap.durationMs, Math.round(pseudoVariance(gap.startMs + 1, 1200, 2000)));
      stickers.push({ assetQuery: query, startMs: gap.startMs, endMs: gap.startMs + stickerDurationMs, reason });
      nextLedger = recordUsage(nextLedger, "stickerQueries", query);
    } else {
      // "broll" or "motion_graphic" — same renderable shape, different tag.
      // `alternatives` populates AIBroll.searchQueries so a weak/failed
      // primary match automatically tries the next-best visual concept —
      // ai-broll-resolver.ts's resolveStockBroll already does this for
      // every other b-roll item, no resolver change needed (rule 8).
      const { primary: query, alternatives } = deriveFixSearchQuery(gap, captions, context);
      broll.push({
        startMs: gap.startMs,
        endMs: gap.endMs,
        trackHint: "broll",
        source: "stock",
        searchQuery: query,
        searchQueries: alternatives.length > 0 ? alternatives : undefined,
        contentKind: kind === "motion_graphic" ? "motion_graphic" : "broll",
        autoInserted: true,
        reason,
      });
      // Tracked by the actual search query (a real, per-item value), not
      // the generic kind label — matches how the Visuals agent's own
      // proposed b-roll items are tracked (see orchestrator.ts's
      // runVisualsAgent), so this genuinely contributes to b-roll-style
      // variety scoring rather than one repeated placeholder string.
      nextLedger = recordUsage(nextLedger, "brollStyles", query);
    }
  }

  return { broll, zoom, stickers, ledger: nextLedger, gapsFixed: gaps.length };
}
