import { describe, expect, it } from "vitest";
import { countRepeats, createEmptyVarietyLedger, isRepeat, recordManyUsages, recordUsage, scoreVisualVariety, zoomStyleBucket } from "./variety-ledger";

describe("variety-ledger", () => {
  it("createEmptyVarietyLedger starts with every category empty", () => {
    const ledger = createEmptyVarietyLedger();
    expect(ledger).toEqual({ zoomStyles: [], transitionTypes: [], stickerQueries: [], captionAnimations: [], sfxQueries: [], brollStyles: [] });
  });

  it("recordUsage adds a new value, case-insensitively deduping against an existing one", () => {
    let ledger = createEmptyVarietyLedger();
    ledger = recordUsage(ledger, "transitionTypes", "CROSSFADE");
    ledger = recordUsage(ledger, "transitionTypes", "crossfade"); // same value, different case
    expect(ledger.transitionTypes).toEqual(["CROSSFADE"]);
  });

  it("recordUsage ignores an empty string", () => {
    const ledger = recordUsage(createEmptyVarietyLedger(), "sfxQueries", "");
    expect(ledger.sfxQueries).toEqual([]);
  });

  it("isRepeat is case-insensitive and category-scoped", () => {
    const ledger = recordUsage(createEmptyVarietyLedger(), "stickerQueries", "Heart Icon");
    expect(isRepeat(ledger, "stickerQueries", "heart icon")).toBe(true);
    expect(isRepeat(ledger, "stickerQueries", "money chart")).toBe(false);
    expect(isRepeat(ledger, "brollStyles", "heart icon")).toBe(false); // different category
  });

  it("recordManyUsages folds a whole array in, deduping as it goes", () => {
    const ledger = recordManyUsages(createEmptyVarietyLedger(), "zoomStyles", ["subtle", "subtle", "dramatic"]);
    expect(ledger.zoomStyles).toEqual(["subtle", "dramatic"]);
  });

  it("countRepeats counts extra occurrences beyond the first, across all categories", () => {
    let ledger = createEmptyVarietyLedger();
    ledger = { ...ledger, zoomStyles: ["subtle", "subtle", "subtle"], transitionTypes: ["CROSSFADE", "WIPE"] };
    // "subtle" appears 3x -> 2 extra occurrences count as repeats; transitions have no repeats.
    expect(countRepeats(ledger)).toBe(2);
  });

  it("scoreVisualVariety is 100 with zero repeats and degrades per repeat", () => {
    expect(scoreVisualVariety(createEmptyVarietyLedger())).toBe(100);
    const withOneRepeat = { ...createEmptyVarietyLedger(), zoomStyles: ["subtle", "subtle"] };
    expect(scoreVisualVariety(withOneRepeat)).toBe(85);
    const withManyRepeats = { ...createEmptyVarietyLedger(), zoomStyles: Array.from({ length: 10 }, () => "subtle") };
    expect(scoreVisualVariety(withManyRepeats)).toBe(0); // floors at 0, never negative
  });

  it("zoomStyleBucket buckets subtle/moderate/dramatic by scale delta", () => {
    expect(zoomStyleBucket(100, 105)).toBe("subtle");
    expect(zoomStyleBucket(100, 112)).toBe("moderate");
    expect(zoomStyleBucket(100, 130)).toBe("dramatic");
  });
});
