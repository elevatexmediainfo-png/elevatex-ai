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

export interface VisualCoverageOptions {
  // 2026-08-09 visual-pacing upgrade ("2-3 second maximum visual dwell")
  // — Option B, conservative: a caption's ENTIRE span used to count as
  // full coverage no matter how long it ran, which meant one long caption
  // over an unchanging talking-head shot could suppress dead-screen
  // detection indefinitely even though nothing visual had actually
  // changed. When set, this caps how much CONTINUOUS coverage CREDIT any
  // single caption interval can contribute — the caption's own real
  // startMs/endMs (rendering/timing) are never touched, only this
  // function's internal, gap-detection-only representation of it. Left
  // undefined (the default) preserves the exact legacy uncapped
  // behavior — e.g. editing-density.ts's computeActualDensities, an
  // unrelated post-hoc scoring consumer of this same function, is
  // deliberately left uncapped rather than risk changing its retention
  // scoring for a concern (real-time dead-screen fixing) it doesn't have.
  maxCaptionCreditMs?: number;
}

// Real-world note: this runs BEFORE asset resolution (same point in the
// pipeline ai-edit-quality-scoring.ts's own scoreVisuals runs — see that
// file's own flagged bug for why "wait for resolvedAssetId" would be
// wrong here) — every PROPOSED broll/sticker item counts as coverage,
// not just ones that later resolve to a real asset. A proposal that
// later fails to resolve is a resolution-layer concern, not a coverage
// gap this pass should try to re-fill.
export function computeVisualCoverage(input: CoverageInput, opts: VisualCoverageOptions = {}): CoverageInterval[] {
  const captionInterval = (c: AICaption): CoverageInterval => {
    const capMs = opts.maxCaptionCreditMs;
    if (capMs != null && c.endMs - c.startMs > capMs) {
      return { startMs: c.startMs, endMs: c.startMs + capMs, kind: "caption" as const };
    }
    return { startMs: c.startMs, endMs: c.endMs, kind: "caption" as const };
  };
  const intervals: CoverageInterval[] = [
    ...input.broll.map((b) => ({ startMs: b.startMs, endMs: b.endMs, kind: "broll" as const })),
    ...input.zoom.map((z) => ({ startMs: z.startMs, endMs: z.endMs, kind: "zoom" as const })),
    ...input.stickers.map((s) => ({ startMs: s.startMs, endMs: s.endMs, kind: "sticker" as const })),
    ...input.captions.map(captionInterval),
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

// 2026-08-09 visual-pacing upgrade — the founder's real product
// requirement was never "insert 2 b-roll clips when planning fails," it's
// "maintain a ~2-3 second maximum visual dwell time." The bug this fixes:
// findDeadScreenGaps returns ONE DeadScreenGap per contiguous uncovered
// stretch however long it runs, and applyNoDeadScreenFixes used to create
// exactly one fix spanning that gap's FULL duration — a real 5s gap
// became one b-roll clip visibly on screen for the entire 5 seconds
// (live-verified in production). This splits a long gap into several
// sub-gaps, each capped at maxDwellMs, BEFORE the existing per-gap fix
// loop ever runs — decideFixForGap's own rotation/alternation logic is
// untouched, it simply now sees more, shorter gaps to alternate across.
// Deterministic, pure, no LLM cost. Sub-gaps are sized evenly (not
// jittered here) — pseudoVariance already varies each resulting fix's OWN
// style/duration downstream (seeded on the sub-gap's own distinct
// startMs), so consecutive slices still don't read as robotically
// identical without risking a jittered slice ever exceeding maxDwellMs.
export function subdivideGap(gap: DeadScreenGap, maxDwellMs: number): DeadScreenGap[] {
  if (gap.durationMs <= maxDwellMs) return [gap];

  const sliceCount = Math.ceil(gap.durationMs / maxDwellMs);
  const subGaps: DeadScreenGap[] = [];
  let cursor = gap.startMs;
  for (let i = 1; i <= sliceCount; i++) {
    // Cumulative rounding (not a fixed per-slice size) so rounding error
    // never accumulates into drift — the last slice always lands exactly
    // on the gap's real endMs.
    const boundary = i === sliceCount ? gap.endMs : gap.startMs + Math.round((gap.durationMs * i) / sliceCount);
    subGaps.push({ startMs: cursor, endMs: boundary, durationMs: boundary - cursor });
    cursor = boundary;
  }
  return subGaps;
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
  /**
   * 2026-08-09 visual-pacing upgrade — the maximum continuous duration any
   * ONE auto-inserted fix may span. A gap longer than this is subdivided
   * (see subdivideGap) into several shorter fixes before this function's
   * own per-fix loop runs, instead of one fix spanning the gap's entire
   * duration. Defaults to DEFAULT_MAX_DWELL_MS when omitted.
   */
  maxDwellMs?: number;
}

// Admin-configurable via AI_EDIT_MAX_VISUAL_DWELL_MS (config.ts) — this is
// only the FALLBACK used when a caller doesn't thread the real configured
// value through (e.g. a test that isn't exercising this specific
// behavior). Real callers (ai-edit-jobs.ts, director/orchestrator.ts)
// always pass the actual configured value explicitly.
export const DEFAULT_MAX_DWELL_MS = 2500;

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

// Fix (2026-08-12) — the assumption above ("a Hindi transcript is written
// in Devanagari, so a Latin-script token must be genuine English") turned
// out to be false for real production content: AssemblyAI's transcript
// for Hinglish speech is ITSELF romanized (e.g. "Ghar", "Khaana",
// "Shaadi" spelled in Latin letters), so rule 3 was winning over rule 2's
// correct concept mapping for these words — real regression: the caption
// "Aapke Ghar Tak" had its own nearby transcript words include "Ghar",
// which rule 3 accepted as "English" and sent to a stock search
// literally, instead of falling through to rule 2's HOME_CONCEPTS
// mapping. Smallest safe fix: reject a word here when it's one of
// HINGLISH_VISUAL_CONCEPT_MAP's own ORIGINAL Hindi-romanization keys
// (the literal strings below are copied from that map's own first
// section, immediately after this function — no new vocabulary
// introduced, map itself untouched). Deliberately excludes the map's
// later "plain-English topic words" / "production fix" sections (e.g.
// "business", "house", "construction", "doctor") — those are genuine
// English words Rule 3 must keep treating as English (see this file's
// own "house construction" rule 3 test) — only words that are ONLY ever
// a Hindi/Hinglish romanization in this app's curated vocabulary are
// excluded here.
const HINGLISH_ROMANIZATION_ONLY_KEYS = new Set([
  "ghar", "gharon", "makan", "ghara",
  "paisa", "paise", "rupaye", "rupaya", "dhan",
  "bachao", "bachat", "nivesh",
  "sehat", "tandurust", "rahna", "rahiye",
  "vyapaar", "vyapar", "dhandha",
  "badhana", "badhao", "badho", "badhaye",
  "padhai", "padho", "shiksha",
  "khana", "khaana", "bhojan", "khaane",
  "safar", "yatra", "ghumna", "ghumne",
  "shaadi", "shadi", "vivah",
  "naukri",
  "kapde",
  "gaadi", "gadi",
  "parivaar", "parivar",
]);

// Fix (2026-08-12, follow-up — "fix the Hinglish issue completely") — the
// map-key rejection above only catches Hindi/Hinglish words that also
// happen to be CONCEPT words this app's curated vocabulary already knows
// about (e.g. "ghar"). It does nothing for a Hinglish word that carries
// no visual concept at all — grammatical words: pronouns, postpositions,
// auxiliary verbs, particles (e.g. "Aapke," "Tak," "Hai," "Nahi"). Real
// regression: the literal reported phrase "Aapke Ghar Tak" — "Ghar" is a
// map key (already fixed above), but "Aapke" and "Tak" are pure grammar,
// never a concept HINGLISH_VISUAL_CONCEPT_MAP could reasonably hold (that
// map is topic-scoped by design — see its own doc comment — a
// pronoun/postposition isn't a "visual concept" any topic bucket fits).
// This is the SAME distinction ENGLISH_FUNCTION_WORDS above already draws
// for English (grammatical words vs. content words) — HINDI_FUNCTION_WORDS
// is the Hindi-romanization mirror of that same, already-established
// pattern, not a new kind of list. Deliberately excludes any romanized
// Hindi word that is ALSO a genuine, plausible English word in this app's
// own real content domains (verified individually, not just assumed):
// "main" (English "main road/street"), "koi" (English loanword, "koi
// pond"), "tab" (English "browser tab"/"keep tab on"), "tera" (English SI
// prefix, "terabyte" — plausible in this app's own TECH_CONCEPTS
// domain), and "fir" (English "fir tree") are all real Hindi words too,
// but are deliberately left OUT of this list — a genuine English use of
// any of them must keep working, and this fix would rather under-catch a
// few Hindi words than ever misclassify real English.
//
// A structural/phonetic heuristic (e.g. "words containing gh/kh/sh/dh/ksh
// are probably Hindi") was considered and REJECTED — it is not reliable:
// ordinary English words routinely contain those exact letter sequences
// ("night," "light," "though," "enough," "laugh," "should," "think,"
// "change," "workshop," "bookshelf" all contain gh/sh/ch/ksh), so this
// would misclassify genuine English constantly, violating the explicit
// requirement to never do that. No per-word language signal exists
// upstream either — TranscriptionWord (providers/transcription/types.ts)
// carries only `{word, startMs, endMs}`, no per-word language/confidence
// field to lean on. A standalone Hindi CONTENT noun that is neither a
// concept-map key nor a grammatical function word (e.g. "Nakshe" —
// "blueprint/map," a real noun, not a pronoun/postposition) is therefore
// a KNOWN, DOCUMENTED, UNRESOLVED gap: it cannot be reliably distinguished
// from genuine English without either (a) expanding
// HINGLISH_VISUAL_CONCEPT_MAP's vocabulary (explicitly out of scope this
// change) or (b) an unreliable heuristic (rejected above). See this
// file's own test suite for an explicit test documenting this gap rather
// than silently leaving it unproven.
const HINDI_FUNCTION_WORDS = new Set([
  // Pronouns / possessives — grammatical, never a visual concept.
  "aap", "aapka", "aapke", "aapki", "hum", "hamara", "tum", "tumhara",
  "mera", "meri", "wo", "woh", "yeh", "unka", "iska", "uska", "khud", "apna", "apni",
  // Postpositions (3+ letters only — shorter ones like "ka"/"ki"/"ko"/
  // "se"/"me" never reach this function at all: LATIN_WORD_RE already
  // requires a minimum of 3 letters).
  "tak", "liye",
  // Copulas / common auxiliary-verb forms.
  "hai", "hain", "hoon", "tha", "thi", "raha", "rahi", "rahe",
  // Common particles / interrogatives — grammatical, not topic words.
  "nahi", "nahin", "haan", "kya", "kyun", "kaise", "kab", "kahan", "aur", "bhi", "toh", "sab", "jab", "agar", "phir",
]);

function isLikelyEnglishWord(word: string): boolean {
  const lower = word.toLowerCase();
  return LATIN_WORD_RE.test(word) && !ENGLISH_FUNCTION_WORDS.has(lower) && !HINGLISH_ROMANIZATION_ONLY_KEYS.has(lower) && !HINDI_FUNCTION_WORDS.has(lower);
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
  // Production fix (2026-08-11) — real regression: rules 3/4 (a literal
  // transcript snippet / a raw Gemini scene description) never checked
  // this map at all before falling back to genericAlternates()'s generic,
  // cross-topic vocabulary. Real evidence: "Doctor seated at clinic desk
  // speaking" (rule 4) only had "healthcare" available as a fallback
  // alternative, which scored 0.4 against a real stock candidate — below
  // the 0.5 confidence threshold — while these same-domain words below
  // would have given the resolver several more specific, more literally-
  // matchable candidates to try. Minimal, targeted additions — one or two
  // clearly domain-identifying English nouns per vertical this map didn't
  // already cover in plain English, not an attempt at a full synonym set.
  doctor: HEALTH_CONCEPTS, hospital: HEALTH_CONCEPTS, medical: HEALTH_CONCEPTS, clinic: HEALTH_CONCEPTS, dentist: HEALTH_CONCEPTS, patient: HEALTH_CONCEPTS, nurse: HEALTH_CONCEPTS,
  house: HOME_CONCEPTS, home: HOME_CONCEPTS, construction: HOME_CONCEPTS, property: HOME_CONCEPTS,
  money: MONEY_CONCEPTS, finance: MONEY_CONCEPTS, investment: MONEY_CONCEPTS, bank: MONEY_CONCEPTS,
  office: BUSINESS_CONCEPTS, meeting: BUSINESS_CONCEPTS, startup: BUSINESS_CONCEPTS,
  student: EDUCATION_CONCEPTS, classroom: EDUCATION_CONCEPTS, education: EDUCATION_CONCEPTS,
  food: FOOD_CONCEPTS, restaurant: FOOD_CONCEPTS, cooking: FOOD_CONCEPTS, kitchen: FOOD_CONCEPTS,
  travel: TRAVEL_CONCEPTS, vacation: TRAVEL_CONCEPTS, airport: TRAVEL_CONCEPTS, trip: TRAVEL_CONCEPTS,
  vehicle: AUTO_CONCEPTS, driving: AUTO_CONCEPTS, automobile: AUTO_CONCEPTS,
  wedding: WEDDING_CONCEPTS, marriage: WEDDING_CONCEPTS, bride: WEDDING_CONCEPTS, groom: WEDDING_CONCEPTS,
  clothing: FASHION_CONCEPTS, outfit: FASHION_CONCEPTS,
  job: JOB_CONCEPTS, interview: JOB_CONCEPTS, workplace: JOB_CONCEPTS,
  parents: FAMILY_CONCEPTS, children: FAMILY_CONCEPTS,
  computer: TECH_CONCEPTS, laptop: TECH_CONCEPTS,
};

// Fix (2026-08-13, real production error — "broll[N].searchQueries: too_big,
// maximum 10") — this function had NO length cap: it accumulates every
// concept from EVERY matched category with no limit, and its result flows
// straight into AIBroll.searchQueries (rule 2 directly via `concepts.slice(1)`
// below, and via domainAlternatesOrGeneric() for rules 3/4) — a field capped
// at max(10) by aiBrollSchema (validations/ai-timeline.ts). A source text
// naming words from 2+ different concept categories (e.g. a caption/scene
// description mentioning both a health topic and a business topic near the
// same gap) trivially produces 10-20+ concepts — confirmed possible with as
// few as 3-4 matched category keywords (each category holds 4-6 concepts).
// The auto-fixer's synthetic broll items push this straight into
// `searchQueries` with no validation until the FINAL assembled-plan parse
// (ai-edit-jobs.ts's `aiTimelinePlanSchema.parse(plan)`) — a hard parse that
// throws and fails the WHOLE job, unlike GPT's own native broll proposals,
// which are validated (and any single bad item safely dropped, never job-
// ending) much earlier via parsePlanOutputLeniently. Capped HERE, at the
// true unbounded source, so every downstream consumer (rule 2's own
// `concepts.slice(1)`, and domainAlternatesOrGeneric() for rules 3/4)
// automatically inherits a value that can never exceed the schema's own
// limit — one fix, not three duplicated caps at each call site.
// MAX_HINGLISH_CONCEPT_MATCHES mirrors aiBrollSchema's searchQueries.max(10)
// (validations/ai-timeline.ts) verbatim — the schema's own existing ceiling,
// not a new, arbitrary number. Preserves order and the primary: `matched[0]`
// (rule 2's own primary) is decided by the FIRST matched token, well before
// any realistic cap could be reached (the largest single category is 6
// items), so the primary is untouched in every case. Only the TAIL of the
// list — later-matched categories once the cap is already reached — is ever
// truncated; nothing already in `matched` is ever removed or reordered.
const MAX_HINGLISH_CONCEPT_MATCHES = 10;

function matchHinglishConcepts(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const matched: string[] = [];
  for (const token of tokens) {
    if (matched.length >= MAX_HINGLISH_CONCEPT_MATCHES) break;
    const concepts = HINGLISH_VISUAL_CONCEPT_MAP[token];
    if (!concepts) continue;
    for (const c of concepts) {
      if (matched.length >= MAX_HINGLISH_CONCEPT_MATCHES) break;
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

// Rules 3/4 (2026-08-10) — neither rule can offer a curated, topic-specific
// alternates list the way Rule 2's Hinglish concept map or Rule 5's real
// GPT proposals can: a literal transcript snippet (rule 3) or a raw Gemini
// scene description (rule 4) isn't tied to one of the app's known content
// verticals. They used to return `alternatives: []`, which meant
// ai-broll-resolver.ts's primary-vs-alternatives comparison (see that
// file's own 2026-08-09 fix) never had anything to compare against —
// real production impact: for a single-setting talking-head video, rule 4
// can hand the SAME generic, verb-heavy sentence fragment (e.g. "Dentist
// seated at office desk wearing...") to several different gaps, each with
// zero fallback the moment that literal phrase scores too low. A
// deterministic, seed-rotated slice of the SAME generic editorial
// fallbacks rule 6 already uses gives these rules a genuine second (and
// third, fourth) chance through the resolver's own comparison, without
// inventing any new concept vocabulary — reuses pickGenericFallback's own
// seed to choose where the rotation starts, so two gaps at different
// positions get a genuinely different alternates set even when their own
// primary text happens to collide.
function genericAlternates(seed: number, exclude: string): string[] {
  const startIdx = GENERIC_EDITORIAL_FALLBACKS.indexOf(pickGenericFallback(seed));
  const rotated = [...GENERIC_EDITORIAL_FALLBACKS.slice(startIdx), ...GENERIC_EDITORIAL_FALLBACKS.slice(0, startIdx)];
  return rotated.filter((f) => f !== exclude).slice(0, 3);
}

// Rules 3/4 domain classification (2026-08-11) — reuses the SAME
// matchHinglishConcepts()/HINGLISH_VISUAL_CONCEPT_MAP architecture rule 2
// already relies on, applied here to rule 3's own nearby-words text and
// rule 4's own (untruncated) scene-description text instead of a caption.
// The PRIMARY these rules already derived is never touched — only the
// alternatives source changes: a confidently-detected domain's own
// concept words (already curated, already used elsewhere in this file)
// replace the generic, cross-topic GENERIC_EDITORIAL_FALLBACKS rotation
// whenever the source text actually names a known vertical (e.g. "doctor"
// -> HEALTH_CONCEPTS gives the resolver "healthy lifestyle", "exercise",
// "hospital", "medical" to try, instead of "office work"/"city"/"family").
// Falls back to the existing genericAlternates() when no domain can be
// confidently detected, exactly as before this fix.
function domainAlternatesOrGeneric(sourceText: string, primary: string, seed: number): string[] {
  const domainConcepts = matchHinglishConcepts(sourceText).filter((c) => c.trim().toLowerCase() !== primary.trim().toLowerCase());
  return domainConcepts.length > 0 ? domainConcepts : genericAlternates(seed, primary);
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
    if (words.length > 0) {
      const primary = words.join(" ");
      return { primary, alternatives: domainAlternatesOrGeneric(nearbyScene.description, primary, gap.startMs) };
    }
  }

  // Rule 3 — literal English words spoken inline near the gap.
  const nearbyEnglishWords = (context.words ?? [])
    .filter((w) => w.endMs >= gap.startMs - NEARBY_SIGNAL_WINDOW_MS && w.startMs <= gap.endMs + NEARBY_SIGNAL_WINDOW_MS)
    .map((w) => w.word)
    .filter(isLikelyEnglishWord);
  if (nearbyEnglishWords.length > 0) {
    const unique = Array.from(new Set(nearbyEnglishWords.map((w) => w.toLowerCase()))).slice(0, 5);
    const primary = unique.join(" ");
    return { primary, alternatives: domainAlternatesOrGeneric(nearbyEnglishWords.join(" "), primary, gap.startMs) };
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

// Candidate 2 (2026-08-11) — "avoid unnecessary duplicate queries across
// subdivided sub-gaps of the same original dead-screen stretch." Real
// cause: subdivideGap() correctly splits one long gap into several
// shorter sub-gaps to hit the max-dwell target, but each sub-gap
// independently re-derives its own query from the same sparse Gemini/
// transcript signal (deriveFixSearchQuery has no memory of earlier
// sub-gaps) — for a single-setting talking-head video that can mean many
// sub-gaps landing on the identical literal rule 3/4 primary.
// Deterministic, no new state: reuses the SAME `ledger.brollStyles`
// history applyNoDeadScreenFixes already threads through this loop and
// already records every query into. Prefers the first candidate (primary,
// then each alternative IN ORDER — domain-specific ones from
// domainAlternatesOrGeneric() when available, generic otherwise) not yet
// present in that history. When every candidate has already been used in
// this job, returns the primary unchanged rather than failing the
// proposal — this deliberately does NOT manufacture fake variety beyond
// what the real available vocabulary supports (per the founder's own
// "do not promise seven unique clips if the vocabulary can't support
// seven meaningful queries" instruction).
function pickUnusedQuery(primary: string, alternatives: string[], usedQueries: string[]): VisualQueryCandidates {
  const usedLower = new Set(usedQueries.map((q) => q.trim().toLowerCase()));
  if (!usedLower.has(primary.trim().toLowerCase())) return { primary, alternatives };

  const chosen = alternatives.find((a) => !usedLower.has(a.trim().toLowerCase()));
  if (!chosen) return { primary, alternatives }; // every option already used — deterministic fallback, never fail the slot

  return { primary: chosen, alternatives: [primary, ...alternatives.filter((a) => a !== chosen)] };
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

  // 2026-08-09 — split any gap longer than maxDwellMs into several
  // shorter sub-gaps BEFORE deciding fixes. `gapsFixed` below still
  // reports the ORIGINAL gap count (how many dead-screen violations were
  // addressed) — the total number of inserted events is broll.length +
  // zoom.length + stickers.length, a different, already-derivable metric.
  const maxDwellMs = context.maxDwellMs ?? DEFAULT_MAX_DWELL_MS;
  const subdividedGaps = gaps.flatMap((gap) => subdivideGap(gap, maxDwellMs));

  for (const gap of subdividedGaps) {
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
      // Fix (2026-08-12) — broll already tags its own auto-inserted items
      // `autoInserted: true` (see the "broll"/"motion_graphic" branch
      // below); stickers never did, despite aiStickerSchema already
      // having the field (validations/ai-timeline.ts). Purely additive —
      // no existing consumer reads AISticker.autoInserted today (the one
      // existing test that distinguishes auto-fixer stickers already does
      // so via the `reason` string, unchanged here), so this cannot change
      // selection/resolution/rendering behavior; it only makes the field
      // consistent with broll for any future consumer that needs it.
      stickers.push({ assetQuery: query, startMs: gap.startMs, endMs: gap.startMs + stickerDurationMs, reason, autoInserted: true });
      nextLedger = recordUsage(nextLedger, "stickerQueries", query);
    } else {
      // "broll" or "motion_graphic" — same renderable shape, different tag.
      // `alternatives` populates AIBroll.searchQueries so a weak/failed
      // primary match automatically tries the next-best visual concept —
      // ai-broll-resolver.ts's resolveStockBroll already does this for
      // every other b-roll item, no resolver change needed (rule 8).
      const derived = deriveFixSearchQuery(gap, captions, context);
      // Candidate 2 — before persisting, check whether this exact query was
      // already used by an EARLIER sub-gap in this same call (nextLedger's
      // own running brollStyles history) and swap to an unused candidate
      // when one exists (see pickUnusedQuery's own doc comment).
      const { primary: query, alternatives } = pickUnusedQuery(derived.primary, derived.alternatives, nextLedger.brollStyles);
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
