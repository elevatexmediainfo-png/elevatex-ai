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

// Picks the caption whose time range is nearest the gap's midpoint to
// derive a plausible search phrase for an auto-inserted broll/motion-
// graphic fix — a genuinely relevant query beats a generic fallback, but
// falls back honestly (never invents unrelated content) when there are
// no captions to anchor to.
export function deriveFixSearchQuery(gap: DeadScreenGap, captions: AICaption[]): string {
  if (captions.length === 0) return "b-roll footage";
  const midMs = (gap.startMs + gap.endMs) / 2;
  let nearest = captions[0];
  let nearestDist = Infinity;
  for (const c of captions) {
    const dist = Math.min(Math.abs(c.startMs - midMs), Math.abs(c.endMs - midMs));
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = c;
    }
  }
  const words = nearest.text
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  return words.length > 0 ? words.join(" ") : "b-roll footage";
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
  ledger: VarietyLedger
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
      const query = deriveFixSearchQuery(gap, captions);
      // Varies 1200-2000ms (and never longer than the gap itself) —
      // avoids every auto-fixed sticker reading as the identical duration.
      const stickerDurationMs = Math.min(gap.durationMs, Math.round(pseudoVariance(gap.startMs + 1, 1200, 2000)));
      stickers.push({ assetQuery: query, startMs: gap.startMs, endMs: gap.startMs + stickerDurationMs, reason });
      nextLedger = recordUsage(nextLedger, "stickerQueries", query);
    } else {
      // "broll" or "motion_graphic" — same renderable shape, different tag.
      const query = deriveFixSearchQuery(gap, captions);
      broll.push({
        startMs: gap.startMs,
        endMs: gap.endMs,
        trackHint: "broll",
        source: "stock",
        searchQuery: query,
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
