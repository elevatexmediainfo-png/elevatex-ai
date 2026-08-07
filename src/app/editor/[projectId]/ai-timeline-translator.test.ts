import { describe, expect, it, vi } from "vitest";
import {
  computeSurvivingSegments,
  mapTransitionsToSegmentBoundaries,
  mapWindowToSurvivingSegments,
  mapZoomToSurvivingSegments,
  normalizeSceneRemovalWindows,
  translateAITimelinePlan,
  type AITimelineModuleRunContext,
  type AITimelineProjectSnapshot,
  type AITimelineTranslationResult,
  type AITimelineTranslatorDeps,
} from "./ai-timeline-translator";
import type { EditorCommand } from "./commands";
import type { ClipView, TrackView } from "../types";
import { AI_TIMELINE_SCHEMA_VERSION, AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX, type AITimelinePlan } from "@/lib/validations/ai-timeline";

// Module-independence fix (2026-08, requirement 3) — translateAITimelinePlan
// no longer returns ONE composite `command`; it returns an array of
// independently-runnable `modules`. This test-only helper drives them the
// SAME way the real orchestrator (ai-auto-edit-panel.tsx's handleApply)
// does — sequentially, threading the captions module's real committed
// SUBTITLE order into a later overlay module exactly like production —
// so every pre-existing "run it, check the calls, undo it" test below
// keeps working unchanged against the new per-module shape. Tests that
// specifically exercise MODULE INDEPENDENCE (a failure in one module not
// affecting a sibling) live in commands.test.ts's own "FIX VERIFICATION"
// describe block, run against the raw per-module commands directly.
function runModules(result: AITimelineTranslationResult): { execute: () => Promise<void>; undo: () => Promise<void> } {
  const ctx: AITimelineModuleRunContext = {};
  const built: EditorCommand[] = [];
  return {
    execute: async () => {
      for (const m of result.modules) {
        const command = m.buildCommand(ctx);
        built.push(command);
        await command.execute();
        if (m.module === "captions" && "getCommittedOrder" in command && typeof command.getCommittedOrder === "function") {
          const order = (command as EditorCommand & { getCommittedOrder: () => number | undefined }).getCommittedOrder();
          if (order !== undefined) ctx.subtitleTrackOrderHint = order;
        }
      }
    },
    undo: async () => {
      for (const command of [...built].reverse()) {
        await command.undo();
      }
    },
  };
}

// Same framework-agnostic, fake-injected-deps testing style as
// commands.test.ts (this translator sits directly on top of it).
function makeFakeDeps(): AITimelineTranslatorDeps {
  return {
    clip: {
      updateClip: vi.fn().mockResolvedValue({ clip: {} as ClipView, prunedTransitions: [] }),
      deleteClip: vi.fn().mockResolvedValue(undefined),
      addClip: vi.fn().mockImplementation(async (patch) => ({ clip: { id: "new-clip-id", ...patch } as unknown as ClipView })),
      splitClip: vi.fn(),
      rippleDeleteClip: vi.fn(),
      duplicateClip: vi.fn(),
      replaceClipSource: vi.fn(),
      groupClips: vi.fn(),
      ungroupClips: vi.fn(),
      restoreTransition: vi.fn(),
    },
    track: {
      updateTrack: vi.fn().mockResolvedValue({ track: {} as TrackView }),
    },
    addTrackAndClip: {
      updateClip: vi.fn().mockResolvedValue({ clip: {} as ClipView, prunedTransitions: [] }),
      deleteClip: vi.fn().mockResolvedValue(undefined),
      addClip: vi.fn().mockImplementation(async (patch) => ({ clip: { id: "new-clip-id", ...patch } as unknown as ClipView })),
      splitClip: vi.fn(),
      rippleDeleteClip: vi.fn(),
      duplicateClip: vi.fn(),
      replaceClipSource: vi.fn(),
      groupClips: vi.fn(),
      ungroupClips: vi.fn(),
      restoreTransition: vi.fn(),
      addTrack: vi.fn().mockResolvedValue({ track: { id: "new-track-id" } as TrackView }),
      removeTrack: vi.fn().mockResolvedValue(undefined),
    },
    addMusicTrack: {
      updateClip: vi.fn().mockResolvedValue({ clip: {} as ClipView, prunedTransitions: [] }),
      deleteClip: vi.fn().mockResolvedValue(undefined),
      addClip: vi.fn().mockImplementation(async (patch) => ({ clip: { id: "new-music-clip-id", ...patch } as unknown as ClipView })),
      splitClip: vi.fn(),
      rippleDeleteClip: vi.fn(),
      duplicateClip: vi.fn(),
      replaceClipSource: vi.fn(),
      groupClips: vi.fn(),
      ungroupClips: vi.fn(),
      restoreTransition: vi.fn(),
      addTrack: vi.fn().mockResolvedValue({ track: { id: "new-music-track-id" } as TrackView }),
      removeTrack: vi.fn().mockResolvedValue(undefined),
      updateTrack: vi.fn().mockResolvedValue({ track: {} as TrackView }),
    },
    transition: {
      addTransition: vi.fn().mockResolvedValue({ transition: {} }),
      updateTransition: vi.fn(),
      removeTransition: vi.fn(),
    },
  } as unknown as AITimelineTranslatorDeps;
}

function makeTrack(overrides: Partial<TrackView> = {}): TrackView {
  return {
    id: "track-1",
    projectId: "proj-1",
    kind: "VIDEO",
    order: 0,
    isMuted: false,
    isHidden: false,
    isLocked: false,
    heightPx: 64,
    soloed: false,
    audioSubtype: null,
    duckingEnabled: false,
    duckingAmountDb: -12,
    duckingFadeMs: 300,
    duckingVoiceTrackIds: [],
    ...overrides,
  };
}

function makeClip(overrides: Partial<ClipView> = {}): ClipView {
  return {
    id: "clip-1",
    trackId: "track-1",
    projectId: "proj-1",
    assetId: "asset-1",
    startMs: 0,
    durationMs: 10_000,
    trimStartMs: 0,
    content: null,
    transform: null,
    groupId: null,
    ...overrides,
  };
}

function emptyPlan(overrides: Partial<AITimelinePlan> = {}): AITimelinePlan {
  return {
    version: AI_TIMELINE_SCHEMA_VERSION,
    intake: { aspectRatio: "RATIO_16_9" },
    sceneRemoval: [],
    captions: [],
    zoom: [],
    broll: [],
    stickers: [],
    sfx: [],
    transitions: [],
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// normalizeSceneRemovalWindows — the "ordering edge case" the founder
// explicitly asked for.
// -----------------------------------------------------------------------
describe("normalizeSceneRemovalWindows", () => {
  it("returns an empty array for no windows", () => {
    expect(normalizeSceneRemovalWindows([])).toEqual([]);
  });

  it("leaves disjoint windows untouched (already sorted)", () => {
    const result = normalizeSceneRemovalWindows([
      { startMs: 0, endMs: 1000 },
      { startMs: 2000, endMs: 3000 },
    ]);
    expect(result).toEqual([
      { startMs: 0, endMs: 1000 },
      { startMs: 2000, endMs: 3000 },
    ]);
  });

  it("sorts out-of-order disjoint windows", () => {
    const result = normalizeSceneRemovalWindows([
      { startMs: 2000, endMs: 3000 },
      { startMs: 0, endMs: 1000 },
    ]);
    expect(result).toEqual([
      { startMs: 0, endMs: 1000 },
      { startMs: 2000, endMs: 3000 },
    ]);
  });

  it("merges OVERLAPPING windows into one", () => {
    const result = normalizeSceneRemovalWindows([
      { startMs: 0, endMs: 1500 },
      { startMs: 1000, endMs: 2000 },
    ]);
    expect(result).toEqual([{ startMs: 0, endMs: 2000 }]);
  });

  it("merges exactly ADJACENT windows (endA === startB) into one", () => {
    const result = normalizeSceneRemovalWindows([
      { startMs: 0, endMs: 1000 },
      { startMs: 1000, endMs: 2000 },
    ]);
    expect(result).toEqual([{ startMs: 0, endMs: 2000 }]);
  });

  it("merges a chain of 3+ overlapping/adjacent windows regardless of input order", () => {
    const result = normalizeSceneRemovalWindows([
      { startMs: 5000, endMs: 6000 },
      { startMs: 0, endMs: 1000 },
      { startMs: 1000, endMs: 2500 },
      { startMs: 2000, endMs: 3000 },
    ]);
    expect(result).toEqual([
      { startMs: 0, endMs: 3000 },
      { startMs: 5000, endMs: 6000 },
    ]);
  });

  it("a window fully CONTAINED within another collapses to the outer one", () => {
    const result = normalizeSceneRemovalWindows([
      { startMs: 0, endMs: 5000 },
      { startMs: 1000, endMs: 2000 },
    ]);
    expect(result).toEqual([{ startMs: 0, endMs: 5000 }]);
  });
});

// -----------------------------------------------------------------------
// computeSurvivingSegments
// -----------------------------------------------------------------------
describe("computeSurvivingSegments", () => {
  it("no removal windows -> the whole clip survives as one segment", () => {
    const clip = makeClip({ startMs: 1000, durationMs: 5000, trimStartMs: 200 });
    expect(computeSurvivingSegments(clip, [])).toEqual([{ startMs: 1000, durationMs: 5000, trimStartMs: 200 }]);
  });

  it("one window in the middle -> two surviving segments, repacked gap-free", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    // Removes [4000, 6000) (clip-relative == absolute here since clip starts at 0).
    const result = computeSurvivingSegments(clip, [{ startMs: 4000, endMs: 6000 }]);
    expect(result).toEqual([
      { startMs: 0, durationMs: 4000, trimStartMs: 0 },
      { startMs: 4000, durationMs: 4000, trimStartMs: 6000 }, // repacked to start right after segment 1; trimStartMs skips the removed window in the SOURCE media
    ]);
  });

  it("window at the very start -> one segment, no leading fragment", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const result = computeSurvivingSegments(clip, [{ startMs: 0, endMs: 2000 }]);
    expect(result).toEqual([{ startMs: 0, durationMs: 8000, trimStartMs: 2000 }]);
  });

  it("window at the very end -> one segment, no trailing fragment", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const result = computeSurvivingSegments(clip, [{ startMs: 8000, endMs: 10_000 }]);
    expect(result).toEqual([{ startMs: 0, durationMs: 8000, trimStartMs: 0 }]);
  });

  it("window covering the entire clip -> no surviving segments", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    expect(computeSurvivingSegments(clip, [{ startMs: 0, endMs: 10_000 }])).toEqual([]);
  });

  it("multiple disjoint windows -> three surviving segments, repacked", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const result = computeSurvivingSegments(clip, [
      { startMs: 2000, endMs: 3000 },
      { startMs: 6000, endMs: 7000 },
    ]);
    expect(result).toEqual([
      { startMs: 0, durationMs: 2000, trimStartMs: 0 },
      { startMs: 2000, durationMs: 3000, trimStartMs: 3000 },
      { startMs: 5000, durationMs: 3000, trimStartMs: 7000 },
    ]);
  });

  it("a clip that doesn't start at 0 converts window ms to clip-relative correctly", () => {
    const clip = makeClip({ startMs: 5000, durationMs: 4000, trimStartMs: 0 });
    // Absolute [7000, 8000) -> clip-relative [2000, 3000).
    const result = computeSurvivingSegments(clip, [{ startMs: 7000, endMs: 8000 }]);
    expect(result).toEqual([
      { startMs: 5000, durationMs: 2000, trimStartMs: 0 },
      { startMs: 7000, durationMs: 1000, trimStartMs: 3000 },
    ]);
  });
});

// -----------------------------------------------------------------------
// mapZoomToSurvivingSegments — Phase 12 Module 4's own fix for the real
// parallel-composite race a zoom targeting the same clip a scene removal
// also touches used to hit (confirmed live: a real 500, "No record was
// found for an update," the first time a plan actually combined both).
// -----------------------------------------------------------------------
describe("mapZoomToSurvivingSegments", () => {
  it("maps a zoom window fully inside one surviving segment to that segment's own clip-relative time", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, [{ startMs: 4000, endMs: 6000 }]);
    // segments: [{startMs:0,durationMs:4000,trimStartMs:0}, {startMs:4000,durationMs:4000,trimStartMs:6000}]
    const warnings: string[] = [];
    const result = mapZoomToSurvivingSegments(clip, segments, [{ clipId: "clip-1", startMs: 7000, endMs: 8000, scaleFrom: 100, scaleTo: 120 }], warnings);
    expect(result).toEqual([undefined, { scaleFrom: 100, scaleTo: 120, startMs: 1000, endMs: 2000 }]);
    expect(warnings).toEqual([]);
  });

  it("drops a zoom window that fell entirely within the REMOVED region, with a warning", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, [{ startMs: 4000, endMs: 6000 }]);
    const warnings: string[] = [];
    const result = mapZoomToSurvivingSegments(clip, segments, [{ clipId: "clip-1", startMs: 4500, endMs: 5500, scaleFrom: 100, scaleTo: 120 }], warnings);
    expect(result).toEqual([undefined, undefined]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("fell entirely within a removed scene-removal window");
  });

  it("clips a zoom window that PARTIALLY overlaps the removed region to just the surviving part", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, [{ startMs: 4000, endMs: 6000 }]);
    const warnings: string[] = [];
    // Zoom [3000, 5000) straddles the cut — only [3000,4000) survives, in segment 0.
    const result = mapZoomToSurvivingSegments(clip, segments, [{ clipId: "clip-1", startMs: 3000, endMs: 5000, scaleFrom: 100, scaleTo: 120 }], warnings);
    expect(result).toEqual([{ scaleFrom: 100, scaleTo: 120, startMs: 3000, endMs: 4000 }, undefined]);
  });

  it("warns (does not silently drop) when two zoom items land on the SAME surviving segment — last one wins", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, []); // one segment, the whole clip
    const warnings: string[] = [];
    const result = mapZoomToSurvivingSegments(
      clip,
      segments,
      [
        { clipId: "clip-1", startMs: 1000, endMs: 2000, scaleFrom: 100, scaleTo: 110 },
        { clipId: "clip-1", startMs: 3000, endMs: 4000, scaleFrom: 100, scaleTo: 130 },
      ],
      warnings
    );
    expect(result).toEqual([{ scaleFrom: 100, scaleTo: 130, startMs: 3000, endMs: 4000 }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("overlaps another zoom already mapped to the same surviving segment");
  });

  it("a clip that doesn't start at 0 converts the zoom's absolute time to clip-relative correctly", () => {
    const clip = makeClip({ startMs: 5000, durationMs: 4000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, []); // one segment: [5000, 4000, trimStart 0]
    const warnings: string[] = [];
    const result = mapZoomToSurvivingSegments(clip, segments, [{ clipId: "clip-1", startMs: 6000, endMs: 7000, scaleFrom: 100, scaleTo: 120 }], warnings);
    expect(result).toEqual([{ scaleFrom: 100, scaleTo: 120, startMs: 1000, endMs: 2000 }]);
  });
});

// -----------------------------------------------------------------------
// mapWindowToSurvivingSegments — bugfix (2026-07-17), same overlap math
// as mapZoomToSurvivingSegments but returning ABSOLUTE timeline positions
// (real, separate clips go here — captions/broll/stickers/sfx), not one
// clip's own local keyframe offsets.
// -----------------------------------------------------------------------
describe("mapWindowToSurvivingSegments", () => {
  it("maps a window fully inside the FIRST surviving segment to the same absolute position (no shift yet)", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, [{ startMs: 4000, endMs: 6000 }]);
    // segments: [{startMs:0,durationMs:4000,trimStartMs:0}, {startMs:4000,durationMs:4000,trimStartMs:6000}]
    const result = mapWindowToSurvivingSegments(clip, segments, 1000, 2000);
    expect(result).toEqual([{ startMs: 1000, endMs: 2000 }]);
  });

  it("maps a window inside the SECOND surviving segment to its GAP-CLOSED absolute position, not its raw source position", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, [{ startMs: 4000, endMs: 6000 }]);
    // Source [7000, 8000) is 1000-2000ms into the SECOND surviving segment
    // (which starts at source 6000), and that segment is packed to start
    // at timeline 4000 after the cut closes the gap — so the real
    // reproduction of the live bug: a caption/broll window here must land
    // at [5000, 6000), NOT its raw source position [7000, 8000).
    const result = mapWindowToSurvivingSegments(clip, segments, 7000, 8000);
    expect(result).toEqual([{ startMs: 5000, endMs: 6000 }]);
  });

  it("returns an empty array for a window that fell entirely within the REMOVED region", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, [{ startMs: 4000, endMs: 6000 }]);
    const result = mapWindowToSurvivingSegments(clip, segments, 4500, 5500);
    expect(result).toEqual([]);
  });

  it("returns two pieces for a window straddling a removed boundary, each mapped to its own segment's gap-closed position", () => {
    const clip = makeClip({ startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const segments = computeSurvivingSegments(clip, [{ startMs: 4000, endMs: 6000 }]);
    // [3000, 7000) straddles the cut: [3000,4000) survives in segment 0,
    // [6000,7000) survives in segment 1 (packed to start at 4000).
    const result = mapWindowToSurvivingSegments(clip, segments, 3000, 7000);
    expect(result).toEqual([
      { startMs: 3000, endMs: 4000 },
      { startMs: 4000, endMs: 5000 },
    ]);
  });
});

// -----------------------------------------------------------------------
// mapTransitionsToSegmentBoundaries — Phase 12 Module 6's own fix for a
// real, previously-undiscovered gap: transitions referencing real clip
// ids could never resolve (GPT can't know a clip id that doesn't exist
// yet), so every GPT-proposed transition would silently warn-and-skip.
// -----------------------------------------------------------------------
describe("mapTransitionsToSegmentBoundaries", () => {
  const P = AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX;

  it("resolves a valid adjacent-boundary transition", () => {
    const warnings: string[] = [];
    const result = mapTransitionsToSegmentBoundaries(3, [{ betweenClipIds: [`${P}0__`, `${P}1__`], type: "CROSSFADE", durationMs: 500 }], warnings);
    expect(result.boundaryTransitions).toEqual([{ afterSegmentIndex: 0, type: "CROSSFADE", durationMs: 500 }]);
    expect(result.consumedIndices).toEqual(new Set([0]));
    expect(warnings).toEqual([]);
  });

  it("leaves a real-clip-id transition (no placeholder prefix) untouched for the independent path", () => {
    const warnings: string[] = [];
    const result = mapTransitionsToSegmentBoundaries(3, [{ betweenClipIds: ["real-clip-a", "real-clip-b"], type: "WIPE", durationMs: 400 }], warnings);
    expect(result.boundaryTransitions).toEqual([]);
    expect(result.consumedIndices).toEqual(new Set());
    expect(warnings).toEqual([]);
  });

  it("warns and skips a boundary index that's out of range for how many segments actually survived", () => {
    const warnings: string[] = [];
    // Only 2 surviving segments -> only boundary 0 is valid; boundary 1 doesn't exist.
    const result = mapTransitionsToSegmentBoundaries(2, [{ betweenClipIds: [`${P}1__`, `${P}2__`], type: "DISSOLVE", durationMs: 500 }], warnings);
    expect(result.boundaryTransitions).toEqual([]);
    expect(result.consumedIndices).toEqual(new Set([0]));
    expect(warnings[0]).toContain("doesn't exist");
  });

  it("warns and skips two NON-adjacent segment indices", () => {
    const warnings: string[] = [];
    const result = mapTransitionsToSegmentBoundaries(5, [{ betweenClipIds: [`${P}0__`, `${P}3__`], type: "SLIDE", durationMs: 500 }], warnings);
    expect(result.boundaryTransitions).toEqual([]);
    expect(warnings[0]).toContain("ADJACENT");
  });

  it("resolves multiple valid boundaries and reports each consumed index", () => {
    const warnings: string[] = [];
    const result = mapTransitionsToSegmentBoundaries(
      4,
      [
        { betweenClipIds: [`${P}0__`, `${P}1__`], type: "CROSSFADE", durationMs: 300 },
        { betweenClipIds: [`${P}2__`, `${P}3__`], type: "ZOOM", durationMs: 600 },
      ],
      warnings
    );
    expect(result.boundaryTransitions).toEqual([
      { afterSegmentIndex: 0, type: "CROSSFADE", durationMs: 300 },
      { afterSegmentIndex: 2, type: "ZOOM", durationMs: 600 },
    ]);
    expect(result.consumedIndices).toEqual(new Set([0, 1]));
  });

  it("returns an empty result for zero transitions", () => {
    const warnings: string[] = [];
    expect(mapTransitionsToSegmentBoundaries(3, [], warnings)).toEqual({ boundaryTransitions: [], consumedIndices: new Set() });
  });
});

// -----------------------------------------------------------------------
// translateAITimelinePlan — one section at a time.
// -----------------------------------------------------------------------
describe("translateAITimelinePlan", () => {
  function baseProject(overrides: Partial<AITimelineProjectSnapshot> = {}): AITimelineProjectSnapshot {
    return { tracks: [], clips: [], durationMs: 20_000, ...overrides };
  }

  it("an empty plan produces a null command and no warnings/unresolved items", async () => {
    const deps = makeFakeDeps();
    const result = translateAITimelinePlan(emptyPlan(), baseProject(), deps);
    expect(result.modules).toHaveLength(0);
    expect(result.unresolvedAssets).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("sceneRemoval on an existing clip produces a command that deletes + re-adds surviving segments on execute()", async () => {
    const clip = makeClip({ id: "clip-1", trackId: "track-1", startMs: 0, durationMs: 10_000 });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" })], clips: [clip] });
    const plan = emptyPlan({ sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "silence" }] });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    expect(result.modules.length).toBeGreaterThan(0);
    await runModules(result).execute();

    expect(deps.clip.deleteClip).toHaveBeenCalledWith("clip-1");
    expect(deps.clip.addClip).toHaveBeenCalledTimes(2); // two surviving segments
  });

  // Bugfix regression (2026-07-20, launch-readiness audit) — found via a
  // real full-pipeline export: sceneRemoval + music together produced a
  // project whose real video content correctly ended at the new,
  // gap-closed length, but whose music clip (and therefore the whole
  // timeline's computed duration) still spanned the OLD pre-removal
  // length — every second past the real content's end rendered solid
  // black with music still playing underneath, confirmed via a real
  // export's ffprobe + frame-by-frame check. translateMusic must size its
  // clip from the REAL post-removal duration, not the Apply-time
  // snapshot's stale project.durationMs.
  it("sceneRemoval + music together: music is sized to the REAL post-removal duration, not the stale pre-removal snapshot", async () => {
    const clip = makeClip({ id: "clip-1", trackId: "track-1", startMs: 0, durationMs: 10_000 });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" })], clips: [clip], durationMs: 20_000 });
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "silence" }],
      music: { assetId: "music-asset-1", duckingEnabled: false },
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    // Real post-removal duration: 10_000 - (6000-4000) = 8_000, NOT the
    // stale project.durationMs (20_000) the bug used to read.
    expect(deps.addMusicTrack.addClip).toHaveBeenCalledWith(expect.objectContaining({ assetId: "music-asset-1", durationMs: 8_000 }));
  });

  it("sceneRemoval referencing no matching clip is reported as a warning, not silently dropped", () => {
    const project = baseProject({ tracks: [], clips: [] });
    const plan = emptyPlan({ sceneRemoval: [{ startMs: 0, endMs: 1000, reason: "filler_word" }] });
    const result = translateAITimelinePlan(plan, project, makeFakeDeps());
    expect(result.modules).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("sceneRemoval");
  });

  // Bugfix regression (2026-07-17) — found via Module 6's own full-pipeline
  // live verification: a caption whose source window fell inside a
  // REMOVED region still showed up at its raw, stale timeline position,
  // overlapping completely different (kept) footage in the actual
  // exported video. captions/broll/stickers/sfx must be remapped through
  // the same gap-closing sceneRemoval already applies to zoom.
  it("caption + sceneRemoval on the SAME clip: a caption inside a KEPT segment is remapped to the gap-closed timeline position", async () => {
    const clip = makeClip({ id: "clip-1", trackId: "track-1", startMs: 0, durationMs: 10_000 });
    const subtitleTrack = makeTrack({ id: "sub-1", kind: "SUBTITLE" });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" }), subtitleTrack], clips: [clip] });
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "silence" }],
      // Source [7000, 8000) is 1000-2000ms into the surviving segment
      // that starts at source 6000; after the cut closes the gap that
      // segment is packed to start at timeline 4000 — so the caption
      // must land at [5000, 6000), never its raw source position.
      captions: [{ text: "kept line", startMs: 7000, endMs: 8000 }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.clip.addClip).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "sub-1", startMs: 5000, durationMs: 1000, content: expect.objectContaining({ text: "kept line" }) })
    );
  });

  it("caption + sceneRemoval on the SAME clip: a caption entirely inside the REMOVED region is dropped, with a warning", async () => {
    const clip = makeClip({ id: "clip-1", trackId: "track-1", startMs: 0, durationMs: 10_000 });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" })], clips: [clip] });
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "bad_take" }],
      captions: [{ text: "removed line", startMs: 4500, endMs: 5500 }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addTrackAndClip.addTrack).not.toHaveBeenCalled(); // no SUBTITLE track needed — nothing survived to caption
    expect(result.warnings.some((w) => w.includes("removed line") && w.includes("fell entirely within a removed scene-removal window"))).toBe(true);
  });

  it("broll + sceneRemoval on the SAME clip: a broll clip inside a KEPT segment is remapped to the gap-closed timeline position", async () => {
    const clip = makeClip({ id: "clip-1", trackId: "track-1", startMs: 0, durationMs: 10_000 });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" })], clips: [clip] });
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "silence" }],
      broll: [{ startMs: 7000, endMs: 8000, trackHint: "broll", source: "stock", searchQuery: "x", resolvedAssetId: "asset-broll" }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addTrackAndClip.addTrack).toHaveBeenCalledWith({ kind: "OVERLAY" });
    expect(deps.addTrackAndClip.addClip).toHaveBeenCalledWith(expect.objectContaining({ assetId: "asset-broll", startMs: 5000, durationMs: 1000 }));
  });

  it("sfx + sceneRemoval on the SAME clip: an sfx moment inside the REMOVED region is dropped, with a warning", async () => {
    const clip = makeClip({ id: "clip-1", trackId: "track-1", startMs: 0, durationMs: 10_000 });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" })], clips: [clip] });
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "silence" }],
      sfx: [{ atMs: 4800, assetQuery: "pop", assetId: "asset-sfx" }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addTrackAndClip.addTrack).not.toHaveBeenCalledWith({ kind: "AUDIO", audioSubtype: "SFX" });
    expect(result.warnings.some((w) => w.includes("sfx at 4800") && w.includes("fell entirely within a removed scene-removal window"))).toBe(true);
  });

  it("no sceneRemoval: captions/broll/sfx pass through unchanged (no remap side effect when nothing was removed)", async () => {
    const project = baseProject({ tracks: [] });
    const plan = emptyPlan({
      captions: [{ text: "hello", startMs: 1000, endMs: 2000 }],
      broll: [{ startMs: 3000, endMs: 4000, trackHint: "broll", source: "stock", searchQuery: "x", resolvedAssetId: "asset-broll" }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addTrackAndClip.addClip).toHaveBeenCalledWith(expect.objectContaining({ startMs: 1000, durationMs: 1000 }));
    expect(result.warnings).toEqual([]);
  });

  it("captions with an EXISTING SUBTITLE track use createAddClipCommand (no new track created)", async () => {
    const subtitleTrack = makeTrack({ id: "sub-1", kind: "SUBTITLE" });
    const project = baseProject({ tracks: [subtitleTrack] });
    const plan = emptyPlan({ captions: [{ text: "Hello world", startMs: 0, endMs: 2000 }] });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.clip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "sub-1", startMs: 0, durationMs: 2000 }));
    expect(deps.addTrackAndClip.addTrack).not.toHaveBeenCalled();
  });

  // TASK 3 (2026-08-07, AI Auto-Edit power-word highlighting).
  it("resolves highlightWords into real character-offset richRuns on the caption's content", async () => {
    const subtitleTrack = makeTrack({ id: "sub-1", kind: "SUBTITLE" });
    const project = baseProject({ tracks: [subtitleTrack] });
    const plan = emptyPlan({
      captions: [{ text: "DON'T IGNORE DIABETES", startMs: 0, endMs: 2000, highlightWords: [{ word: "DON'T", color: "#FF3B30" }, { word: "IGNORE", color: "#FFD60A" }] }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.clip.addClip).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          richRuns: [
            { start: 0, end: 5, color: "#FF3B30" },
            { start: 6, end: 12, color: "#FFD60A" },
          ],
        }),
      })
    );
  });

  it("a highlight word that isn't actually present in the caption's own text produces no run for it (no error)", async () => {
    const subtitleTrack = makeTrack({ id: "sub-1", kind: "SUBTITLE" });
    const project = baseProject({ tracks: [subtitleTrack] });
    const plan = emptyPlan({
      captions: [{ text: "hello world", startMs: 0, endMs: 2000, highlightWords: [{ word: "nonexistent", color: "#FF3B30" }] }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.clip.addClip).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.not.objectContaining({ richRuns: expect.anything() }) })
    );
  });

  it("omits richRuns entirely when no highlightWords were proposed (unchanged pre-existing behavior)", async () => {
    const subtitleTrack = makeTrack({ id: "sub-1", kind: "SUBTITLE" });
    const project = baseProject({ tracks: [subtitleTrack] });
    const plan = emptyPlan({ captions: [{ text: "plain caption", startMs: 0, endMs: 2000 }] });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.clip.addClip).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.not.objectContaining({ richRuns: expect.anything() }) })
    );
  });

  it("captions with NO existing SUBTITLE track create one via createAddTrackWithClipsCommand", async () => {
    const project = baseProject({ tracks: [] });
    const plan = emptyPlan({ captions: [{ text: "Hello world", startMs: 0, endMs: 2000 }] });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addTrackAndClip.addTrack).toHaveBeenCalledWith({ kind: "SUBTITLE" });
    expect(deps.addTrackAndClip.addClip).toHaveBeenCalledWith(expect.objectContaining({ startMs: 0, durationMs: 2000 }));
  });

  // Real bug fix, Phase 12 Module 4 — multiple captions with no existing
  // SUBTITLE track used to each independently call
  // createAddTrackAndClipCommand (they all read the same static
  // "subtitleTrack: undefined" snapshot), creating N SEPARATE tracks
  // instead of one track with N clips — confirmed live: a real 4-caption
  // plan produced 4 tracks (track count +4, only 1 clip visible on the
  // first one a naive query found). This regression test targets the
  // fix: exactly ONE addTrack call for any number of captions.
  it("MULTIPLE captions with no existing SUBTITLE track create exactly ONE track with all clips on it, not one track per caption", async () => {
    const project = baseProject({ tracks: [] });
    const plan = emptyPlan({
      captions: [
        { text: "One", startMs: 0, endMs: 1000 },
        { text: "Two", startMs: 1000, endMs: 2000 },
        { text: "Three", startMs: 2000, endMs: 3000 },
      ],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addTrackAndClip.addTrack).toHaveBeenCalledTimes(1);
    expect(deps.addTrackAndClip.addTrack).toHaveBeenCalledWith({ kind: "SUBTITLE" });
    expect(deps.addTrackAndClip.addClip).toHaveBeenCalledTimes(3);
    expect(deps.addTrackAndClip.addClip).toHaveBeenNthCalledWith(1, expect.objectContaining({ trackId: "new-track-id", startMs: 0 }));
    expect(deps.addTrackAndClip.addClip).toHaveBeenNthCalledWith(2, expect.objectContaining({ trackId: "new-track-id", startMs: 1000 }));
    expect(deps.addTrackAndClip.addClip).toHaveBeenNthCalledWith(3, expect.objectContaining({ trackId: "new-track-id", startMs: 2000 }));
  });

  it("undo of a multi-caption new-track command removes every created clip AND the track", async () => {
    const project = baseProject({ tracks: [] });
    const plan = emptyPlan({ captions: [{ text: "One", startMs: 0, endMs: 1000 }, { text: "Two", startMs: 1000, endMs: 2000 }] });
    const deps = makeFakeDeps();
    let nextId = 0;
    (deps.addTrackAndClip.addClip as ReturnType<typeof vi.fn>).mockImplementation(async (patch: Record<string, unknown>) => ({
      clip: { id: `caption-clip-${nextId++}`, ...patch },
    }));

    const result = translateAITimelinePlan(plan, project, deps);
    const run = runModules(result);
    await run.execute();
    await run.undo();

    expect(deps.addTrackAndClip.deleteClip).toHaveBeenCalledWith("caption-clip-0");
    expect(deps.addTrackAndClip.deleteClip).toHaveBeenCalledWith("caption-clip-1");
    expect(deps.addTrackAndClip.removeTrack).toHaveBeenCalledWith("new-track-id");
  });

  it("caption reveal defaults to WORD mode when the plan omits it", async () => {
    const project = baseProject({ tracks: [makeTrack({ id: "sub-1", kind: "SUBTITLE" })] });
    const plan = emptyPlan({ captions: [{ text: "Hi", startMs: 0, endMs: 1000 }] });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.clip.addClip).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ reveal: expect.objectContaining({ mode: "WORD" }) }) })
    );
  });

  it("zoom inserts scale keyframes at clip-relative times, converted from absolute plan ms", async () => {
    const clip = makeClip({ id: "clip-1", startMs: 1000, durationMs: 5000, transform: null });
    const project = baseProject({ clips: [clip] });
    const plan = emptyPlan({ zoom: [{ clipId: "clip-1", startMs: 2000, endMs: 4000, scaleFrom: 100, scaleTo: 150 }] });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.clip.updateClip).toHaveBeenCalledWith({
      clipId: "clip-1",
      patch: {
        transform: expect.objectContaining({
          scale: expect.objectContaining({
            value: 100,
            keyframes: [
              expect.objectContaining({ timeMs: 1000, value: 100 }), // 2000 - clip.startMs(1000)
              expect.objectContaining({ timeMs: 3000, value: 150 }), // 4000 - clip.startMs(1000)
            ],
          }),
        }),
      },
    });
  });

  it("zoom referencing a missing clip id is reported as a warning, not silently dropped", () => {
    const project = baseProject({ clips: [] });
    const plan = emptyPlan({ zoom: [{ clipId: "does-not-exist", startMs: 0, endMs: 1000, scaleFrom: 100, scaleTo: 120 }] });
    const result = translateAITimelinePlan(plan, project, makeFakeDeps());
    expect(result.modules).toHaveLength(0);
    expect(result.warnings[0]).toContain("does-not-exist");
  });

  // Real bug fix, Phase 12 Module 4 — a zoom targeting the SAME clip a
  // sceneRemoval also targets used to be built as an INDEPENDENT
  // createUpdateTransformCommand against the ORIGINAL clip's id, run
  // through the same parallel createCompositeCommand as the removal's
  // own delete-and-recreate — confirmed live to 500 ("No record was
  // found for an update") since the removal deletes that exact id. This
  // regression test targets the fix: the zoom must land on one of the
  // NEWLY CREATED surviving-segment clips, never the deleted original id.
  it("zoom + sceneRemoval on the SAME clip: the zoom lands on a surviving segment, not the deleted original clip", async () => {
    const clip = makeClip({ id: "original-clip", startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" })], clips: [clip] });
    // Removes [4000,6000) -> segments [0,4000) trimStart 0, [4000,4000) trimStart 6000.
    // Zoom [7000,8000) lands entirely in the SECOND surviving segment.
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "silence" }],
      zoom: [{ clipId: "original-clip", startMs: 7000, endMs: 8000, scaleFrom: 100, scaleTo: 120 }],
    });
    const deps = makeFakeDeps();
    let nextId = 0;
    (deps.clip.addClip as ReturnType<typeof vi.fn>).mockImplementation(async (patch: Record<string, unknown>) => ({
      clip: { id: `segment-${nextId++}`, ...patch } as unknown as ClipView,
    }));

    const result = translateAITimelinePlan(plan, project, deps);
    expect(result.modules.length).toBeGreaterThan(0);
    await runModules(result).execute();

    // The delete targets the ORIGINAL clip — unchanged, expected.
    expect(deps.clip.deleteClip).toHaveBeenCalledWith("original-clip");
    // The transform update must NEVER target "original-clip" (already
    // deleted by the time any update could run) — it must target one of
    // the freshly created segment ids instead.
    expect(deps.clip.updateClip).toHaveBeenCalledTimes(1);
    const updateCall = (deps.clip.updateClip as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall.clipId).not.toBe("original-clip");
    expect(updateCall.clipId).toMatch(/^segment-/);
    expect(updateCall.patch.transform.scale.keyframes).toEqual([
      // segment 2 covers original-clip-relative [6000,10000) (trimStartMs 6000);
      // zoom [7000,8000) is 1000-2000ms into THAT segment's own playback.
      expect.objectContaining({ timeMs: 1000, value: 100 }),
      expect.objectContaining({ timeMs: 2000, value: 120 }),
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("zoom + sceneRemoval on DIFFERENT clips: the zoom still applies independently, unaffected by the other clip's removal", async () => {
    const removedClip = makeClip({ id: "clip-a", trackId: "track-1", startMs: 0, durationMs: 10_000 });
    const zoomedClip = makeClip({ id: "clip-b", trackId: "track-1", startMs: 20_000, durationMs: 5000, transform: null });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" })], clips: [removedClip, zoomedClip] });
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "silence" }],
      zoom: [{ clipId: "clip-b", startMs: 21000, endMs: 22000, scaleFrom: 100, scaleTo: 130 }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    // clip-b was never touched by sceneRemoval, so its zoom goes through
    // the plain, independent translateZoom path — targeting its own real
    // (never-deleted) id directly.
    expect(deps.clip.updateClip).toHaveBeenCalledWith({
      clipId: "clip-b",
      patch: { transform: expect.objectContaining({ scale: expect.objectContaining({ value: 100 }) }) },
    });
  });

  it("broll WITHOUT a resolvedAssetId is reported as unresolved, not silently dropped", () => {
    const project = baseProject();
    const plan = emptyPlan({
      broll: [{ startMs: 0, endMs: 2000, trackHint: "broll", source: "stock", searchQuery: "city skyline at night" }],
    });
    const result = translateAITimelinePlan(plan, project, makeFakeDeps());
    expect(result.modules).toHaveLength(0);
    expect(result.unresolvedAssets).toHaveLength(1);
    expect(result.unresolvedAssets[0]).toMatchObject({ section: "broll", reason: "missing_resolved_asset_id" });
  });

  it("broll WITH a resolvedAssetId produces a real add-clip command and is NOT reported as unresolved", async () => {
    const overlayTrack = makeTrack({ id: "overlay-1", kind: "OVERLAY" });
    const project = baseProject({ tracks: [overlayTrack] });
    const plan = emptyPlan({
      broll: [{ startMs: 0, endMs: 2000, trackHint: "broll", source: "stock", searchQuery: "city skyline", resolvedAssetId: "asset-42" }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    expect(result.unresolvedAssets).toEqual([]);
    await runModules(result).execute();
    expect(deps.clip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "overlay-1", assetId: "asset-42" }));
  });

  it("stickers without an assetId are unresolved; sfx without an assetId are unresolved", () => {
    const project = baseProject();
    const plan = emptyPlan({
      stickers: [{ startMs: 0, endMs: 1000, assetQuery: "instagram icon" }],
      sfx: [{ atMs: 500, assetQuery: "whoosh" }],
    });
    const result = translateAITimelinePlan(plan, project, makeFakeDeps());
    expect(result.unresolvedAssets).toEqual([
      expect.objectContaining({ section: "sticker" }),
      expect.objectContaining({ section: "sfx" }),
    ]);
  });

  it("music with NO existing MUSIC track creates one atomically (track + clip + ducking) via createAddMusicTrackCommand", async () => {
    const voiceTrack = makeTrack({ id: "voice-1", kind: "AUDIO", audioSubtype: "VOICE" });
    const project = baseProject({ tracks: [voiceTrack], durationMs: 15_000 });
    const plan = emptyPlan({ music: { assetId: "music-asset-1", duckingEnabled: true, duckingVoiceTrackHint: "voice" } });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addMusicTrack.addTrack).toHaveBeenCalledWith({ kind: "AUDIO", audioSubtype: "MUSIC" });
    expect(deps.addMusicTrack.addClip).toHaveBeenCalledWith(expect.objectContaining({ assetId: "music-asset-1", startMs: 0, durationMs: 15_000 }));
    expect(deps.addMusicTrack.updateTrack).toHaveBeenCalledWith(
      expect.objectContaining({ patch: expect.objectContaining({ duckingEnabled: true, duckingVoiceTrackIds: ["voice-1"] }) })
    );
  });

  // TASK 7 (2026-08-07, "music should evolve") — volumeEnvelope's
  // fractional points become real content.volume keyframes on the clip.
  //
  // Real bug found + fixed via live pipeline verification (2026-08-07) —
  // aiMusicVolumePointSchema.volumeLevel is 0-100 (a percentage) but
  // ClipContent.volume's real stored range is 0-2 (100% = 1.0 — see
  // lib/video-editor/audio.ts). This test used to assert the RAW,
  // unconverted percentage value (40/65/85) landed directly as `value` —
  // that was asserting the BUG, not the contract: a real addClip call
  // with content.volume.value=85 gets rejected outright by the server's
  // own `z.number().min(0).max(2)` validation. Fixed to assert the real
  // /100-converted values (0.4/0.65/0.85) translateMusic now produces.
  it("music with a volumeEnvelope gets real content.volume keyframes, mapped from fraction to real ms AND from 0-100 percentage to the real 0-2 stored scale", async () => {
    const project = baseProject({ tracks: [], durationMs: 20_000 });
    const plan = emptyPlan({
      music: {
        assetId: "music-asset-1",
        duckingEnabled: true,
        volumeEnvelope: [
          { atFraction: 0, volumeLevel: 40 },
          { atFraction: 0.5, volumeLevel: 65 },
          { atFraction: 0.9, volumeLevel: 85 },
        ],
      },
    });
    const deps = makeFakeDeps();
    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addMusicTrack.addClip).toHaveBeenCalledWith(
      expect.objectContaining({
        content: {
          volume: {
            value: 0.4,
            keyframes: [
              expect.objectContaining({ timeMs: 0, value: 0.4 }),
              expect.objectContaining({ timeMs: 10_000, value: 0.65 }),
              expect.objectContaining({ timeMs: 18_000, value: 0.85 }),
            ],
          },
        },
      })
    );
  });

  it("music with NO volumeEnvelope has no 'content' key at all — falls back to the clip's own default volume unchanged", async () => {
    const project = baseProject({ tracks: [], durationMs: 15_000 });
    const plan = emptyPlan({ music: { assetId: "music-asset-1", duckingEnabled: true } });
    const deps = makeFakeDeps();
    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addMusicTrack.addClip).toHaveBeenCalledWith(expect.not.objectContaining({ content: expect.anything() }));
  });

  it("music with an EXISTING MUSIC track adds the clip and updates ducking as two independent commands", async () => {
    const musicTrack = makeTrack({ id: "music-1", kind: "AUDIO", audioSubtype: "MUSIC", duckingEnabled: false });
    const project = baseProject({ tracks: [musicTrack], durationMs: 12_000 });
    const plan = emptyPlan({ music: { assetId: "music-asset-1", duckingEnabled: true } });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.clip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "music-1", assetId: "music-asset-1", durationMs: 12_000 }));
    expect(deps.track.updateTrack).toHaveBeenCalledWith(expect.objectContaining({ trackId: "music-1", patch: expect.objectContaining({ duckingEnabled: true }) }));
    expect(deps.addMusicTrack.addTrack).not.toHaveBeenCalled();
  });

  it("music without an assetId is unresolved, not silently dropped", () => {
    const project = baseProject();
    const plan = emptyPlan({ music: { searchQuery: "upbeat cinematic", duckingEnabled: true } });
    const result = translateAITimelinePlan(plan, project, makeFakeDeps());
    expect(result.unresolvedAssets).toEqual([expect.objectContaining({ section: "music" })]);
  });

  it("transitions between two clips on the SAME track produce a real addTransition command", async () => {
    const clipA = makeClip({ id: "clip-a", trackId: "track-1", startMs: 0, durationMs: 3000 });
    const clipB = makeClip({ id: "clip-b", trackId: "track-1", startMs: 3000, durationMs: 3000 });
    const project = baseProject({ clips: [clipA, clipB] });
    const plan = emptyPlan({ transitions: [{ betweenClipIds: ["clip-a", "clip-b"], type: "CROSSFADE", durationMs: 500 }] });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.transition.addTransition).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "track-1", clipAId: "clip-a", clipBId: "clip-b", type: "CROSSFADE", durationMs: 500 })
    );
  });

  it("transitions between clips on DIFFERENT tracks are reported as a warning, not silently dropped", () => {
    const clipA = makeClip({ id: "clip-a", trackId: "track-1" });
    const clipB = makeClip({ id: "clip-b", trackId: "track-2" });
    const project = baseProject({ clips: [clipA, clipB] });
    const plan = emptyPlan({ transitions: [{ betweenClipIds: ["clip-a", "clip-b"], type: "CROSSFADE", durationMs: 500 }] });
    const result = translateAITimelinePlan(plan, project, makeFakeDeps());
    expect(result.modules).toHaveLength(0);
    expect(result.warnings[0]).toContain("same track");
  });

  // Real bug fix, Phase 12 Module 6 — a transition previously had NO way
  // to reference a clip id that doesn't exist yet (every surviving
  // segment's real id is only minted DURING scene removal's own
  // execute()) — every GPT-proposed transition would have warned and
  // skipped, 100% of the time, since GPT can never produce a real clip
  // id. This regression test targets the fix: the segment-boundary
  // placeholder resolves to REAL, newly-created segment ids, and the
  // transition actually gets created.
  it("transition + sceneRemoval on the SAME clip: the boundary-index placeholder resolves to REAL surviving-segment ids", async () => {
    const clip = makeClip({ id: "original-clip", startMs: 0, durationMs: 10_000, trimStartMs: 0 });
    const project = baseProject({ tracks: [makeTrack({ id: "track-1" })], clips: [clip] });
    const P = AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX;
    // Removes [4000,6000) -> 2 surviving segments -> exactly one boundary, index 0.
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 4000, endMs: 6000, reason: "silence" }],
      transitions: [{ betweenClipIds: [`${P}0__`, `${P}1__`], type: "DISSOLVE", durationMs: 400 }],
    });
    const deps = makeFakeDeps();
    let nextId = 0;
    (deps.clip.addClip as ReturnType<typeof vi.fn>).mockImplementation(async (patch: Record<string, unknown>) => ({
      clip: { id: `segment-${nextId++}`, ...patch } as unknown as ClipView,
    }));

    const result = translateAITimelinePlan(plan, project, deps);
    expect(result.modules.length).toBeGreaterThan(0);
    await runModules(result).execute();

    expect(deps.transition.addTransition).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "track-1", clipAId: "segment-0", clipBId: "segment-1", type: "DISSOLVE", durationMs: 400 })
    );
    expect(result.warnings).toEqual([]);
  });

  // Real bug fix, Phase 12 Module 6 — broll and stickers both target the
  // OVERLAY track; kept as two independent sections each with their own
  // createAddTrackAndClipCommand fallback, a plan with items in BOTH and
  // no pre-existing OVERLAY track would create TWO separate overlay
  // tracks (one per section) instead of sharing one — the exact same
  // "N items independently create their own track" bug already fixed
  // for captions, just one level up. This regression test targets the
  // fix: exactly ONE addTrack call for broll+stickers combined.
  it("broll + stickers with NO existing OVERLAY track share exactly ONE new track, not one each", async () => {
    const project = baseProject({ tracks: [] });
    const plan = emptyPlan({
      broll: [{ startMs: 0, endMs: 2000, trackHint: "broll", source: "stock", searchQuery: "city", resolvedAssetId: "broll-asset" }],
      stickers: [{ startMs: 500, endMs: 1500, assetQuery: "sparkles", assetId: "sticker-asset" }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addTrackAndClip.addTrack).toHaveBeenCalledTimes(1);
    expect(deps.addTrackAndClip.addTrack).toHaveBeenCalledWith({ kind: "OVERLAY" });
    expect(deps.addTrackAndClip.addClip).toHaveBeenCalledTimes(2);
    expect(deps.addTrackAndClip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "new-track-id", assetId: "broll-asset" }));
    expect(deps.addTrackAndClip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "new-track-id", assetId: "sticker-asset" }));
  });

  it("broll + stickers with an EXISTING OVERLAY track add both clips independently (no track creation at all)", async () => {
    const overlayTrack = makeTrack({ id: "overlay-1", kind: "OVERLAY" });
    const project = baseProject({ tracks: [overlayTrack] });
    const plan = emptyPlan({
      broll: [{ startMs: 0, endMs: 2000, trackHint: "broll", source: "stock", searchQuery: "city", resolvedAssetId: "broll-asset" }],
      stickers: [{ startMs: 500, endMs: 1500, assetQuery: "sparkles", assetId: "sticker-asset" }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    await runModules(result).execute();

    expect(deps.addTrackAndClip.addTrack).not.toHaveBeenCalled();
    expect(deps.clip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "overlay-1", assetId: "broll-asset" }));
    expect(deps.clip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "overlay-1", assetId: "sticker-asset" }));
  });

  it("a multi-section plan produces one INDEPENDENT module command per section — undoing every module together still reverses everything", async () => {
    const subtitleTrack = makeTrack({ id: "sub-1", kind: "SUBTITLE" });
    const project = baseProject({ tracks: [subtitleTrack] });
    const plan = emptyPlan({
      captions: [{ text: "One", startMs: 0, endMs: 1000 }],
      sfx: [{ atMs: 500, assetId: "sfx-1" }],
    });
    const deps = makeFakeDeps();

    const result = translateAITimelinePlan(plan, project, deps);
    // Module-independence fix (2026-08, requirement 3) — captions and sfx
    // are now two SEPARATE top-level modules (previously one shared
    // createCompositeCommand), each independently undo-able. runModules
    // below drives them the same way the real orchestrator
    // (ai-auto-edit-panel.tsx's handleApply) does — sequentially, each
    // with its own execute()/undo() — not bundled into one command.
    expect(result.modules.map((m) => m.module).sort()).toEqual(["captions", "sfx"]);
    const run = runModules(result);
    await run.execute();
    await run.undo();

    // Both the caption clip and the sfx clip (auto-created AUDIO/SFX track) got deleted on undo.
    expect(deps.clip.deleteClip).toHaveBeenCalled();
    expect(deps.addTrackAndClip.deleteClip).toHaveBeenCalled();
    expect(deps.addTrackAndClip.removeTrack).toHaveBeenCalled(); // the auto-created SFX track
  });

  // Real bug found live (2026-07-18/19), then live-RE-confirmed with real
  // data on 2026-07-19 (OVERLAY order -2, SUBTITLE order -1, b-roll
  // rendering over captions in an overlapping window) after an earlier
  // investigation had flagged but never actually fixed it — see
  // createCaptionsTrackCommand's own doc comment (commands.ts) for the
  // root mechanism (createCompositeCommand's Promise.all gives no
  // ordering guarantee between sibling track-creates). This mock
  // simulates addTrack()'s REAL order semantics (prepend decrements
  // below the current lowest order; insertBelowOrder lands one above the
  // given reference) closely enough to prove the fix's actual numeric
  // outcome, not just "some command ran."
  //
  // Module-independence update (2026-08, requirement 3) — captions and
  // overlay are now two separate top-level modules (no longer one bundled
  // createCaptionsAboveOverlayCommand), sequenced by the orchestrator
  // (runModules below, mirroring ai-auto-edit-panel.tsx's handleApply):
  // captions still runs first and its real committed order still feeds
  // overlay's insertBelowOrder as a SOFT hint, but the two are
  // independently undo-able and a captions failure no longer blocks
  // overlay from running (see commands.test.ts's own "FIX VERIFICATION"
  // describe block for that independence property, unit-tested directly).
  describe("caption/b-roll stacking order (2026-07-19 fix)", () => {
    function makeOrderTrackingDeps(): { deps: AITimelineTranslatorDeps; getCreatedOrder: (trackId: string) => number | undefined } {
      const orders = new Map<string, number>();
      let currentTop = 0;
      let nextTrackSeq = 0;
      const deps = makeFakeDeps();
      (deps.addTrackAndClip.addTrack as ReturnType<typeof vi.fn>).mockImplementation(async (input: { kind: string; insertBelowOrder?: number }) => {
        const order = input.insertBelowOrder !== undefined ? input.insertBelowOrder + 1 : --currentTop;
        const id = `track-${input.kind.toLowerCase()}-${nextTrackSeq++}`;
        orders.set(id, order);
        return { track: { id, order, kind: input.kind } as unknown as TrackView };
      });
      return { deps, getCreatedOrder: (trackId: string) => orders.get(trackId) };
    }

    it("BOTH SUBTITLE and OVERLAY need fresh creation (the exact live-reproduced scenario): captions consistently land at a LOWER order than b-roll, across repeated runs", async () => {
      const project = { tracks: [], clips: [], durationMs: 20_000 };
      const plan = emptyPlan({
        captions: [{ text: "Hello", startMs: 0, endMs: 1000 }],
        broll: [{ startMs: 0, endMs: 1000, trackHint: "broll", source: "stock", searchQuery: "city", resolvedAssetId: "broll-asset" }],
      });

      // Run it several times — the bug was a Promise.all race, so a
      // single pass proves nothing about determinism on its own.
      for (let i = 0; i < 10; i++) {
        const { deps, getCreatedOrder } = makeOrderTrackingDeps();
        const result = translateAITimelinePlan(plan, project, deps);
        expect(result.modules.length).toBeGreaterThan(0);
        await runModules(result).execute();

        const addTrackCalls = (deps.addTrackAndClip.addTrack as ReturnType<typeof vi.fn>).mock.calls;
        expect(addTrackCalls).toHaveLength(2);
        // Deterministic call ORDER too, not just final numeric values —
        // SUBTITLE's track must be created (and its real order known)
        // before OVERLAY's creation call is even made.
        expect(addTrackCalls[0][0]).toEqual({ kind: "SUBTITLE" });
        expect(addTrackCalls[1][0]).toEqual({ kind: "OVERLAY", insertBelowOrder: expect.any(Number) });

        const captionClipCall = (deps.addTrackAndClip.addClip as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0].content?.text === "Hello");
        const brollClipCall = (deps.addTrackAndClip.addClip as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0].assetId === "broll-asset");
        expect(captionClipCall).toBeDefined();
        expect(brollClipCall).toBeDefined();
        const subtitleOrder = getCreatedOrder(captionClipCall![0].trackId);
        const overlayOrder = getCreatedOrder(brollClipCall![0].trackId);
        expect(subtitleOrder).toBeDefined();
        expect(overlayOrder).toBeDefined();
        // The one hard invariant: captions render IN FRONT of b-roll,
        // which per track-stacking.ts's own documented convention means
        // a STRICTLY LOWER order.
        expect(subtitleOrder!).toBeLessThan(overlayOrder!);
      }
    });

    it("SUBTITLE already exists, OVERLAY needs fresh creation: overlay is created with insertBelowOrder targeting the EXISTING subtitle track's real order", async () => {
      const subtitleTrack = makeTrack({ id: "sub-existing", kind: "SUBTITLE", order: -5 });
      const project = { tracks: [subtitleTrack], clips: [], durationMs: 20_000 };
      const plan = emptyPlan({
        broll: [{ startMs: 0, endMs: 1000, trackHint: "broll", source: "stock", searchQuery: "city", resolvedAssetId: "broll-asset" }],
      });
      const { deps } = makeOrderTrackingDeps();

      const result = translateAITimelinePlan(plan, project, deps);
      await runModules(result).execute();

      expect(deps.addTrackAndClip.addTrack).toHaveBeenCalledWith({ kind: "OVERLAY", insertBelowOrder: -5 });
    });

    it("OVERLAY already exists, SUBTITLE needs fresh creation: no coordination needed — captions' own default prepend-to-top already lands above the existing overlay", async () => {
      const overlayTrack = makeTrack({ id: "overlay-existing", kind: "OVERLAY", order: -3 });
      const project = { tracks: [overlayTrack], clips: [], durationMs: 20_000 };
      const plan = emptyPlan({
        captions: [{ text: "Hello", startMs: 0, endMs: 1000 }],
      });
      const { deps } = makeOrderTrackingDeps();

      const result = translateAITimelinePlan(plan, project, deps);
      await runModules(result).execute();

      expect(deps.addTrackAndClip.addTrack).toHaveBeenCalledWith({ kind: "SUBTITLE" });
      expect(deps.addTrackAndClip.addTrack).not.toHaveBeenCalledWith(expect.objectContaining({ insertBelowOrder: expect.anything() }));
    });

    it("BOTH tracks already exist: zero track-creation calls, no coordination command needed", async () => {
      const subtitleTrack = makeTrack({ id: "sub-existing", kind: "SUBTITLE", order: -5 });
      const overlayTrack = makeTrack({ id: "overlay-existing", kind: "OVERLAY", order: -3 });
      const project = { tracks: [subtitleTrack, overlayTrack], clips: [], durationMs: 20_000 };
      const plan = emptyPlan({
        captions: [{ text: "Hello", startMs: 0, endMs: 1000 }],
        broll: [{ startMs: 0, endMs: 1000, trackHint: "broll", source: "stock", searchQuery: "city", resolvedAssetId: "broll-asset" }],
      });
      const { deps } = makeOrderTrackingDeps();

      const result = translateAITimelinePlan(plan, project, deps);
      await runModules(result).execute();

      expect(deps.addTrackAndClip.addTrack).not.toHaveBeenCalled();
      expect(deps.clip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "sub-existing" }));
      expect(deps.clip.addClip).toHaveBeenCalledWith(expect.objectContaining({ trackId: "overlay-existing" }));
    });

    it("undoing both the captions AND overlay modules removes BOTH tracks/clips they created, even though they're independent commands", async () => {
      const project = { tracks: [], clips: [], durationMs: 20_000 };
      const plan = emptyPlan({
        captions: [{ text: "Hello", startMs: 0, endMs: 1000 }],
        broll: [{ startMs: 0, endMs: 1000, trackHint: "broll", source: "stock", searchQuery: "city", resolvedAssetId: "broll-asset" }],
      });
      const { deps } = makeOrderTrackingDeps();

      const result = translateAITimelinePlan(plan, project, deps);
      expect(result.modules.map((m) => m.module).sort()).toEqual(["captions", "overlay"]);
      const run = runModules(result);
      await run.execute();
      await run.undo();

      expect(deps.addTrackAndClip.deleteClip).toHaveBeenCalledTimes(2);
      expect(deps.addTrackAndClip.removeTrack).toHaveBeenCalledTimes(2);
    });
  });
});
