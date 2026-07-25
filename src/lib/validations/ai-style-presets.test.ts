import { describe, expect, it } from "vitest";
import { AI_STYLE_PRESETS } from "./ai-style-presets";

// Phase 12 Module 8 — cheap guards against a copy-paste mistake in this
// data table: duplicate ids would silently break the picker's `<option
// key>`, and losing either of the two Module 4 live-proven exact strings
// would break the already-established reveal-mode distinction (WORD/POP
// vs NONE) without any test noticing.
describe("AI_STYLE_PRESETS", () => {
  it("has no duplicate ids", () => {
    const ids = AI_STYLE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate values (each option must produce genuinely different reasoning-prompt text)", () => {
    const values = AI_STYLE_PRESETS.map((p) => p.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("still carries the two exact strings Module 4 live-proved produce distinct reveal-mode output", () => {
    const values = AI_STYLE_PRESETS.map((p) => p.value);
    expect(values).toContain("punchy energetic shorts");
    expect(values).toContain("calm professional documentary");
  });
});
