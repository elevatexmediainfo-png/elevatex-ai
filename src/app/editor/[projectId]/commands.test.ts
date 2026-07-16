import { describe, expect, it, vi } from "vitest";
import {
  createAddTrackAndClipCommand,
  createCompositeCommand,
  createDeleteClipCommand,
  createMoveClipCommand,
  createRippleDeleteCommand,
  createTrimClipCommand,
  type AddTrackAndClipDeps,
  type ClipCommandDeps,
} from "./commands";
import type { ClipView, TrackView, TransitionView } from "../types";

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

// commands.ts is framework-agnostic and dependency-injected (see its own
// header comment) — same fake-deps style as track-stacking.test.ts, no DOM
// or store needed to exercise execute()/undo().
function makeFakeDeps(): ClipCommandDeps & { addClipCalls: unknown[] } {
  const addClipCalls: unknown[] = [];
  return {
    addClipCalls,
    // Defaults to "nothing was pruned" — the common case every pre-existing
    // test here exercises. Tests for the prunedTransitions-restore fix
    // below override this per-call via mockResolvedValueOnce.
    updateClip: vi.fn().mockResolvedValue({ clip: {} as ClipView, prunedTransitions: [] }),
    deleteClip: vi.fn().mockResolvedValue(undefined),
    addClip: vi.fn().mockImplementation(async (patch) => {
      addClipCalls.push(patch);
      return { clip: { id: "new-id", ...patch } as unknown as ClipView };
    }),
    splitClip: vi.fn(),
    rippleDeleteClip: vi.fn(),
    duplicateClip: vi.fn(),
    replaceClipSource: vi.fn(),
    groupClips: vi.fn(),
    ungroupClips: vi.fn(),
    restoreTransition: vi.fn().mockResolvedValue({ transition: {} }),
  } as unknown as ClipCommandDeps & { addClipCalls: unknown[] };
}

function makeClip(overrides: Partial<ClipView> = {}): ClipView {
  return {
    id: "clip-1",
    trackId: "track-1",
    projectId: "proj-1",
    assetId: "asset-1",
    startMs: 1000,
    durationMs: 3000,
    trimStartMs: 200,
    content: { text: "Hello" } as unknown as ClipView["content"],
    transform: { scale: { value: 120, keyframes: null } } as unknown as ClipView["transform"],
    groupId: null,
    ...overrides,
  };
}

// Known Issue #17 fix — deleting a clip used to bypass the Command pattern
// entirely (every call site called deps.deleteClip directly), making it the
// one Timeline mutation with no undo. These tests pin the fix's actual
// contract: execute() deletes, undo() recreates the exact pre-delete
// snapshot (span/content/transform), consistent with the same best-effort
// "new server id" caveat every other delete-type command in this file
// already documents (Split/RippleDelete/Group).
describe("createDeleteClipCommand", () => {
  it("execute() deletes the clip by id", async () => {
    const deps = makeFakeDeps();
    const clip = makeClip();
    const command = createDeleteClipCommand(deps, clip);

    await command.execute();

    expect(deps.deleteClip).toHaveBeenCalledWith("clip-1");
    expect(deps.addClip).not.toHaveBeenCalled();
  });

  it("undo() recreates the clip with its exact pre-delete span, content, and transform", async () => {
    const deps = makeFakeDeps();
    const clip = makeClip();
    const command = createDeleteClipCommand(deps, clip);

    await command.execute();
    await command.undo();

    expect(deps.addClip).toHaveBeenCalledWith({
      trackId: "track-1",
      assetId: "asset-1",
      startMs: 1000,
      durationMs: 3000,
      trimStartMs: 200,
      content: { text: "Hello" },
      transform: { scale: { value: 120, keyframes: null } },
    });
  });

  it("undo() omits assetId/content/transform when the original clip had none (a TEXT/SUBTITLE-style no-asset clip)", async () => {
    const deps = makeFakeDeps();
    const clip = makeClip({ assetId: null, content: null, transform: null });
    const command = createDeleteClipCommand(deps, clip);

    await command.undo();

    expect(deps.addClip).toHaveBeenCalledWith({
      trackId: "track-1",
      assetId: undefined,
      startMs: 1000,
      durationMs: 3000,
      trimStartMs: 200,
      content: undefined,
      transform: undefined,
    });
  });

  it("execute() after undo() (redo) targets the id undo() actually recreated, not the original pre-delete id", async () => {
    // Regression test for a real bug (2026-07-15): undo() recreates the
    // clip via addClip, which returns a NEW server-generated id — the
    // original id is gone for good. A subsequent redo (execute() called
    // again) that still targeted the original id would silently delete
    // nothing, since that id no longer exists server-side.
    const deps = makeFakeDeps();
    const clip = makeClip();
    const command = createDeleteClipCommand(deps, clip);

    await command.execute();
    expect(deps.deleteClip).toHaveBeenNthCalledWith(1, "clip-1");

    await command.undo();
    await command.execute();
    expect(deps.deleteClip).toHaveBeenNthCalledWith(2, "new-id");
  });

  it("a multi-clip delete wraps each clip's command in one composite, so undo restores every clip in one call", async () => {
    const deps = makeFakeDeps();
    const clipA = makeClip({ id: "clip-a", startMs: 0 });
    const clipB = makeClip({ id: "clip-b", startMs: 5000 });
    const command = createCompositeCommand("Delete Clips", [
      createDeleteClipCommand(deps, clipA),
      createDeleteClipCommand(deps, clipB),
    ]);

    await command.execute();
    expect(deps.deleteClip).toHaveBeenCalledWith("clip-a");
    expect(deps.deleteClip).toHaveBeenCalledWith("clip-b");

    await command.undo();
    expect(deps.addClip).toHaveBeenCalledTimes(2);
    const restoredStartTimes = (deps as unknown as { addClipCalls: { startMs: number }[] }).addClipCalls.map((c) => c.startMs);
    expect(restoredStartTimes.sort()).toEqual([0, 5000]);
  });
});

describe("createRippleDeleteCommand", () => {
  it("execute() after undo() (redo) targets the id undo() actually recreated, not the original pre-delete id", async () => {
    // Same regression as createDeleteClipCommand above, for the sibling
    // command that had the identical bug.
    const deps = makeFakeDeps();
    const clipA = makeClip({ id: "clip-a", startMs: 0 });
    const clipB = makeClip({ id: "clip-b", startMs: 5000 });
    const command = createRippleDeleteCommand(deps, clipA, [clipA, clipB]);

    await command.execute();
    expect(deps.rippleDeleteClip).toHaveBeenNthCalledWith(1, "clip-a");

    await command.undo();
    await command.execute();
    expect(deps.rippleDeleteClip).toHaveBeenNthCalledWith(2, "new-id");
  });
});

describe("createMoveClipCommand", () => {
  it("without a track arg, only patches startMs — same-track move is unaffected by the cross-track addition", async () => {
    const deps = makeFakeDeps();
    const command = createMoveClipCommand(deps, "clip-1", 1000, 4000);

    await command.execute();
    expect(deps.updateClip).toHaveBeenNthCalledWith(1, { clipId: "clip-1", patch: { startMs: 4000 } });

    await command.undo();
    expect(deps.updateClip).toHaveBeenNthCalledWith(2, { clipId: "clip-1", patch: { startMs: 1000 } });
  });

  it("with a track arg, patches both startMs and trackId together, and undo reverses both", async () => {
    const deps = makeFakeDeps();
    const command = createMoveClipCommand(deps, "clip-1", 1000, 4000, { previousTrackId: "track-a", newTrackId: "track-b" });

    await command.execute();
    expect(deps.updateClip).toHaveBeenNthCalledWith(1, { clipId: "clip-1", patch: { startMs: 4000, trackId: "track-b" } });

    await command.undo();
    expect(deps.updateClip).toHaveBeenNthCalledWith(2, { clipId: "clip-1", patch: { startMs: 1000, trackId: "track-a" } });
  });

  // Full Regression Pass bug fix (2026-07-16) — pins the actual regression:
  // a move that breaks a transition's adjacency causes the server to
  // auto-prune it (updateClip's own documented side effect); undo used to
  // only repositon the clip back, silently leaving the transition gone.
  it("undo() re-creates a transition the move's own execute() pruned as a side effect", async () => {
    const deps = makeFakeDeps();
    const pruned = makeTransition();
    (deps.updateClip as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ clip: {} as ClipView, prunedTransitions: [pruned] });
    const command = createMoveClipCommand(deps, "clip-1", 1000, 4000);

    await command.execute();
    expect(deps.restoreTransition).not.toHaveBeenCalled();

    await command.undo();
    expect(deps.restoreTransition).toHaveBeenCalledWith({
      trackId: "track-1",
      clipAId: "clip-1",
      clipBId: "clip-2",
      type: "CROSSFADE",
      direction: undefined,
      durationMs: 500,
      easing: { type: "EASE_IN_OUT" },
    });
  });

  it("undo() restores nothing when execute() pruned nothing (the common case)", async () => {
    const deps = makeFakeDeps();
    const command = createMoveClipCommand(deps, "clip-1", 1000, 4000);

    await command.execute();
    await command.undo();

    expect(deps.restoreTransition).not.toHaveBeenCalled();
  });

  it("undo() re-creating a transition is best-effort — one restore failing doesn't throw or block the position revert", async () => {
    const deps = makeFakeDeps();
    (deps.updateClip as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ clip: {} as ClipView, prunedTransitions: [makeTransition()] });
    (deps.restoreTransition as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("clips no longer adjacent"));
    const command = createMoveClipCommand(deps, "clip-1", 1000, 4000);

    await command.execute();
    await expect(command.undo()).resolves.toBeUndefined();
    expect(deps.updateClip).toHaveBeenNthCalledWith(2, { clipId: "clip-1", patch: { startMs: 1000 } });
  });

  it("redo (a second execute()) captures a FRESH prune list rather than reusing the first one", async () => {
    const deps = makeFakeDeps();
    const firstPrune = makeTransition({ id: "t1" });
    const secondPrune = makeTransition({ id: "t2", clipAId: "clip-3", clipBId: "clip-4" });
    (deps.updateClip as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ clip: {} as ClipView, prunedTransitions: [firstPrune] })
      .mockResolvedValueOnce({ clip: {} as ClipView, prunedTransitions: [] }) // undo's own updateClip call
      .mockResolvedValueOnce({ clip: {} as ClipView, prunedTransitions: [secondPrune] }); // redo
    const command = createMoveClipCommand(deps, "clip-1", 1000, 4000);

    await command.execute();
    await command.undo();
    await command.execute(); // redo
    await command.undo();

    expect(deps.restoreTransition).toHaveBeenNthCalledWith(1, expect.objectContaining({ clipAId: "clip-1", clipBId: "clip-2" }));
    expect(deps.restoreTransition).toHaveBeenNthCalledWith(2, expect.objectContaining({ clipAId: "clip-3", clipBId: "clip-4" }));
  });
});

describe("createTrimClipCommand", () => {
  const previous = { startMs: 1000, durationMs: 3000, trimStartMs: 200 };
  const next = { startMs: 1000, durationMs: 2000, trimStartMs: 200 };

  it("execute() patches to the new span, undo() restores the previous span", async () => {
    const deps = makeFakeDeps();
    const command = createTrimClipCommand(deps, "clip-1", previous, next);

    await command.execute();
    expect(deps.updateClip).toHaveBeenNthCalledWith(1, { clipId: "clip-1", patch: next });

    await command.undo();
    expect(deps.updateClip).toHaveBeenNthCalledWith(2, { clipId: "clip-1", patch: previous });
  });

  // Same fix, same root cause as createMoveClipCommand above — a trim can
  // invalidate a transition on the shrunk edge exactly the same way a move
  // can, through the identical updateClip prune side effect.
  it("undo() re-creates a transition the trim's own execute() pruned as a side effect", async () => {
    const deps = makeFakeDeps();
    const pruned = makeTransition();
    (deps.updateClip as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ clip: {} as ClipView, prunedTransitions: [pruned] });
    const command = createTrimClipCommand(deps, "clip-1", previous, next);

    await command.execute();
    await command.undo();

    expect(deps.restoreTransition).toHaveBeenCalledWith(
      expect.objectContaining({ clipAId: "clip-1", clipBId: "clip-2", type: "CROSSFADE", durationMs: 500 })
    );
  });
});

function makeFakeAddTrackDeps(): AddTrackAndClipDeps & { addClipCalls: unknown[] } {
  let nextTrackId = 1;
  const addClipCalls: unknown[] = [];
  return {
    addClipCalls,
    updateClip: vi.fn(),
    deleteClip: vi.fn().mockResolvedValue(undefined),
    addClip: vi.fn().mockImplementation(async (patch) => {
      addClipCalls.push(patch);
      return { clip: { id: "new-clip-id", ...patch } as unknown as ClipView };
    }),
    splitClip: vi.fn(),
    rippleDeleteClip: vi.fn(),
    duplicateClip: vi.fn(),
    replaceClipSource: vi.fn(),
    groupClips: vi.fn(),
    ungroupClips: vi.fn(),
    addTrack: vi.fn().mockImplementation(async (input) => ({ track: { id: `track-${nextTrackId++}`, ...input } as unknown as TrackView })),
    removeTrack: vi.fn().mockResolvedValue(undefined),
  } as unknown as AddTrackAndClipDeps & { addClipCalls: unknown[] };
}

// Smart track creation on drop — dropping onto empty Timeline space with no
// suitable existing track creates a track AND a clip on it as one gesture.
// These tests pin that both server-side creates happen in the right order
// (the clip's trackId must be the just-created track's real id, not known
// until addTrack() resolves) and that undo reverses both, best-effort, same
// as every other create-type command in this file.
describe("createAddTrackAndClipCommand", () => {
  it("execute() creates the track first, then adds the clip using that track's real id", async () => {
    const deps = makeFakeAddTrackDeps();
    const command = createAddTrackAndClipCommand(deps, { kind: "OVERLAY" }, { assetId: "asset-1", startMs: 2000, durationMs: 3000 });

    await command.execute();

    expect(deps.addTrack).toHaveBeenCalledWith({ kind: "OVERLAY" });
    expect(deps.addClip).toHaveBeenCalledWith({ assetId: "asset-1", startMs: 2000, durationMs: 3000, trackId: "track-1" });
  });

  it("passes audioSubtype through to addTrack when given", async () => {
    const deps = makeFakeAddTrackDeps();
    const command = createAddTrackAndClipCommand(deps, { kind: "AUDIO", audioSubtype: "MUSIC" }, { assetId: "asset-1", startMs: 0, durationMs: 1000 });

    await command.execute();

    expect(deps.addTrack).toHaveBeenCalledWith({ kind: "AUDIO", audioSubtype: "MUSIC" });
  });

  it("undo() removes the created clip, then the created track", async () => {
    const deps = makeFakeAddTrackDeps();
    const command = createAddTrackAndClipCommand(deps, { kind: "VIDEO" }, { assetId: "asset-1", startMs: 0, durationMs: 4000 });

    await command.execute();
    await command.undo();

    expect(deps.deleteClip).toHaveBeenCalledWith("new-clip-id");
    expect(deps.removeTrack).toHaveBeenCalledWith("track-1");
  });

  it("undo() before execute() is a safe no-op (never called without a prior execute in practice, but shouldn't throw)", async () => {
    const deps = makeFakeAddTrackDeps();
    const command = createAddTrackAndClipCommand(deps, { kind: "TEXT" }, { startMs: 0, durationMs: 1000 });

    await expect(command.undo()).resolves.toBeUndefined();
    expect(deps.deleteClip).not.toHaveBeenCalled();
    expect(deps.removeTrack).not.toHaveBeenCalled();
  });
});
