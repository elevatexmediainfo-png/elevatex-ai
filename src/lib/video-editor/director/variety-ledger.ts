import type { VarietyLedger } from "./types";

// AI Video Director (2026-08-07) — generalizes ai-broll-resolver.ts's
// existing `usedExternalIds: Set<string>` cross-item-dedup pattern (claim
// synchronously, shared across one job) from one category (stock asset
// ids) to six (zoom styles, transition types, sticker queries, caption
// animations, sfx queries, b-roll styles). "Never repeat" is enforced
// two ways: (1) each agent's prompt is told what's already been used
// (see the *Request "used*" fields in providers/reasoning/types.ts) so
// the model itself tries not to repeat; (2) this module's own deterministic
// isRepeat() check backstops that, feeding visualVarietyScore in
// quality-review.ts.
//
// Deliberate simplification vs. a fully time-windowed ledger: repeats are
// tracked for the WHOLE job, not scoped to a nearby (+/-3s) time window —
// a plain "have I used this before, anywhere in this video" check. A real
// short-form edit rarely benefits from the exact same zoom intensity or
// transition type appearing twice at all, adjacent or not, so the simpler
// whole-job check is the honest, sufficient version of this rule; a
// time-windowed variant can be added later without changing this
// module's public shape if real usage shows it's needed.

export function createEmptyVarietyLedger(): VarietyLedger {
  return { zoomStyles: [], transitionTypes: [], stickerQueries: [], captionAnimations: [], sfxQueries: [], brollStyles: [] };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function isRepeat(ledger: VarietyLedger, category: keyof VarietyLedger, value: string): boolean {
  const normalized = normalize(value);
  return ledger[category].some((v) => normalize(v) === normalized);
}

// Immutable — returns a NEW ledger, same "append-only, never mutate the
// caller's copy" convention as ai-os/retry-orchestrator's own
// appendHistoryEntry. Duplicate-safe: recording the same value twice
// doesn't grow the list a second time (isRepeat would already be true).
export function recordUsage(ledger: VarietyLedger, category: keyof VarietyLedger, value: string): VarietyLedger {
  if (!value || isRepeat(ledger, category, value)) return ledger;
  return { ...ledger, [category]: [...ledger[category], value] };
}

export function recordManyUsages(ledger: VarietyLedger, category: keyof VarietyLedger, values: string[]): VarietyLedger {
  return values.reduce((acc, v) => recordUsage(acc, category, v), ledger);
}

// Derives a coarse "style" bucket for a zoom item from its scale delta —
// used both to feed the ledger and to describe "already used zoom
// styles" back to the Visuals agent in its own prompt (see
// buildVisualsPrompt's usedZoomStyles).
export function zoomStyleBucket(scaleFrom: number, scaleTo: number): string {
  const delta = Math.abs(scaleTo - scaleFrom);
  if (delta <= 8) return "subtle";
  if (delta <= 15) return "moderate";
  return "dramatic";
}

// A repeat COUNTS ONCE per duplicated category value, not per occurrence —
// i.e. this scores the LEDGER's own final repeat count (how many distinct
// values across all categories appear more than once), not a live replay
// of every individual item. quality-review.ts calls this against the
// final, fully-populated ledger for one plan attempt.
export function countRepeats(ledger: VarietyLedger): number {
  let repeats = 0;
  for (const category of Object.keys(ledger) as (keyof VarietyLedger)[]) {
    const seen = new Map<string, number>();
    for (const raw of ledger[category]) {
      const key = normalize(raw);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const count of seen.values()) {
      if (count > 1) repeats += count - 1;
    }
  }
  return repeats;
}

// 0-100. 100 = no repeats at all. Each repeat costs a flat penalty,
// floored at 0 — a genuinely repetitive edit (the same zoom/transition/
// sticker reused 4-5 times) should score visibly poorly, not just
// nudge down.
const REPEAT_PENALTY = 15;

export function scoreVisualVariety(ledger: VarietyLedger): number {
  const repeats = countRepeats(ledger);
  return Math.max(0, 100 - repeats * REPEAT_PENALTY);
}
