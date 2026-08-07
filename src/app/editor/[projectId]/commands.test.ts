import { describe, expect, it, vi } from "vitest";
import {
  createAddTrackAndClipCommand,
  createAddTrackWithClipsCommand,
  createCaptionsTrackCommand,
  createCompositeCommand,
  createDeleteClipCommand,
  createMoveClipCommand,
  createOverlayTrackCommand,
  createRippleDeleteCommand,
  createSceneRemovalCommand,
  createTrimClipCommand,
  type AddTrackAndClipDeps,
  type ClipCommandDeps,
  type EditorCommand,
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

// Fix (2026-08-06, FIX 6 — "composite timeline updates must become
// transactional; if one command fails, rollback everything"). Uses plain
// hand-built EditorCommand objects (not real command constructors) to
// exercise createCompositeCommand's own rollback mechanics in isolation.
describe("createCompositeCommand — transactional rollback (FIX 6)", () => {
  it("rolls back every already-succeeded sibling, in reverse order, when one sibling fails", async () => {
    const order: string[] = [];
    const commandA: EditorCommand = {
      label: "A",
      execute: async () => {
        order.push("execute-A");
      },
      undo: async () => {
        order.push("undo-A");
      },
    };
    const commandB: EditorCommand = {
      label: "B",
      execute: async () => {
        order.push("execute-B");
        throw new Error("B failed");
      },
      undo: async () => {
        order.push("undo-B");
      },
    };
    const commandC: EditorCommand = {
      label: "C",
      execute: async () => {
        order.push("execute-C");
      },
      undo: async () => {
        order.push("undo-C");
      },
    };
    const composite = createCompositeCommand("Test Composite", [commandA, commandB, commandC]);

    await expect(composite.execute()).rejects.toThrow(/failed and was rolled back/);

    // A and C succeeded, B failed — only A and C get rolled back; B never
    // gets an undo() call (it never succeeded in the first place).
    expect(order).toContain("undo-A");
    expect(order).toContain("undo-C");
    expect(order).not.toContain("undo-B");
    // Reverse order: C (declared after A) is rolled back before A.
    expect(order.indexOf("undo-C")).toBeLessThan(order.indexOf("undo-A"));
  });

  it("still rolls back every succeeded sibling even when one sibling's OWN undo() also throws mid-rollback", async () => {
    const order: string[] = [];
    const commandA: EditorCommand = {
      label: "A",
      execute: async () => {
        order.push("execute-A");
      },
      undo: async () => {
        order.push("undo-A-attempted");
        throw new Error("undo-A also failed");
      },
    };
    const commandB: EditorCommand = { label: "B", execute: async () => { throw new Error("B failed"); }, undo: async () => {} };
    const commandC: EditorCommand = {
      label: "C",
      execute: async () => {
        order.push("execute-C");
      },
      undo: async () => {
        order.push("undo-C");
      },
    };
    const composite = createCompositeCommand("Test Composite", [commandA, commandB, commandC]);

    // The ORIGINAL failure (B) is what surfaces to the caller, not A's
    // rollback failure — a rollback-time error must never mask why the
    // whole thing failed in the first place.
    await expect(composite.execute()).rejects.toThrow(/B failed/);
    expect(order).toContain("undo-A-attempted");
    expect(order).toContain("undo-C"); // C's rollback still ran despite A's own undo() throwing
  });

  it("never calls undo() on anything when every sibling succeeds (unchanged happy path)", async () => {
    const commandA = { label: "A", execute: vi.fn().mockResolvedValue(undefined), undo: vi.fn().mockResolvedValue(undefined) };
    const commandB = { label: "B", execute: vi.fn().mockResolvedValue(undefined), undo: vi.fn().mockResolvedValue(undefined) };
    const composite = createCompositeCommand("Test Composite", [commandA, commandB]);

    await composite.execute();

    expect(commandA.execute).toHaveBeenCalledTimes(1);
    expect(commandB.execute).toHaveBeenCalledTimes(1);
    expect(commandA.undo).not.toHaveBeenCalled();
    expect(commandB.undo).not.toHaveBeenCalled();
  });

  it("includes every failed sibling's own message and the failure count when multiple fail simultaneously", async () => {
    const commandA: EditorCommand = { label: "A", execute: async () => {}, undo: async () => {} };
    const commandB: EditorCommand = {
      label: "B",
      execute: async () => {
        throw new Error("B broke");
      },
      undo: async () => {},
    };
    const commandD: EditorCommand = {
      label: "D",
      execute: async () => {
        throw new Error("D broke");
      },
      undo: async () => {},
    };
    const composite = createCompositeCommand("Test Composite", [commandA, commandB, commandD]);

    let caught: Error | null = null;
    try {
      await composite.execute();
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain("B broke");
    expect(caught!.message).toContain("D broke");
    expect(caught!.message).toContain("2/3");
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

// PRODUCTION INVESTIGATION (2026-08-07) — "the generated AI Auto-Edit is
// almost identical to the original video." Real, reproduced bug found
// while tracing Timeline Apply: createAddTrackWithClipsCommand and (the
// now-removed) createCaptionsAboveOverlayCommand both accumulated created
// clip ids in a LOCAL loop variable and only assigned it to the outer
// (undo-tracking) variable AFTER the whole loop finished. If addClip threw
// partway through a batch (item 5 of 20, say — any transient network/
// validation failure), every item BEFORE the failure was already
// persisted server-side, but the outer variable never learned about them
// — so this command's own undo() had nothing to clean up, AND the
// top-level createCompositeCommand's rollback loop only called undo() on
// commands that RESOLVED (this one REJECTED), so it was skipped there
// too. The partially-created rows were orphaned forever, silently — while
// every OTHER sibling command in the same composite that DID fully
// succeed (e.g. scene removal, zoom) got rolled back, since the composite
// treated any single rejection as cause to undo everything else.
//
// FIXED (2026-08, Task E, requirements 1 and 3):
//   1. createAddTrackWithClipsCommand and createSceneRemovalCommand now
//      push directly to the outer undo-tracking variable INSIDE their own
//      loops, the moment each item's addClip/segment-create resolves —
//      undo() always has an accurate record of every item that actually
//      landed, even after a mid-batch throw.
//   2. createCaptionsAboveOverlayCommand no longer exists.
//      createCaptionsTrackCommand and createOverlayTrackCommand are two
//      fully INDEPENDENT commands — a captions failure can no longer
//      prevent overlay(b-roll/stickers) from running, and vice versa.
//   3. The top-level orchestrator (ai-auto-edit-panel.tsx's handleApply)
//      no longer wraps every section into ONE createCompositeCommand — it
//      runs each module independently and explicitly calls THAT module's
//      own undo() on failure, so a fully-successful sibling module is
//      never touched by an unrelated module's failure.
describe("FIX VERIFICATION — incremental clip tracking + module independence (2026-08, Task E)", () => {
  function makeFlakyBatchDeps(failAtCallIndex: number) {
    let nextTrackId = 1;
    let addClipCallCount = 0;
    const createdClipIds: string[] = [];
    return {
      addTrack: vi.fn().mockImplementation(async (input) => ({ track: { id: `track-${nextTrackId++}`, order: nextTrackId, ...input } as unknown as TrackView })),
      removeTrack: vi.fn().mockResolvedValue(undefined),
      addClip: vi.fn().mockImplementation(async (patch) => {
        const callIndex = addClipCallCount++;
        if (callIndex === failAtCallIndex) {
          throw new Error(`Simulated transient failure on item ${callIndex} (e.g. a real network blip or validation mismatch)`);
        }
        const id = `clip-${callIndex}`;
        createdClipIds.push(id);
        return { clip: { id, ...patch } as unknown as ClipView };
      }),
      deleteClip: vi.fn().mockResolvedValue(undefined),
      updateClip: vi.fn(),
      splitClip: vi.fn(),
      rippleDeleteClip: vi.fn(),
      duplicateClip: vi.fn(),
      replaceClipSource: vi.fn(),
      groupClips: vi.fn(),
      ungroupClips: vi.fn(),
      __createdClipIds: createdClipIds, // test-only escape hatch to see what's ACTUALLY in "the database"
    } as unknown as AddTrackAndClipDeps & { __createdClipIds: string[] };
  }

  it("createAddTrackWithClipsCommand: undo() now cleans up EVERY clip that actually landed before the failure, not zero", async () => {
    const deps = makeFlakyBatchDeps(4); // 0-indexed — the 5th addClip call fails
    const clipInputs = Array.from({ length: 5 }, (_, i) => ({ startMs: i * 1000, durationMs: 900, content: { text: `caption ${i}` } }));
    const command = createAddTrackWithClipsCommand(deps, { kind: "SUBTITLE" }, clipInputs);

    await expect(command.execute()).rejects.toThrow("Simulated transient failure");

    // REAL EVIDENCE: 4 captions genuinely landed server-side — deps.addClip
    // was called 5 times and 4 of them actually created a row.
    expect(deps.addClip).toHaveBeenCalledTimes(5);
    expect((deps as unknown as { __createdClipIds: string[] }).__createdClipIds).toHaveLength(4);

    // FIXED: undo() now deletes all 4 real, persisted clips (previously
    // zero) AND the track — nothing orphaned.
    await command.undo();
    expect(deps.deleteClip).toHaveBeenCalledTimes(4);
    for (const id of (deps as unknown as { __createdClipIds: string[] }).__createdClipIds) {
      expect(deps.deleteClip).toHaveBeenCalledWith(id);
    }
    expect(deps.removeTrack).toHaveBeenCalledWith("track-1");
  });

  it("createSceneRemovalCommand: undo() cleans up every surviving segment already created before a mid-batch failure, and never duplicates the original clip", async () => {
    const deps = makeFlakyBatchDeps(2); // 3rd segment create fails
    const originalClip: ClipView = {
      id: "original-clip",
      trackId: "track-1",
      assetId: "asset-1",
      startMs: 0,
      durationMs: 5000,
      trimStartMs: 0,
      content: null,
      transform: null,
    } as unknown as ClipView;
    const survivingSegments = Array.from({ length: 4 }, (_, i) => ({ startMs: i * 1000, durationMs: 900, trimStartMs: i * 1000 }));

    const command = createSceneRemovalCommand(deps, originalClip, survivingSegments, []);

    await expect(command.execute()).rejects.toThrow("Simulated transient failure");
    // 2 segments genuinely landed before the 3rd failed.
    expect((deps as unknown as { __createdClipIds: string[] }).__createdClipIds).toHaveLength(2);

    await command.undo();
    // FIXED: the 2 real surviving-segment clips get deleted, on top of the
    // 1 deleteClip execute() itself already made for the original clip
    // (deleted up front, before the segment loop even started) = 3 total.
    expect(deps.deleteClip).toHaveBeenCalledTimes(1 /* execute()'s own delete of the original */ + 2 /* undo's cleanup of the 2 real segments */);
    // ...and the original clip IS recreated by undo() (it really was
    // deleted at the top of execute()) — exactly once, on top of
    // execute()'s own 3 addClip attempts (2 succeeded, the 3rd threw) —
    // never duplicated.
    expect(deps.addClip).toHaveBeenCalledTimes(3 /* execute()'s 3 segment attempts */ + 1 /* undo's own restore of the original */);
  });

  it("createCaptionsTrackCommand and createOverlayTrackCommand are genuinely independent commands — one's failure never touches the other's own deps", async () => {
    const captionsDeps = makeFlakyBatchDeps(0); // fails immediately
    const overlayDeps = makeFlakyBatchDeps(-1); // never fails
    const captionsCommand = createCaptionsTrackCommand(captionsDeps, [{ startMs: 0, durationMs: 900, content: { text: "hi" } }]);
    const overlayCommand = createOverlayTrackCommand(overlayDeps, [{ startMs: 0, durationMs: 900, assetId: "broll-1" }]);

    await expect(captionsCommand.execute()).rejects.toThrow("Simulated transient failure");
    // Overlay runs completely independently on its OWN deps, unaffected by
    // captions having just failed — no shared state, no shared command.
    await expect(overlayCommand.execute()).resolves.toBeUndefined();
    expect(overlayDeps.addTrack).toHaveBeenCalledWith({ kind: "OVERLAY", insertBelowOrder: undefined });
    expect((overlayDeps as unknown as { __createdClipIds: string[] }).__createdClipIds).toHaveLength(1);
  });

  it("orchestration-level: a fully-successful sibling module is NEVER touched when an unrelated module fails and self-rolls-back — no shared composite anymore", async () => {
    // Simulates ai-auto-edit-panel.tsx's handleApply own per-module loop:
    // each module gets its own independent try/catch and self-rollback,
    // never a shared createCompositeCommand.
    const sceneRemovalUndo = vi.fn().mockResolvedValue(undefined);
    const sceneRemovalCommand: EditorCommand = {
      label: "AI Scene Removal",
      execute: vi.fn().mockResolvedValue(undefined), // the cuts genuinely applied
      undo: sceneRemovalUndo,
    };

    const captionsDeps = makeFlakyBatchDeps(2);
    const captionInputs = Array.from({ length: 4 }, (_, i) => ({ startMs: i * 1000, durationMs: 900, content: { text: `caption ${i}` } }));
    const captionsCommand = createCaptionsTrackCommand(captionsDeps, captionInputs);

    const modules: { module: string; command: EditorCommand }[] = [
      { module: "sceneRemoval", command: sceneRemovalCommand },
      { module: "captions", command: captionsCommand },
    ];
    const failedModules: string[] = [];
    for (const { module, command } of modules) {
      try {
        await command.execute();
      } catch {
        await command.undo();
        failedModules.push(module);
      }
    }

    expect(failedModules).toEqual(["captions"]);
    // FIXED: scene removal's undo() is NEVER called — its success is
    // completely unaffected by captions' failure (previously: the shared
    // composite rolled it back regardless).
    expect(sceneRemovalUndo).not.toHaveBeenCalled();
    // FIXED: captions' OWN partial work (2 real clips + the track) IS
    // fully cleaned up via its own explicit self-rollback undo() call
    // (previously: undo() was never even invoked on a rejected command by
    // the old composite's rollback loop, so this never happened at all).
    expect((captionsDeps as unknown as { __createdClipIds: string[] }).__createdClipIds).toHaveLength(2);
    expect(captionsDeps.deleteClip).toHaveBeenCalledTimes(2);
    expect(captionsDeps.removeTrack).toHaveBeenCalledWith("track-1");
  });
});
