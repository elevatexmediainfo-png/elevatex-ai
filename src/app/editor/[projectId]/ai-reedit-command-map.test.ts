import { describe, expect, it, vi } from "vitest";
import { mapReeditResponseToCommand } from "./ai-reedit-command-map";
import type { ClipCommandDeps, TransitionCommandDeps } from "./commands";
import type { ClipView, TransitionView } from "../types";
import type { ReeditClipResult } from "@/lib/video-editor/ai-reedit";

// Same framework-agnostic, fake-injected-deps style as commands.test.ts —
// this mapper is pure (no React/fetch), so it's tested the same way.
function makeClip(overrides: Partial<ClipView> = {}): ClipView {
  return {
    id: "clip-1",
    trackId: "track-1",
    projectId: "proj-1",
    assetId: "asset-1",
    startMs: 1000,
    durationMs: 3000,
    trimStartMs: 200,
    content: null,
    transform: null,
    groupId: null,
    ...overrides,
  };
}

function makeTransition(overrides: Partial<TransitionView> = {}): TransitionView {
  return {
    id: "transition-1",
    projectId: "proj-1",
    trackId: "track-1",
    clipAId: "clip-1",
    clipBId: "clip-2",
    type: "CROSSFADE",
    direction: null,
    durationMs: 500,
    easing: { type: "EASE_IN_OUT" },
    ...overrides,
  };
}

function makeDeps(): ClipCommandDeps {
  return {
    updateClip: vi.fn().mockResolvedValue({ clip: {} as ClipView, prunedTransitions: [] }),
    deleteClip: vi.fn().mockResolvedValue(undefined),
    addClip: vi.fn().mockResolvedValue({ clip: {} as ClipView }),
    splitClip: vi.fn(),
    rippleDeleteClip: vi.fn(),
    duplicateClip: vi.fn(),
    replaceClipSource: vi.fn().mockResolvedValue({ clip: {} as ClipView }),
    groupClips: vi.fn(),
    ungroupClips: vi.fn(),
    restoreTransition: vi.fn(),
  } as unknown as ClipCommandDeps;
}

function makeTransitionDeps(): TransitionCommandDeps {
  return {
    addTransition: vi.fn().mockResolvedValue({ transition: {} }),
    updateTransition: vi.fn(),
    removeTransition: vi.fn().mockResolvedValue(undefined),
  };
}

describe("mapReeditResponseToCommand", () => {
  it("cannot_do returns an error, no command", () => {
    const result: ReeditClipResult = { response: { action: "cannot_do", message: "This clip has no zoom to remove." } };
    const mapped = mapReeditResponseToCommand(result, makeClip(), [], makeDeps(), makeTransitionDeps());
    expect(mapped).toEqual({ error: "This clip has no zoom to remove." });
  });

  it("delete_clip maps to createDeleteClipCommand — execute() deletes the right clip", async () => {
    const clip = makeClip({ id: "clip-42" });
    const deps = makeDeps();
    const result: ReeditClipResult = { response: { action: "delete_clip" } };
    const mapped = mapReeditResponseToCommand(result, clip, [], deps, makeTransitionDeps());
    expect("command" in mapped).toBe(true);
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(deps.deleteClip).toHaveBeenCalledWith("clip-42");
    }
  });

  it("remove_effect(zoom) resets scale to 100 and clears keyframes, preserving other transform fields", async () => {
    const clip = makeClip({
      transform: { scale: { value: 150, keyframes: [{ id: "k1", timeMs: 0, value: 100 }] }, position: { value: { x: 5, y: 5 }, keyframes: null }, rotation: { value: 10, keyframes: null }, opacity: { value: 80, keyframes: null } } as unknown as ClipView["transform"],
    });
    const deps = makeDeps();
    const result: ReeditClipResult = { response: { action: "remove_effect", effect: "zoom" } };
    const mapped = mapReeditResponseToCommand(result, clip, [], deps, makeTransitionDeps());
    expect("command" in mapped).toBe(true);
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(deps.updateClip).toHaveBeenCalledWith({
        clipId: "clip-1",
        patch: {
          transform: expect.objectContaining({
            scale: { value: 100, keyframes: null },
            position: { value: { x: 5, y: 5 }, keyframes: null },
            rotation: { value: 10, keyframes: null },
            opacity: { value: 80, keyframes: null },
          }),
        },
      });
    }
  });

  it("remove_effect(transition_before) finds the transition ENDING at this clip and removes it", async () => {
    const clip = makeClip({ id: "clip-2" });
    const transitionDeps = makeTransitionDeps();
    const transition = makeTransition({ id: "t-before", clipAId: "clip-1", clipBId: "clip-2" });
    const result: ReeditClipResult = { response: { action: "remove_effect", effect: "transition_before" } };
    const mapped = mapReeditResponseToCommand(result, clip, [transition], makeDeps(), transitionDeps);
    expect("command" in mapped).toBe(true);
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(transitionDeps.removeTransition).toHaveBeenCalledWith("t-before");
    }
  });

  it("remove_effect(transition_after) finds the transition STARTING at this clip and removes it", async () => {
    const clip = makeClip({ id: "clip-1" });
    const transitionDeps = makeTransitionDeps();
    const transition = makeTransition({ id: "t-after", clipAId: "clip-1", clipBId: "clip-2" });
    const result: ReeditClipResult = { response: { action: "remove_effect", effect: "transition_after" } };
    const mapped = mapReeditResponseToCommand(result, clip, [transition], makeDeps(), transitionDeps);
    expect("command" in mapped).toBe(true);
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(transitionDeps.removeTransition).toHaveBeenCalledWith("t-after");
    }
  });

  it("remove_effect(transition_before) with no matching transition returns an error, not a crash", () => {
    const clip = makeClip({ id: "clip-2" });
    const result: ReeditClipResult = { response: { action: "remove_effect", effect: "transition_before" } };
    const mapped = mapReeditResponseToCommand(result, clip, [], makeDeps(), makeTransitionDeps());
    expect(mapped).toEqual({ error: "No transition found before this clip." });
  });

  it("change_asset with a resolved id maps to createReplaceClipSourceCommand", async () => {
    const clip = makeClip({ id: "clip-1", assetId: "old-asset" });
    const deps = makeDeps();
    const result: ReeditClipResult = { response: { action: "change_asset", searchQuery: "city skyline" }, resolvedAssetId: "new-asset-99" };
    const mapped = mapReeditResponseToCommand(result, clip, [], deps, makeTransitionDeps());
    expect("command" in mapped).toBe(true);
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(deps.replaceClipSource).toHaveBeenCalledWith({ clipId: "clip-1", assetId: "new-asset-99" });
    }
  });

  it("change_asset with NO resolved id (a search miss) returns the real resolutionNote as the error — never a forced placeholder", () => {
    const clip = makeClip();
    const result: ReeditClipResult = { response: { action: "change_asset", searchQuery: "an obscure query" }, resolutionNote: 'No stock results found for "an obscure query".' };
    const mapped = mapReeditResponseToCommand(result, clip, [], makeDeps(), makeTransitionDeps());
    expect(mapped).toEqual({ error: 'No stock results found for "an obscure query".' });
  });

  it("adjust_transform(scale) sets a static numeric value and clears any keyframes on that property", async () => {
    const clip = makeClip({ transform: { scale: { value: 100, keyframes: [{ id: "k1", timeMs: 0, value: 100 }] } } as unknown as ClipView["transform"] });
    const deps = makeDeps();
    const result: ReeditClipResult = { response: { action: "adjust_transform", property: "scale", value: 150 } };
    const mapped = mapReeditResponseToCommand(result, clip, [], deps, makeTransitionDeps());
    expect("command" in mapped).toBe(true);
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(deps.updateClip).toHaveBeenCalledWith({ clipId: "clip-1", patch: { transform: expect.objectContaining({ scale: { value: 150, keyframes: null } }) } });
    }
  });

  it("adjust_transform(position) sets the {x,y} value", async () => {
    const clip = makeClip();
    const deps = makeDeps();
    const result: ReeditClipResult = { response: { action: "adjust_transform", property: "position", value: { x: 10, y: -20 } } };
    const mapped = mapReeditResponseToCommand(result, clip, [], deps, makeTransitionDeps());
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(deps.updateClip).toHaveBeenCalledWith({ clipId: "clip-1", patch: { transform: expect.objectContaining({ position: { value: { x: 10, y: -20 }, keyframes: null } }) } });
    }
  });

  it("change_caption_style merges reveal fields into the clip's EXISTING content, not a full replacement", async () => {
    const clip = makeClip({ content: { text: "Hello world", reveal: { mode: "WORD", unitDurationMs: 150, style: "FADE", highlightColor: "#FFFFFF" } } as unknown as ClipView["content"] });
    const deps = makeDeps();
    const result: ReeditClipResult = { response: { action: "change_caption_style", reveal: { mode: "KARAOKE" } } };
    const mapped = mapReeditResponseToCommand(result, clip, [], deps, makeTransitionDeps());
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(deps.updateClip).toHaveBeenCalledWith({
        clipId: "clip-1",
        patch: { content: expect.objectContaining({ text: "Hello world", reveal: { mode: "KARAOKE", unitDurationMs: 150, style: "FADE", highlightColor: "#FFFFFF" } }) },
      });
    }
  });

  it("change_caption_style with only color/fontSize leaves reveal untouched", async () => {
    const clip = makeClip({ content: { text: "Hi", reveal: { mode: "WORD", unitDurationMs: 150, style: "FADE", highlightColor: "#FFFFFF" } } as unknown as ClipView["content"] });
    const deps = makeDeps();
    const result: ReeditClipResult = { response: { action: "change_caption_style", color: "#FF0000", fontSize: 60 } };
    const mapped = mapReeditResponseToCommand(result, clip, [], deps, makeTransitionDeps());
    if ("command" in mapped) {
      await mapped.command.execute();
      expect(deps.updateClip).toHaveBeenCalledWith({
        clipId: "clip-1",
        patch: { content: expect.objectContaining({ text: "Hi", color: "#FF0000", fontSize: 60, reveal: { mode: "WORD", unitDurationMs: 150, style: "FADE", highlightColor: "#FFFFFF" } }) },
      });
    }
  });
});
