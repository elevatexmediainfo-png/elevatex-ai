import { describe, expect, it } from "vitest";
import { createEmptyVarietyLedger } from "./variety-ledger";
import {
  applyNoDeadScreenFixes,
  computeSourceSurvivingWindows,
  computeVisualCoverage,
  decideFixForGap,
  deriveFixSearchQuery,
  findDeadScreenGaps,
} from "./visual-coverage";

function caption(text: string, startMs: number, endMs: number) {
  return { text, startMs, endMs };
}

describe("computeSourceSurvivingWindows", () => {
  it("returns the whole duration when nothing was removed", () => {
    expect(computeSourceSurvivingWindows(10_000, [])).toEqual([{ startMs: 0, endMs: 10_000 }]);
  });

  it("returns the complement of removal windows, in ORIGINAL (not repacked) coordinates", () => {
    const result = computeSourceSurvivingWindows(10_000, [{ startMs: 2000, endMs: 3000 }]);
    // Unlike computeSurvivingSegments' repacked output, the surviving
    // piece after the cut still starts at 3000 (its real source
    // position), not 2000 (where it would land after repacking).
    expect(result).toEqual([
      { startMs: 0, endMs: 2000 },
      { startMs: 3000, endMs: 10_000 },
    ]);
  });
});

describe("computeVisualCoverage + findDeadScreenGaps", () => {
  it("flags no gap when coverage is continuous", () => {
    const coverage = computeVisualCoverage({
      broll: [],
      zoom: [],
      stickers: [],
      captions: [caption("a", 0, 5000), caption("b", 5000, 10_000)],
    });
    expect(findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 10_000 }], 2000)).toEqual([]);
  });

  it("flags a gap at or above the threshold, ignores one below it", () => {
    const coverage = computeVisualCoverage({
      broll: [],
      zoom: [],
      stickers: [],
      captions: [caption("a", 0, 3000)], // gap from 3000-10000 = 7000ms
    });
    const gaps = findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 10_000 }], 2000);
    expect(gaps).toEqual([{ startMs: 3000, endMs: 10_000, durationMs: 7000 }]);

    const noGaps = findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 3500 }], 2000); // remaining gap only 500ms
    expect(noGaps).toEqual([]);
  });

  it("merges overlapping coverage from different kinds before computing gaps", () => {
    const coverage = computeVisualCoverage({
      broll: [{ startMs: 0, endMs: 4000, trackHint: "broll", source: "stock", searchQuery: "x" }],
      zoom: [{ startMs: 3000, endMs: 6000, scaleFrom: 100, scaleTo: 110 }], // overlaps broll, extends coverage to 6000
      stickers: [],
      captions: [],
    });
    const gaps = findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 8000 }], 2000);
    expect(gaps).toEqual([{ startMs: 6000, endMs: 8000, durationMs: 2000 }]);
  });

  it("only reports gaps within surviving segments, never inside removed spans", () => {
    const coverage = computeVisualCoverage({ broll: [], zoom: [], stickers: [], captions: [] });
    // Two surviving segments with a real cut between them — the removed
    // span itself must never appear as a "gap."
    const gaps = findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 3000 }, { startMs: 8000, endMs: 11_000 }], 2000);
    expect(gaps).toEqual([
      { startMs: 0, endMs: 3000, durationMs: 3000 },
      { startMs: 8000, endMs: 11_000, durationMs: 3000 },
    ]);
  });
});

describe("decideFixForGap", () => {
  it("prefers broll for a large gap, zoom for a small one, with no recent history", () => {
    expect(decideFixForGap([], 5000)).toBe("broll");
    expect(decideFixForGap([], 2200)).toBe("zoom");
  });

  it("falls through to the next-cheapest option when the preferred kind was picked in the recent window", () => {
    // A large gap would normally pick "broll" first, but it was just used -> falls through.
    const kind = decideFixForGap(["broll"], 5000);
    expect(kind).not.toBe("broll");
  });

  // TASK 9 real bug fix (2026-08-07) — "broll" is a legitimate REPEATED
  // choice across a video (that's the whole point of b-roll density); the
  // OLD version of this function used the whole-job variety ledger's
  // isRepeat(), which made "broll" permanently unavailable after its
  // first-ever use. It must remain choosable again once it's no longer
  // within the recent alternation window.
  it("allows a kind to be picked again once it has scrolled out of the recent alternation window", () => {
    // FIX_ALTERNATION_WINDOW is 2 — 3 rounds back is outside the window.
    const kind = decideFixForGap(["broll", "zoom", "sticker"], 5000);
    expect(kind).toBe("broll"); // "broll" is no longer in the last-2 window (["zoom","sticker"])
  });
});

// Production fix (2026-08-08) — root cause of "B-roll often missing
// completely," traced against a real production job: this function used
// to return the nearest caption's own LITERAL TEXT (real Hinglish caption
// "Aapke Ghar Tak" sent straight to a stock search, scored 0.33 relevance,
// rejected). It now derives an actual VISUAL CONCEPT via a priority chain
// of real signals, never the raw spoken/caption text.
describe("deriveFixSearchQuery", () => {
  const gap = { startMs: 4000, endMs: 6000, durationMs: 2000 };

  it("NEVER returns the raw caption text — the real production regression case", () => {
    // The exact real caption from the traced production job.
    const captions = [caption("Aapke Ghar Tak", 3000, 6500)];
    const result = deriveFixSearchQuery(gap, captions);
    expect(result.primary).not.toBe("Aapke Ghar Tak");
    expect(result.primary.toLowerCase()).not.toContain("aapke");
  });

  it("rule 5 — prefers GPT-5's own nearby real (non-auto-inserted) b-roll searchQuery over everything else", () => {
    const captions = [caption("Paise Bachao", 3000, 6500)]; // would otherwise map to MONEY_CONCEPTS
    const existingBroll = [
      { startMs: 5000, endMs: 5500, trackHint: "broll", source: "stock" as const, searchQuery: "office team meeting", searchQueries: ["startup culture"] },
    ];
    const result = deriveFixSearchQuery(gap, captions, { existingBroll });
    expect(result.primary).toBe("office team meeting");
    expect(result.alternatives).toEqual(["startup culture"]);
  });

  it("rule 5 — ignores an existing broll item that's itself auto-inserted (not a real GPT proposal)", () => {
    const captions = [caption("Paise Bachao", 3000, 6500)];
    const existingBroll = [
      { startMs: 5000, endMs: 5500, trackHint: "broll", source: "stock" as const, searchQuery: "should be ignored", autoInserted: true },
    ];
    const result = deriveFixSearchQuery(gap, captions, { existingBroll });
    expect(result.primary).not.toBe("should be ignored");
  });

  it("rule 5 — ignores an existing broll item too far away in time", () => {
    const captions = [caption("Paise Bachao", 3000, 6500)];
    const existingBroll = [{ startMs: 500_000, endMs: 500_500, trackHint: "broll", source: "stock" as const, searchQuery: "totally different topic" }];
    const result = deriveFixSearchQuery(gap, captions, { existingBroll });
    expect(result.primary).not.toBe("totally different topic");
  });

  it("rule 4 — prefers Gemini's own nearby real scene description over the caption-derived guess", () => {
    const captions = [caption("Paise Bachao", 3000, 6500)];
    const visualContext = [{ startMs: 4500, endMs: 5500, description: "A man sits at a wooden desk reviewing paperwork." }];
    const result = deriveFixSearchQuery(gap, captions, { visualContext });
    expect(result.primary.toLowerCase()).toContain("wooden");
  });

  it("rule 3 — prefers literal English words spoken inline near the gap (Devanagari transcript, Latin-script token)", () => {
    const captions = [caption("Aapke Ghar Tak", 3000, 6500)]; // would otherwise map to HOME_CONCEPTS
    const words = [
      { word: "हम", startMs: 4200, endMs: 4400 },
      { word: "interior", startMs: 4400, endMs: 4900 },
      { word: "design", startMs: 4900, endMs: 5300 },
    ];
    const result = deriveFixSearchQuery(gap, captions, { words });
    expect(result.primary).toBe("interior design");
  });

  it("rule 3 — ignores common English function words even if pure-Latin-script", () => {
    const captions: ReturnType<typeof caption>[] = [];
    const words = [
      { word: "the", startMs: 4200, endMs: 4400 },
      { word: "and", startMs: 4400, endMs: 4600 },
      { word: "with", startMs: 4600, endMs: 4800 },
    ];
    const result = deriveFixSearchQuery(gap, captions, { words });
    // No real content word found -> falls all the way through to the generic fallback.
    expect(["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"]).toContain(result.primary);
  });

  it("rule 2 — infers a visual concept from Hinglish caption text, exactly the real production example", () => {
    const captions = [caption("Aapke Ghar Tak", 3000, 6500)];
    const result = deriveFixSearchQuery(gap, captions);
    expect(result.primary).toBe("house construction");
    expect(result.alternatives).toEqual(["home interior", "family home", "construction worker", "new house"]);
  });

  it("rule 2 — 'Paise Bachao' maps to money/finance concepts, never the literal words", () => {
    const captions = [caption("Paise Bachao", 3000, 6500)];
    const result = deriveFixSearchQuery(gap, captions);
    expect(result.primary).toBe("money");
    expect(result.alternatives).toContain("investment");
    expect(result.primary.toLowerCase()).not.toContain("paise");
    expect(result.primary.toLowerCase()).not.toContain("bachao");
  });

  it("rule 2 — 'Healthy Rahna' maps to health concepts", () => {
    const captions = [caption("Healthy Rahna", 3000, 6500)];
    const result = deriveFixSearchQuery(gap, captions);
    expect(result.primary).toBe("doctor");
    expect(result.alternatives).toContain("hospital");
  });

  it("rule 2 — 'Business Grow' maps to business/office concepts", () => {
    const captions = [caption("Business Grow", 3000, 6500)];
    const result = deriveFixSearchQuery(gap, captions);
    expect(result.primary).toBe("office");
    expect(result.alternatives).toContain("teamwork");
  });

  it("rule 6 — falls back to a deterministic generic editorial query when nothing maps, never the literal words", () => {
    const captions = [caption("Zindagi mein khushiyan dhoondo", 3000, 6500)];
    // None of these tokens are in the curated concept map — should fall through.
    const result = deriveFixSearchQuery(gap, captions);
    const generic = ["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"];
    expect(generic).toContain(result.primary);
    expect(result.primary.toLowerCase()).not.toContain("zindagi");
  });

  it("rule 6 — the SAME gap always produces the SAME generic fallback (deterministic, not random)", () => {
    const a = deriveFixSearchQuery({ startMs: 42_000, endMs: 44_000, durationMs: 2000 }, []);
    const b = deriveFixSearchQuery({ startMs: 42_000, endMs: 44_000, durationMs: 2000 }, []);
    expect(a.primary).toBe(b.primary);
  });

  it("falls back to a generic phrase when there are no captions and no other context", () => {
    const result = deriveFixSearchQuery({ startMs: 0, endMs: 2000, durationMs: 2000 }, []);
    expect(["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"]).toContain(result.primary);
  });
});

describe("applyNoDeadScreenFixes", () => {
  it("produces one tagged, autoInserted item per gap and updates the ledger", () => {
    const gaps = [{ startMs: 0, endMs: 5000, durationMs: 5000 }]; // large gap -> broll
    const result = applyNoDeadScreenFixes(gaps, [caption("a doctor talking about diabetes", 0, 1000)], createEmptyVarietyLedger());

    expect(result.gapsFixed).toBe(1);
    expect(result.broll).toHaveLength(1);
    expect(result.broll[0].autoInserted).toBe(true);
    expect(result.broll[0].reason).toContain("no-dead-screen rule");
    expect(result.broll[0].searchQuery).toBeTruthy();
    expect(result.ledger.brollStyles.length).toBeGreaterThan(0);
  });

  it("threads context through end-to-end: a Hinglish caption gap gets a real visual concept, plus searchQueries alternatives (rule 8 plumbing)", () => {
    const gaps = [{ startMs: 0, endMs: 5000, durationMs: 5000 }]; // large gap -> broll
    const result = applyNoDeadScreenFixes(gaps, [caption("Aapke Ghar Tak", 0, 1000)], createEmptyVarietyLedger(), {});

    expect(result.broll[0].searchQuery).toBe("house construction");
    expect(result.broll[0].searchQuery).not.toBe("Aapke Ghar Tak");
    expect(result.broll[0].searchQueries).toEqual(["home interior", "family home", "construction worker", "new house"]);
  });

  it("threads real GPT-proposed b-roll context through — reuses it over the caption-derived guess", () => {
    const gaps = [{ startMs: 0, endMs: 5000, durationMs: 5000 }];
    const existingBroll = [{ startMs: 500, endMs: 900, trackHint: "broll", source: "stock" as const, searchQuery: "doctor consultation" }];
    const result = applyNoDeadScreenFixes(gaps, [caption("Aapke Ghar Tak", 0, 1000)], createEmptyVarietyLedger(), { existingBroll });

    expect(result.broll[0].searchQuery).toBe("doctor consultation");
  });

  it("produces zero items when there are zero gaps", () => {
    const result = applyNoDeadScreenFixes([], [], createEmptyVarietyLedger());
    expect(result).toEqual({ broll: [], zoom: [], stickers: [], ledger: createEmptyVarietyLedger(), gapsFixed: 0 });
  });

  // TASK 9 (2026-08-07) — several same-size (large) gaps in a row must
  // genuinely ALTERNATE fix kinds, not repeat "broll" every single time —
  // this is the real, end-to-end proof of the alternation-window fix.
  it("alternates fix kinds across several consecutive large gaps instead of repeating the same one", () => {
    const gaps = [
      { startMs: 0, endMs: 5000, durationMs: 5000 },
      { startMs: 6000, endMs: 11_000, durationMs: 5000 },
      { startMs: 12_000, endMs: 17_000, durationMs: 5000 },
      { startMs: 18_000, endMs: 23_000, durationMs: 5000 },
    ];
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger());
    // No two ADJACENT gaps may produce the exact same kind.
    const kindOf = (startMs: number): string => {
      if (result.zoom.some((z) => z.startMs === startMs)) return "zoom";
      if (result.stickers.some((s) => s.startMs === startMs)) return "sticker";
      const b = result.broll.find((item) => item.startMs === startMs);
      return b?.contentKind === "motion_graphic" ? "motion_graphic" : "broll";
    };
    const sequence = gaps.map((g) => kindOf(g.startMs));
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).not.toBe(sequence[i - 1]);
    }
  });

  it("the auto-fixer's own zoom insert always uses the subtle 'micro' style, never a loud one", () => {
    const result = applyNoDeadScreenFixes([{ startMs: 0, endMs: 2200, durationMs: 2200 }], [], createEmptyVarietyLedger());
    expect(result.zoom).toHaveLength(1);
    expect(result.zoom[0].style).toBe("micro");
  });

  // Polish pass (2026-08-07, "avoid fixed spacing... nothing should feel
  // algorithmic") — real bug: every auto-fixed zoom used to land on the
  // IDENTICAL scaleTo (112) and every auto-fixed sticker used the
  // IDENTICAL 2000ms duration, a genuinely detectable "AI-generated" tell.
  it("varies the auto-fixed zoom's scaleTo across different gaps, never a fixed constant", () => {
    // Many small (<2500ms) gaps, widely spread, so several land on "zoom"
    // despite the alternation window forcing kind-switching in between.
    const gaps = Array.from({ length: 12 }, (_, i) => ({ startMs: i * 20_000, endMs: i * 20_000 + 2200, durationMs: 2200 }));
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger());
    expect(result.zoom.length).toBeGreaterThan(1);

    const scaleTos = result.zoom.map((z) => z.scaleTo);
    expect(new Set(scaleTos).size).toBeGreaterThan(1); // genuinely different across gaps
    for (const s of scaleTos) {
      expect(s).toBeGreaterThanOrEqual(106);
      expect(s).toBeLessThanOrEqual(114);
    }
  });

  it("the SAME gap always produces the SAME scaleTo — deterministic, not truly random", () => {
    const gap = { startMs: 42_000, endMs: 44_200, durationMs: 2200 };
    const a = applyNoDeadScreenFixes([gap], [], createEmptyVarietyLedger());
    const b = applyNoDeadScreenFixes([gap], [], createEmptyVarietyLedger());
    expect(a.zoom[0].scaleTo).toBe(b.zoom[0].scaleTo);
  });

  it("varies the auto-fixed sticker's duration across different gaps, and never exceeds the gap's own size", () => {
    // Many gaps, spread widely, so at least several land on "sticker"
    // despite the alternation window forcing kind-switching.
    const gaps = Array.from({ length: 12 }, (_, i) => ({ startMs: i * 20_000, endMs: i * 20_000 + 2100, durationMs: 2100 }));
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger());
    expect(result.stickers.length).toBeGreaterThan(1);

    const durations = result.stickers.map((s) => s.endMs - s.startMs);
    expect(new Set(durations).size).toBeGreaterThan(1); // genuinely varies
    for (const d of durations) {
      expect(d).toBeLessThanOrEqual(2100); // never exceeds its own gap
      expect(d).toBeGreaterThanOrEqual(1200);
    }
  });

  it("never lets an auto-fixed sticker's duration exceed a genuinely SMALL gap", () => {
    const result = applyNoDeadScreenFixes([{ startMs: 0, endMs: 1600, durationMs: 1600 }], [], createEmptyVarietyLedger());
    if (result.stickers.length > 0) {
      expect(result.stickers[0].endMs - result.stickers[0].startMs).toBeLessThanOrEqual(1600);
    }
  });
});
