import { describe, expect, it } from "vitest";
import { createEmptyVarietyLedger } from "./variety-ledger";
import {
  applyNoDeadScreenFixes,
  computeSourceSurvivingWindows,
  computeVisualCoverage,
  decideFixForGap,
  deriveFixSearchQuery,
  findDeadScreenGaps,
  subdivideGap,
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

  // Real production regression (2026-08-10) — rule 4 used to return
  // `alternatives: []` unconditionally. For a single-setting talking-head
  // video, Gemini's own scene description repeats near-identically across
  // many gaps (e.g. "Dentist seated at office desk wearing..."), so every
  // one of those gaps had ZERO fallback the moment that literal, generic
  // phrase scored below the resolver's relevance threshold — the resolver's
  // own primary-vs-alternatives fix (ai-broll-resolver.ts, 2026-08-09) had
  // nothing to compare against. Rule 4 must now hand back real, non-empty
  // alternatives every time, without changing its own primary output.
  it("rule 4 — now also returns non-empty, deterministic alternatives (previously always [])", () => {
    const captions = [caption("Paise Bachao", 3000, 6500)];
    const visualContext = [{ startMs: 4500, endMs: 5500, description: "A man sits at a wooden desk reviewing paperwork." }];
    const result = deriveFixSearchQuery(gap, captions, { visualContext });

    // Primary is completely unaffected — same value as the pre-existing test above.
    expect(result.primary.toLowerCase()).toContain("wooden");
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    // Drawn only from the existing generic editorial fallback vocabulary — no new concept invented.
    for (const alt of result.alternatives) {
      expect(["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"]).toContain(alt);
    }
    // Never a duplicate of the primary itself.
    expect(result.alternatives).not.toContain(result.primary);

    const again = deriveFixSearchQuery(gap, captions, { visualContext });
    expect(again.alternatives).toEqual(result.alternatives); // deterministic, not random
  });

  // Candidate 1 (2026-08-11) — real production regression: "Doctor seated
  // at clinic desk speaking" (rule 4) only ever had genericAlternates()'s
  // cross-topic vocabulary available, whose single closest word
  // ("healthcare") scored 0.4 against a real stock candidate — below the
  // 0.5 confidence threshold. Rule 4 now checks its own (untruncated)
  // description text against the SAME HINGLISH_VISUAL_CONCEPT_MAP rule 2
  // already uses, and prefers a confidently-detected domain's own richer
  // vocabulary over the generic rotation. The PRIMARY is untouched — this
  // is Tests 1 and 2 together, since both facts come from the same call.
  it("rule 4 — a medical scene keeps its primary unchanged and prefers HEALTH-specific alternatives over the generic list", () => {
    const captions = [caption("Paise Bachao", 3000, 6500)]; // irrelevant — would otherwise map to MONEY_CONCEPTS via rule 2
    const visualContext = [{ startMs: 4500, endMs: 5500, description: "Doctor seated at clinic desk speaking to a patient calmly." }];
    const result = deriveFixSearchQuery(gap, captions, { visualContext });

    // Test 1 — primary is EXACTLY the same literal 6-word truncation as before this fix.
    expect(result.primary).toBe("Doctor seated at clinic desk speaking");
    // Test 2 — alternatives now come from HEALTH_CONCEPTS, never the generic list.
    expect(result.alternatives.length).toBeGreaterThan(0);
    for (const alt of result.alternatives) {
      expect(["doctor", "healthy lifestyle", "exercise", "hospital", "medical"]).toContain(alt);
    }
    expect(result.alternatives).not.toContain(result.primary);
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

  // Same regression, rule 3 — a literal transcript snippet is just as
  // incapable of offering a curated alternates list as rule 4's raw scene
  // description, and used to return `alternatives: []` for the same reason.
  it("rule 3 — now also returns non-empty, deterministic alternatives (previously always [])", () => {
    const words = [
      { word: "हम", startMs: 4200, endMs: 4400 },
      { word: "interior", startMs: 4400, endMs: 4900 },
      { word: "design", startMs: 4900, endMs: 5300 },
    ];
    const result = deriveFixSearchQuery(gap, [], { words });

    expect(result.primary).toBe("interior design");
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    for (const alt of result.alternatives) {
      expect(["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"]).toContain(alt);
    }
    expect(result.alternatives).not.toContain(result.primary);
  });

  // Candidate 1, Test 3 — rule 3's own literal transcript snippet gets the
  // same domain-classification treatment as rule 4, using its own source
  // text (the nearby English words, not just the 5-word primary slice).
  it("rule 3 — receives domain-specific alternatives when its own source text clearly names a domain", () => {
    const words = [
      { word: "हम", startMs: 4200, endMs: 4400 },
      { word: "house", startMs: 4400, endMs: 4900 },
      { word: "construction", startMs: 4900, endMs: 5300 },
    ];
    const result = deriveFixSearchQuery(gap, [], { words });

    expect(result.primary).toBe("house construction");
    expect(result.alternatives.length).toBeGreaterThan(0);
    for (const alt of result.alternatives) {
      expect(["house construction", "home interior", "family home", "construction worker", "new house"]).toContain(alt);
    }
    expect(result.alternatives).not.toContain(result.primary);
  });

  // Candidate 1, Test 4 — a scene with no detectable domain keyword must
  // still fall back to the existing genericAlternates() behavior exactly
  // as before this fix (not fail, not return an empty list).
  it("rule 4 — a scene with no detectable domain still falls back to genericAlternates()", () => {
    const visualContext = [{ startMs: 4500, endMs: 5500, description: "A man sits at a wooden desk reviewing paperwork." }];
    const result = deriveFixSearchQuery(gap, [], { visualContext });

    expect(result.primary.toLowerCase()).toContain("wooden");
    for (const alt of result.alternatives) {
      expect(["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"]).toContain(alt);
    }
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

  // Review finding (2026-08-11) — extending HINGLISH_VISUAL_CONCEPT_MAP for
  // rules 3/4 (Candidate 1) also changes rule 2's OWN output for any
  // caption whose nearest text contains one of the newly-added English
  // keys, since rule 2 reads the exact same map. A real, pre-existing test
  // ("produces one tagged, autoInserted item per gap...", below in the
  // applyNoDeadScreenFixes suite) already uses the caption "a doctor
  // talking about diabetes" — before this fix, "doctor" matched nothing,
  // so it fell through to rule 6's generic fallback (deterministically
  // "office work" for that test's gap.startMs=0); after this fix, "doctor"
  // now matches HEALTH_CONCEPTS via rule 2, same as any other caption
  // keyword. That existing test's own assertions are loose (`toBeTruthy()`)
  // and don't pin the literal value, so it kept passing without ever
  // proving which behavior was actually in effect. This is an intentional,
  // correct consequence of Candidate 1 (a caption naming "doctor" SHOULD
  // resolve to a real health concept instead of a random generic word) —
  // not a regression — but it was previously unverified. Locking it in
  // explicitly here.
  it("rule 2 — a caption containing one of the newly-added English domain keywords now matches instead of falling through to rule 6", () => {
    const captions = [caption("a doctor talking about diabetes", 0, 1000)];
    const result = deriveFixSearchQuery({ startMs: 0, endMs: 5000, durationMs: 5000 }, captions);

    expect(result.primary).toBe("doctor");
    expect(result.alternatives).toEqual(["healthy lifestyle", "exercise", "hospital", "medical"]);
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

  // Candidate 1, Test 5 — the new English keywords added to
  // HINGLISH_VISUAL_CONCEPT_MAP for rules 3/4 must not change rule 2's own
  // existing, already-tested behavior. Re-asserts the exact same known
  // outputs as the four rule 2 tests above, unchanged.
  it("rule 2 — existing behavior is byte-identical after extending the concept map for rules 3/4", () => {
    expect(deriveFixSearchQuery(gap, [caption("Aapke Ghar Tak", 3000, 6500)])).toEqual({
      primary: "house construction",
      alternatives: ["home interior", "family home", "construction worker", "new house"],
    });
    expect(deriveFixSearchQuery(gap, [caption("Paise Bachao", 3000, 6500)]).primary).toBe("money");
    expect(deriveFixSearchQuery(gap, [caption("Healthy Rahna", 3000, 6500)]).primary).toBe("doctor");
    expect(deriveFixSearchQuery(gap, [caption("Business Grow", 3000, 6500)]).primary).toBe("office");
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

  // Fix (2026-08-12) — rule 3 used to accept ANY pure-Latin-script,
  // non-function-word token as "genuine English" (see isLikelyEnglishWord's
  // own doc comment, visual-coverage.ts, for the real regression this
  // disproved: AssemblyAI's transcript for Hinglish speech is ITSELF
  // romanized, e.g. "Ghar"/"Khaana"/"Shaadi"). Rule 3 now rejects the
  // map's own original Hindi-romanization keys, so a gap surrounded only
  // by those words correctly falls through to rule 2's real concept
  // mapping instead of literally searching for the untranslated words.
  it("rule 3 — rejects pure Hindi/Hinglish romanization words (the map's own keys), so rule 2 gets a real chance (real regression class: 'Aapke Ghar Tak')", () => {
    const captions = [caption("Aapke Ghar Tak", 3000, 6500)]; // rule 2 -> house construction
    const words = [
      { word: "हम", startMs: 4200, endMs: 4400 },
      { word: "Ghar", startMs: 4400, endMs: 4900 }, // a HINGLISH_VISUAL_CONCEPT_MAP key — no longer "English"
      { word: "Khaana", startMs: 4900, endMs: 5300 }, // also a map key
    ];
    const result = deriveFixSearchQuery(gap, captions, { words });
    // Rule 3 now yields nothing for this gap (both nearby words are
    // rejected) — falls all the way through to rule 2's real mapping.
    expect(result.primary).toBe("house construction");
    expect(result.primary.toLowerCase()).not.toContain("ghar");
    expect(result.primary.toLowerCase()).not.toContain("khaana");
  });

  // Fix (2026-08-12, follow-up) — the map-key rejection alone only
  // catches "Ghar" (a concept word); it does nothing for "Aapke" or "Tak"
  // (pure grammar — a pronoun+postposition, no visual concept). The new
  // HINDI_FUNCTION_WORDS set closes that gap: this is the literal, exact,
  // real production regression phrase, reproduced word-for-word as the
  // nearby transcript words, and it must no longer become rule 3's
  // primary at all.
  it("rule 3 — the literal real regression phrase 'Aapke Ghar Tak' can no longer become the rule 3 primary (all three words now rejected: 'Ghar' via the map-key check, 'Aapke'/'Tak' via HINDI_FUNCTION_WORDS)", () => {
    const captions = [caption("Aapke Ghar Tak", 3000, 6500)]; // rule 2 -> house construction
    const words = [
      { word: "हम", startMs: 4200, endMs: 4400 },
      { word: "Aapke", startMs: 4400, endMs: 4700 },
      { word: "Ghar", startMs: 4700, endMs: 4900 },
      { word: "Tak", startMs: 4900, endMs: 5100 },
    ];
    const result = deriveFixSearchQuery(gap, captions, { words });
    expect(result.primary).not.toBe("Aapke Ghar Tak");
    expect(result.primary.toLowerCase()).not.toContain("aapke");
    expect(result.primary.toLowerCase()).not.toContain("ghar");
    expect(result.primary.toLowerCase()).not.toContain("tak");
    // Falls all the way through to rule 2's real concept mapping.
    expect(result.primary).toBe("house construction");
  });

  // Honest, documented KNOWN GAP (2026-08-12) — "Nakshe" ("blueprint/map")
  // is a standalone Hindi CONTENT noun: not a HINGLISH_VISUAL_CONCEPT_MAP
  // key (that would require expanding the map's vocabulary, explicitly
  // out of scope for this fix) and not a grammatical function word either
  // (so HINDI_FUNCTION_WORDS correctly doesn't cover it — it isn't a
  // pronoun/postposition/particle). No reliable structural/phonetic
  // heuristic exists that wouldn't ALSO misclassify genuine English (see
  // isLikelyEnglishWord's own doc comment for the concrete English-word
  // collisions this ruled out). This test documents — rather than hides —
  // that "Nakshe" alone still currently passes as "English" and can still
  // become a rule 3 primary. This is a known, accepted, explicitly
  // reported limitation, not an oversight.
  it("rule 3 — KNOWN GAP: 'Nakshe' (a standalone Hindi content noun, not a map key or a function word) is NOT rejected by this fix and can still become the rule 3 primary", () => {
    const words = [
      { word: "हम", startMs: 4200, endMs: 4400 },
      { word: "Nakshe", startMs: 4400, endMs: 4900 },
    ];
    const result = deriveFixSearchQuery(gap, [], { words });
    // Documents the CURRENT (still imperfect) behavior — "Nakshe" passes
    // isLikelyEnglishWord and becomes the literal rule 3 primary (rule 3
    // lowercases its own output — see its own `.toLowerCase()` call). If
    // this assertion ever starts failing because "Nakshe" gets rejected,
    // that means the gap was closed some other way — update this test's
    // own comment/expectation to match, don't just delete it.
    expect(result.primary).toBe("nakshe");
  });

  // Fix (2026-08-12, follow-up) — proves HINDI_FUNCTION_WORDS was
  // deliberately kept small and specific: every one of these words is a
  // real Hindi word too, but each is ALSO a real, plausible English word
  // in this app's own content domains, and was deliberately left OUT of
  // the rejection list for exactly that reason (see the list's own doc
  // comment). Rule 3 must keep treating them as English.
  it("rule 3 — genuine English words that are ALSO real Hindi words ('main', 'koi', 'tab', 'tera', 'fir') are deliberately NOT rejected — real English collisions were excluded from HINDI_FUNCTION_WORDS on purpose", () => {
    for (const word of ["main", "koi", "tab", "tera", "fir"]) {
      const words = [
        { word: "हम", startMs: 4200, endMs: 4400 },
        { word, startMs: 4400, endMs: 4900 },
      ];
      const result = deriveFixSearchQuery(gap, [], { words });
      expect(result.primary).toBe(word);
    }
  });

  // Preserves the pre-existing tests above ("interior design", "house
  // construction" via rule 3) — re-asserted explicitly here as this fix's
  // own regression pin: genuine English domain words that ALSO happen to
  // be HINGLISH_VISUAL_CONCEPT_MAP keys (added later, for rule 2's own
  // caption-catching purposes — see that map's "Plain-English topic
  // words"/"Production fix" section comments) must NOT be rejected by this
  // fix — only the map's ORIGINAL Hindi-transliteration keys are excluded.
  it("rule 3 — genuine English domain words that also happen to be map keys ('house', 'construction') are still treated as English, unaffected by this fix", () => {
    const words = [
      { word: "हम", startMs: 4200, endMs: 4400 },
      { word: "house", startMs: 4400, endMs: 4900 },
      { word: "construction", startMs: 4900, endMs: 5300 },
    ];
    const result = deriveFixSearchQuery(gap, [], { words });
    expect(result.primary).toBe("house construction");
  });

  // Rule 2 reads HINGLISH_VISUAL_CONCEPT_MAP/matchHinglishConcepts
  // directly and never calls isLikelyEnglishWord at all — this fix cannot
  // change its output. Re-asserts the exact same known outputs as the
  // pre-existing "byte-identical" test above, unchanged.
  it("rule 2 — output is completely unaffected by the isLikelyEnglishWord fix (rule 2 never calls it)", () => {
    expect(deriveFixSearchQuery(gap, [caption("Aapke Ghar Tak", 3000, 6500)])).toEqual({
      primary: "house construction",
      alternatives: ["home interior", "family home", "construction worker", "new house"],
    });
  });
});

describe("applyNoDeadScreenFixes", () => {
  // Visual-pacing upgrade (2026-08-09) — these 3 tests predate subdivideGap
  // and are specifically about PER-ITEM tagging/query-derivation behavior,
  // not about gap sizing. Since the default maxDwellMs (2500ms) would now
  // genuinely subdivide a 5000ms gap into multiple items, they explicitly
  // pass a larger maxDwellMs here to keep testing exactly what they always
  // tested — subdivision itself gets its own dedicated tests below.
  it("produces one tagged, autoInserted item per gap and updates the ledger", () => {
    const gaps = [{ startMs: 0, endMs: 5000, durationMs: 5000 }]; // large gap -> broll
    const result = applyNoDeadScreenFixes(gaps, [caption("a doctor talking about diabetes", 0, 1000)], createEmptyVarietyLedger(), { maxDwellMs: 6000 });

    expect(result.gapsFixed).toBe(1);
    expect(result.broll).toHaveLength(1);
    expect(result.broll[0].autoInserted).toBe(true);
    expect(result.broll[0].reason).toContain("no-dead-screen rule");
    expect(result.broll[0].searchQuery).toBeTruthy();
    expect(result.ledger.brollStyles.length).toBeGreaterThan(0);
  });

  it("threads context through end-to-end: a Hinglish caption gap gets a real visual concept, plus searchQueries alternatives (rule 8 plumbing)", () => {
    const gaps = [{ startMs: 0, endMs: 5000, durationMs: 5000 }]; // large gap -> broll
    const result = applyNoDeadScreenFixes(gaps, [caption("Aapke Ghar Tak", 0, 1000)], createEmptyVarietyLedger(), { maxDwellMs: 6000 });

    expect(result.broll[0].searchQuery).toBe("house construction");
    expect(result.broll[0].searchQuery).not.toBe("Aapke Ghar Tak");
    expect(result.broll[0].searchQueries).toEqual(["home interior", "family home", "construction worker", "new house"]);
  });

  it("threads real GPT-proposed b-roll context through — reuses it over the caption-derived guess", () => {
    const gaps = [{ startMs: 0, endMs: 5000, durationMs: 5000 }];
    const existingBroll = [{ startMs: 500, endMs: 900, trackHint: "broll", source: "stock" as const, searchQuery: "doctor consultation" }];
    const result = applyNoDeadScreenFixes(gaps, [caption("Aapke Ghar Tak", 0, 1000)], createEmptyVarietyLedger(), { existingBroll, maxDwellMs: 6000 });

    expect(result.broll[0].searchQuery).toBe("doctor consultation");
  });

  // Real production regression (2026-08-10) — rule 4's alternatives used to
  // be [], so an item resolving via a Gemini scene description reached
  // ai-broll-resolver.ts with `searchQueries: undefined` and no second
  // chance at all. Confirms the fix's alternatives genuinely flow all the
  // way through to the persisted `searchQueries` field the resolver reads.
  it("threads rule 4's now-non-empty alternatives through as searchQueries (previously always undefined)", () => {
    const gaps = [{ startMs: 0, endMs: 5000, durationMs: 5000 }];
    const visualContext = [{ startMs: 2000, endMs: 3000, description: "A man sits at a wooden desk reviewing paperwork." }];
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { visualContext, maxDwellMs: 6000 });

    expect(result.broll[0].searchQuery!.toLowerCase()).toContain("wooden");
    expect(result.broll[0].searchQueries).toBeDefined();
    expect(result.broll[0].searchQueries!.length).toBeGreaterThan(0);
    for (const alt of result.broll[0].searchQueries!) {
      expect(["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"]).toContain(alt);
    }
  });

  // Candidate 2 (2026-08-11) — real production regression: subdivideGap()
  // correctly splits one long dead-screen stretch into several sub-gaps,
  // but each sub-gap independently re-derives its own query from the same
  // sparse signal — for a single-setting video, that meant every sub-gap
  // showing the IDENTICAL literal "Doctor seated at clinic desk speaking"
  // query. Tests 6, 7, and 9 together: the repeat is detected via the
  // SAME ledger.brollStyles history this function already threads through
  // the loop, and the second sub-gap is swapped to a genuinely unused,
  // still-relevant HEALTH alternative rather than repeating the primary.
  it("a repeated rule 4 query across two sub-gaps is detected via the ledger and swapped to an unused HEALTH alternative", () => {
    const gaps = [
      { startMs: 0, endMs: 5000, durationMs: 5000 },
      { startMs: 6000, endMs: 11_000, durationMs: 5000 },
    ];
    const visualContext = [{ startMs: 0, endMs: 11_000, description: "Doctor seated at clinic desk speaking to a patient calmly." }];
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { visualContext, maxDwellMs: 6000 });

    expect(result.broll).toHaveLength(2);
    // First sub-gap keeps the real derived primary — nothing to avoid yet.
    expect(result.broll[0].searchQuery).toBe("Doctor seated at clinic desk speaking");
    // Second sub-gap does NOT repeat it — a real, still-relevant HEALTH
    // concept was available and unused, so it wins instead (Test 9: never
    // select an already-used option while an unused valid one exists).
    expect(result.broll[1].searchQuery).not.toBe(result.broll[0].searchQuery);
    expect(["doctor", "healthy lifestyle", "exercise", "hospital", "medical"]).toContain(result.broll[1].searchQuery);
    // Both choices are genuinely recorded in the ledger this same call threads through.
    expect(result.ledger.brollStyles).toContain(result.broll[0].searchQuery);
    expect(result.ledger.brollStyles).toContain(result.broll[1].searchQuery);
  });

  // The founder's own explicit "7 sub-gaps" example. Deliberately does NOT
  // hardcode the exact kind-rotation sequence decideFixForGap produces
  // (unrelated to this fix, and untouched by it) — instead asserts the
  // property that actually matters: every broll-array query is drawn from
  // the REAL known vocabulary (the derived primary + the real HEALTH_CONCEPTS
  // words), no two repeat unnecessarily while an unused option remains, and
  // once the real vocabulary (6 total: 1 primary + 5 concepts) is
  // genuinely exhausted, a repeat is allowed rather than fabricating a
  // 7th "fake" variant — "avoid unnecessary duplicates, don't manufacture
  // fake variety" per the founder's own explicit instruction.
  it("7 sub-gaps from one original dead-screen stretch get real variety, never manufacturing more than the real vocabulary supports", () => {
    const gaps = Array.from({ length: 7 }, (_, i) => ({ startMs: i * 2500, endMs: i * 2500 + 2500, durationMs: 2500 }));
    const visualContext = [{ startMs: 0, endMs: 17_500, description: "Doctor seated at clinic desk speaking to a patient calmly." }];
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { visualContext, maxDwellMs: 6000 });

    const queries = result.broll.map((b) => b.searchQuery!);
    expect(queries.length).toBeGreaterThan(0);
    const knownVocabulary = ["Doctor seated at clinic desk speaking", "doctor", "healthy lifestyle", "exercise", "hospital", "medical"];
    for (const q of queries) expect(knownVocabulary).toContain(q); // never a fabricated string
    // No more duplication than the real 6-word vocabulary forces once it's exhausted.
    expect(new Set(queries).size).toBe(Math.min(queries.length, knownVocabulary.length));
  });

  // Candidate 2, Test 8 — the SAME repeat-avoidance must also work when no
  // domain was detected at all (Candidate 1's generic fallback path),
  // proving the two candidates compose correctly rather than only working
  // together by coincidence.
  it("also de-duplicates the generic fallback rotation when no domain is detected", () => {
    const gaps = [
      { startMs: 0, endMs: 5000, durationMs: 5000 },
      { startMs: 6000, endMs: 11_000, durationMs: 5000 },
    ];
    const visualContext = [{ startMs: 0, endMs: 11_000, description: "A man sits at a wooden desk reviewing paperwork." }];
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { visualContext, maxDwellMs: 6000 });

    expect(result.broll).toHaveLength(2);
    expect(result.broll[0].searchQuery!.toLowerCase()).toContain("wooden");
    expect(result.broll[1].searchQuery).not.toBe(result.broll[0].searchQuery);
    const generic = ["office work", "business people", "healthcare", "education", "technology", "finance", "construction", "nature", "city", "family"];
    expect(generic).toContain(result.broll[1].searchQuery);
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
    // maxDwellMs: 6000 — larger than every gap here, so none subdivide;
    // this test is specifically about alternation across separate GAPS,
    // not about subdivision (which has its own dedicated tests below).
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { maxDwellMs: 6000 });
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

  // Fix (2026-08-12) — broll already tagged its own auto-inserted items
  // `autoInserted: true`; stickers never did, despite aiStickerSchema
  // already having the field. Purely additive metadata — asserts the
  // field is now set without asserting anything about selection/content.
  it("tags every auto-inserted sticker with autoInserted: true (aiStickerSchema already supports this field)", () => {
    const gaps = Array.from({ length: 12 }, (_, i) => ({ startMs: i * 20_000, endMs: i * 20_000 + 2100, durationMs: 2100 }));
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger());
    expect(result.stickers.length).toBeGreaterThan(0);
    for (const sticker of result.stickers) {
      expect(sticker.autoInserted).toBe(true);
    }
  });
});

// Visual-pacing upgrade (2026-08-09) — the real product requirement was
// never "insert 2 b-roll clips when planning fails," it's "maintain a
// ~2-3 second maximum visual dwell time" (~10-15 meaningful visual changes
// across a 30-40s video). subdivideGap is the fix: a long dead-screen gap
// is split into several shorter sub-gaps, each within the configured
// ceiling, BEFORE the existing per-gap fix/rotation loop ever runs.
describe("subdivideGap", () => {
  // Test 1
  it("a 10-second gap subdivides into multiple sub-gaps, each <= the configured max dwell", () => {
    const gap = { startMs: 0, endMs: 10_000, durationMs: 10_000 };
    const subGaps = subdivideGap(gap, 2500);

    expect(subGaps.length).toBeGreaterThan(1);
    for (const g of subGaps) {
      expect(g.durationMs).toBeLessThanOrEqual(2500);
      expect(g.endMs - g.startMs).toBe(g.durationMs);
    }
    // Contiguous, no overlap/holes, and covers the whole original gap.
    expect(subGaps[0].startMs).toBe(0);
    expect(subGaps[subGaps.length - 1].endMs).toBe(10_000);
    for (let i = 1; i < subGaps.length; i++) {
      expect(subGaps[i].startMs).toBe(subGaps[i - 1].endMs);
    }
  });

  // Test 2
  it("a 2-second gap remains a single fix and is not unnecessarily subdivided", () => {
    const gap = { startMs: 0, endMs: 2000, durationMs: 2000 };
    expect(subdivideGap(gap, 2500)).toEqual([gap]);
  });

  it("a gap exactly at the max dwell is left unsubdivided", () => {
    const gap = { startMs: 0, endMs: 2500, durationMs: 2500 };
    expect(subdivideGap(gap, 2500)).toEqual([gap]);
  });
});

describe("applyNoDeadScreenFixes — subdivision integration (Tests 3, 4, 7)", () => {
  function kindOfFactory(result: ReturnType<typeof applyNoDeadScreenFixes>) {
    return (startMs: number): string => {
      if (result.zoom.some((z) => z.startMs === startMs)) return "zoom";
      if (result.stickers.some((s) => s.startMs === startMs)) return "sticker";
      const b = result.broll.find((item) => item.startMs === startMs);
      return b?.contentKind === "motion_graphic" ? "motion_graphic" : "broll";
    };
  }

  // Test 3
  it("a 7-10 second gap produces multiple visual fixes, alternating kinds via the existing rotation logic", () => {
    const gaps = [{ startMs: 0, endMs: 8000, durationMs: 8000 }];
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { maxDwellMs: 2500 });

    const totalFixes = result.broll.length + result.zoom.length + result.stickers.length;
    expect(totalFixes).toBeGreaterThan(1);

    const kindOf = kindOfFactory(result);
    const allStarts = [...result.broll, ...result.zoom, ...result.stickers].map((item) => item.startMs).sort((a, b) => a - b);
    const sequence = allStarts.map(kindOf);
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).not.toBe(sequence[i - 1]); // existing FIX_ALTERNATION_WINDOW logic, untouched
    }
  });

  // Test 4 (unit-level companion to the pipeline-level version in
  // ai-edit-jobs.test.ts) — a single, very long uncovered gap (the shape a
  // total planning failure produces: nothing generated at all) must yield
  // several visual interventions, never just 1-2.
  it("a single very long uncovered gap (as a total planning failure would produce) yields many visual interventions, not just 1-2", () => {
    const gaps = [{ startMs: 0, endMs: 35_000, durationMs: 35_000 }]; // ~30-40s talking-head video, zero coverage
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { maxDwellMs: 2500 });

    const totalFixes = result.broll.length + result.zoom.length + result.stickers.length;
    expect(totalFixes).toBeGreaterThan(2);
    expect(totalFixes).toBeGreaterThanOrEqual(10); // ~35000/2500 = 14, well within the "10-15 visual changes" target
  });

  // Test 7
  it("no generated visual event exceeds the configured max dwell because of the subdivision logic", () => {
    const gaps = [
      { startMs: 0, endMs: 10_000, durationMs: 10_000 },
      { startMs: 20_000, endMs: 27_000, durationMs: 7000 },
      { startMs: 30_000, endMs: 32_200, durationMs: 2200 }, // below the ceiling — must survive unsplit
    ];
    const maxDwellMs = 2500;
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { maxDwellMs });

    for (const b of result.broll) expect(b.endMs - b.startMs).toBeLessThanOrEqual(maxDwellMs);
    for (const z of result.zoom) expect(z.endMs - z.startMs).toBeLessThanOrEqual(maxDwellMs);
    for (const s of result.stickers) expect(s.endMs - s.startMs).toBeLessThanOrEqual(maxDwellMs);
  });

  it("gapsFixed still reports the ORIGINAL gap count, not the subdivided event count", () => {
    const gaps = [{ startMs: 0, endMs: 10_000, durationMs: 10_000 }];
    const result = applyNoDeadScreenFixes(gaps, [], createEmptyVarietyLedger(), { maxDwellMs: 2500 });
    expect(result.gapsFixed).toBe(1);
    expect(result.broll.length + result.zoom.length + result.stickers.length).toBeGreaterThan(1);
  });
});

// Test 5 — Option B, conservative: a caption's own coverage credit is
// capped so a single long caption can't suppress dead-screen detection for
// its entire span, without touching the caption's own real timing/render.
describe("computeVisualCoverage — caption coverage cap (Option B)", () => {
  it("a long caption interval does not fully suppress dead-screen detection for its whole duration when capped", () => {
    const longCaption = caption("this caption spans a very long stretch of unchanging talking-head footage", 0, 20_000);

    // Legacy/uncapped default (no opts) — completely unchanged behavior,
    // e.g. editing-density.ts's computeActualDensities, which deliberately
    // does not opt into this cap.
    const uncapped = computeVisualCoverage({ broll: [], zoom: [], stickers: [], captions: [longCaption] });
    expect(findDeadScreenGaps(uncapped, [{ startMs: 0, endMs: 20_000 }], 1750)).toEqual([]);

    // Capped, as the no-dead-screen pass now opts into.
    const capped = computeVisualCoverage({ broll: [], zoom: [], stickers: [], captions: [longCaption] }, { maxCaptionCreditMs: 2500 });
    const gaps = findDeadScreenGaps(capped, [{ startMs: 0, endMs: 20_000 }], 1750);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0].startMs).toBe(2500); // only the first 2500ms of the caption counts as coverage
  });

  it("does not cap a caption shorter than the configured max dwell — no spurious gap introduced", () => {
    const shortCaption = caption("short", 0, 2000);
    const coverage = computeVisualCoverage({ broll: [], zoom: [], stickers: [], captions: [shortCaption] }, { maxCaptionCreditMs: 2500 });
    expect(coverage).toEqual([{ startMs: 0, endMs: 2000, kind: "caption" }]);
    expect(findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 2000 }], 1750)).toEqual([]);
  });

  it("does not cap broll/zoom/sticker intervals — only captions are subject to the credit cap", () => {
    const coverage = computeVisualCoverage(
      { broll: [{ startMs: 0, endMs: 10_000, trackHint: "broll", source: "stock", searchQuery: "x" }], zoom: [], stickers: [], captions: [] },
      { maxCaptionCreditMs: 2500 }
    );
    expect(coverage).toEqual([{ startMs: 0, endMs: 10_000, kind: "broll" }]);
  });
});
