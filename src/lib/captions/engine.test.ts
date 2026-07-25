import { describe, expect, it } from "vitest";

import { generateWordTimings } from "./engine";

describe("generateWordTimings", () => {
  it("returns no words for empty/whitespace-only text", () => {
    expect(generateWordTimings("", 5000)).toEqual([]);
    expect(generateWordTimings("   ", 5000)).toEqual([]);
  });

  it("gives a single word the full duration (floored to the minimum)", () => {
    const words = generateWordTimings("Hello", 5000);
    expect(words).toEqual([{ text: "Hello", startMs: 0, endMs: 5000 }]);
  });

  it("floors a single word's duration at minWordMs even if shorter than that", () => {
    const words = generateWordTimings("Hi", 50, 150);
    expect(words).toEqual([{ text: "Hi", startMs: 0, endMs: 150 }]);
  });

  it("splits multiple words proportional to character length, covering the full duration with no gaps", () => {
    const words = generateWordTimings("a bb ccc", 6000, 0);
    expect(words).toHaveLength(3);
    expect(words[0].startMs).toBe(0);
    expect(words[words.length - 1].endMs).toBe(6000);
    // Each word's end is the next word's start — no gaps, no overlaps.
    for (let i = 1; i < words.length; i++) {
      expect(words[i].startMs).toBe(words[i - 1].endMs);
    }
  });

  it("gives every word at least minWordMs even when the total duration is tiny", () => {
    const words = generateWordTimings("one two three", 10, 150);
    for (const w of words) {
      expect(w.endMs - w.startMs).toBeGreaterThanOrEqual(150);
    }
  });

  it("collapses repeated whitespace and ignores empty tokens", () => {
    const words = generateWordTimings("  one   two  ", 2000);
    expect(words.map((w) => w.text)).toEqual(["one", "two"]);
  });
});
