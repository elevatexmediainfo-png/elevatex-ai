import { describe, expect, it } from "vitest";

import { resolveEditorSeekDelta } from "./keyboard-utils";

describe("resolveEditorSeekDelta", () => {
  it("uses frame-sized steps for plain left/right arrows", () => {
    const event = { key: "ArrowRight" } as KeyboardEvent;

    expect(resolveEditorSeekDelta(event, 100)).toEqual({ direction: 1, stepMs: 100 });
  });

  it("uses one-second steps for Shift+arrow shortcuts", () => {
    const event = { key: "ArrowLeft", shiftKey: true } as KeyboardEvent;

    expect(resolveEditorSeekDelta(event, 100)).toEqual({ direction: -1, stepMs: 1000 });
  });

  it("returns null for unrelated keys", () => {
    const event = { key: "a" } as KeyboardEvent;

    expect(resolveEditorSeekDelta(event, 100)).toBeNull();
  });
});
