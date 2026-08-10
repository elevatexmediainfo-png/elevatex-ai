import { beforeEach, describe, expect, it, vi } from "vitest";

// Founder request (2026-07-30) — module selection. Proves processAiEditJob
// actually SKIPS work for deselected modules (not just that the UI hides
// unwanted output) — scene-removal's own proposer/merge functions and
// planTimeline itself must never be called when nothing that needs them
// was selected, and planTimeline's own 7-section output must be trimmed to
// only the selected sections before it reaches the assembled plan.

const aiEditJobFindUniqueMock = vi.fn();
const aiEditJobUpdateManyMock = vi.fn();
const aiEditJobUpdateMock = vi.fn();
const editorProjectFindUniqueMock = vi.fn();
const editorAssetFindFirstMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiEditJob: {
      findUnique: (...args: unknown[]) => aiEditJobFindUniqueMock(...args),
      updateMany: (...args: unknown[]) => aiEditJobUpdateManyMock(...args),
      update: (...args: unknown[]) => aiEditJobUpdateMock(...args),
    },
    editorProject: { findUnique: (...args: unknown[]) => editorProjectFindUniqueMock(...args) },
    editorAsset: { findFirst: (...args: unknown[]) => editorAssetFindFirstMock(...args) },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

const getStorageProviderMock = vi.fn();
vi.mock("@/lib/providers/storage", () => ({ getStorageProvider: () => getStorageProviderMock() }));
vi.mock("@/lib/providers/storage/absolute-url", () => ({ resolveAbsoluteUrl: (url: string) => url }));

const transcribeAudioMock = vi.fn();
vi.mock("@/lib/generation/transcription", () => ({ transcribeAudio: (...args: unknown[]) => transcribeAudioMock(...args) }));
vi.mock("@/lib/generation/types", () => ({ MOCK_PROVIDER_ID: "mock" }));

const analyzeVideoMock = vi.fn();
vi.mock("@/lib/generation/video-understanding", () => ({ analyzeVideo: (...args: unknown[]) => analyzeVideoMock(...args) }));

const planTimelineMock = vi.fn();
vi.mock("@/lib/generation/reasoning", () => ({ planTimeline: (...args: unknown[]) => planTimelineMock(...args) }));

// AI Video Director (2026-08-07) — mocked at the orchestrator boundary
// (not the individual planStory/planCaptions/... calls) so these
// integration-point tests stay focused on ai-edit-jobs.ts's own wiring
// (does it call the Director pipeline when the flag is on, does it
// persist story/v2 qualityScores/cost correctly) rather than
// re-exercising the orchestrator's own internal logic, which already has
// its own dedicated, thorough test suite (director/orchestrator.test.ts).
const runDirectorPipelineMock = vi.fn();
vi.mock("./director/orchestrator", () => ({ runDirectorPipeline: (...args: unknown[]) => runDirectorPipelineMock(...args) }));

const resolveBrollItemsMock = vi.fn();
vi.mock("./ai-broll-resolver", () => ({ resolveBrollItems: (...args: unknown[]) => resolveBrollItemsMock(...args) }));

const resolveTimelinePlanAssetsMock = vi.fn();
vi.mock("./ai-asset-resolver", () => ({ resolveTimelinePlanAssets: (...args: unknown[]) => resolveTimelinePlanAssetsMock(...args) }));

vi.mock("@/app/editor/[projectId]/ai-timeline-translator", () => ({
  computeSurvivingSegments: () => [{ startMs: 0, endMs: 1000 }],
  normalizeSceneRemovalWindows: (w: unknown) => w,
}));

const getConfigMock = vi.fn();
vi.mock("@/lib/admin/config", () => ({ getConfig: (...args: unknown[]) => getConfigMock(...args) }));

vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const consumeCreditsMock = vi.fn();
vi.mock("@/lib/credits/engine", () => ({ consumeCredits: (...args: unknown[]) => consumeCreditsMock(...args) }));
vi.mock("@/lib/credits/video-actions", () => ({
  checkVideoActionAccess: vi.fn(),
  convertUsdToCredits: () => 0,
}));

const proposeSceneRemovalsMock = vi.fn();
const mergeSceneRemovalCandidatesMock = vi.fn();
vi.mock("./ai-scene-removal-proposer", () => ({
  proposeSceneRemovals: (...args: unknown[]) => proposeSceneRemovalsMock(...args),
  mergeSceneRemovalCandidates: (...args: unknown[]) => mergeSceneRemovalCandidatesMock(...args),
}));

const { processAiEditJob } = await import("./ai-edit-jobs");

const BASE_JOB = {
  id: "job_1",
  projectId: "proj_1",
  userId: "user_1",
  sourceAssetId: "asset_1",
  status: "UPLOADING",
  stylePreset: null,
  brollDensity: null,
  brollStockOnly: true,
  brollRelevanceFallbackThreshold: 0.5,
  script: null,
};

// TASK 12 (2026-08-07) — the captions here deliberately span nearly all of
// the mocked asset's 10s duration (editorAssetFindFirstMock's
// durationSeconds: 10 below), not just a token 500ms — scoreAiTimelinePlan's
// caption-coverage heuristic would otherwise score this mock plan low
// enough to trip the quality-triggered retry (ai-edit-jobs.ts calling
// planTimeline a SECOND time), which is real, correct, intentional behavior
// for a genuinely thin plan but not what these module-selection tests are
// about — they need planTimeline to be called exactly once.
//
// Visual-pacing upgrade (2026-08-09) — deliberately 4 SHORT contiguous
// captions (each <= the real AI_EDIT_MAX_VISUAL_DWELL_MS default of
// 2500ms) rather than one long ~9500ms caption: Option B now caps how
// much continuous coverage CREDIT any single long caption can provide, so
// one giant caption would itself get flagged as a dead-screen gap past
// its cap point — a real, intentional behavior change these tests aren't
// about. Several short, individually-uncapped captions still add up to
// the same full coverage these tests actually need.
function mockFullPlanResult() {
  planTimelineMock.mockResolvedValue({
    captions: [
      { text: "hi there this is a great test", startMs: 0, endMs: 2375 },
      { text: "hi there this is a great test", startMs: 2375, endMs: 4750 },
      { text: "hi there this is a great test", startMs: 4750, endMs: 7125 },
      { text: "hi there this is a great test", startMs: 7125, endMs: 9500 },
    ],
    zoom: [{ startMs: 0, endMs: 500, scaleFrom: 100, scaleTo: 120 }],
    broll: [{ startMs: 0, endMs: 500, trackHint: "broll", source: "stock", searchQuery: "office" }],
    stickers: [{ startMs: 0, endMs: 500, assetQuery: "smile" }],
    music: { searchQuery: "upbeat", duckingEnabled: true },
    sfx: [{ startMs: 0, endMs: 500, atMs: 0, assetQuery: "whoosh" }],
    transitions: [{ betweenClipIds: ["clip_a", "clip_b"], type: "CROSSFADE", durationMs: 400 }],
    costUsd: 0.05,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  editorProjectFindUniqueMock.mockResolvedValue({ id: "proj_1", aspectRatio: "RATIO_9_16" });
  editorAssetFindFirstMock.mockResolvedValue({ id: "asset_1", status: "READY", kind: "AUDIO", durationSeconds: 10, storageKey: "k" });
  getStorageProviderMock.mockResolvedValue({ getPublicUrl: () => "https://example.com/a.mp4" });
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
  transcribeAudioMock.mockResolvedValue({ providerId: "assemblyai", words: [], durationSeconds: 10, costUsd: 0.01 });
  // AI Video Director (2026-08-07) — this whole test file exercises the
  // LEGACY single-call planTimeline() path; the flag must resolve falsy
  // here or every test below would silently route into the (unmocked)
  // Director pipeline instead. Every OTHER config key keeps the
  // pre-existing blanket 700 default — none of these tests care about
  // its exact value beyond "some plausible number."
  //
  // Visual-pacing upgrade (2026-08-09) — the 2 dwell-related keys are
  // pinned to their REAL admin-config defaults (not the blanket 700)
  // specifically because 700ms is smaller than any realistic caption
  // chunk used by these fixtures, which would trigger caption-coverage
  // capping (Option B) far more aggressively than real production ever
  // would and break fixtures that have nothing to do with this behavior.
  getConfigMock.mockImplementation((key: string) =>
    Promise.resolve(
      key === "AI_EDIT_DIRECTOR_PIPELINE_ENABLED"
        ? false
        : key === "AI_EDIT_NO_DEAD_SCREEN_GAP_THRESHOLD_MS"
          ? 1750
          : key === "AI_EDIT_MAX_VISUAL_DWELL_MS"
            ? 2500
            : 700
    )
  );
  proposeSceneRemovalsMock.mockReturnValue([{ startMs: 0, endMs: 200, reason: "silence" }]);
  mergeSceneRemovalCandidatesMock.mockReturnValue([{ startMs: 0, endMs: 200, reason: "silence" }]);
  resolveTimelinePlanAssetsMock.mockResolvedValue({ stickers: [], music: undefined, sfx: [] });
  resolveBrollItemsMock.mockResolvedValue([]);
  transactionMock.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
    const tx = {
      aiEditJob: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ status: "BUILDING_TIMELINE" }),
        update: (...args: unknown[]) => aiEditJobUpdateMock(...args),
      },
    };
    await cb(tx);
  });
});

describe("processAiEditJob — module selection", () => {
  it("with no selectedModules (undefined/null), runs every module — unchanged pre-existing behavior", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    mockFullPlanResult();

    await processAiEditJob("job_1");

    expect(proposeSceneRemovalsMock).toHaveBeenCalledTimes(1);
    expect(planTimelineMock).toHaveBeenCalledTimes(1);
    // broll/stickers/music/sfx are proposed AND sent to resolution — proves
    // every module's proposal reached the pipeline (resolved counts aren't
    // this test's concern, only whether module-gating let them through).
    expect(resolveBrollItemsMock).toHaveBeenCalledTimes(1);
    expect(resolveTimelinePlanAssetsMock).toHaveBeenCalledTimes(1);
    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    expect(savedPlan.sceneRemoval).toHaveLength(1);
    expect(savedPlan.captions).toHaveLength(4); // mockFullPlanResult's 4 short contiguous captions (see its own doc comment)
    expect(savedPlan.zoom).toHaveLength(1); // fully covered by captions — no dead-screen gap, no auto-fix added
    expect(savedPlan.transitions).toHaveLength(1);
  });

  it("with only captions selected: calls planTimeline (unavoidable — captions come from it) but skips scene-removal entirely and discards every other section", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: ["captions"] });
    mockFullPlanResult();

    await processAiEditJob("job_1");

    // Skip every other module — scene-removal's own proposer never runs at all.
    expect(proposeSceneRemovalsMock).not.toHaveBeenCalled();
    expect(mergeSceneRemovalCandidatesMock).not.toHaveBeenCalled();

    // planTimeline (the ONE shared reasoning call that produces captions)
    // still runs exactly once — no duplicated caption generation, no
    // second/separate call.
    expect(planTimelineMock).toHaveBeenCalledTimes(1);

    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    expect(savedPlan.sceneRemoval).toEqual([]);
    expect(savedPlan.captions).toHaveLength(4); // mockFullPlanResult's 4 short contiguous captions (see its own doc comment)
    expect(savedPlan.zoom).toEqual([]);
    expect(savedPlan.broll).toEqual([]);
    expect(savedPlan.stickers).toEqual([]);
    expect(savedPlan.music).toBeUndefined();
    expect(savedPlan.sfx).toEqual([]);
    expect(savedPlan.transitions).toEqual([]);
  });

  it("with only sceneRemoval selected: runs scene-removal but skips planTimeline entirely (no captions/zoom/etc. needed)", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: ["sceneRemoval"] });

    await processAiEditJob("job_1");

    expect(proposeSceneRemovalsMock).toHaveBeenCalledTimes(1);
    expect(planTimelineMock).not.toHaveBeenCalled();

    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    expect(savedPlan.sceneRemoval).toHaveLength(1);
    expect(savedPlan.captions).toEqual([]);
  });

  it("resolveBrollItems/resolveTimelinePlanAssets are never called when broll/stickers/music/sfx are all deselected", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: ["captions", "zoom"] });
    mockFullPlanResult();

    await processAiEditJob("job_1");

    expect(resolveBrollItemsMock).not.toHaveBeenCalled();
    expect(resolveTimelinePlanAssetsMock).not.toHaveBeenCalled();
  });
});

// Fix (2026-08-12) — GPT's own native TASK 4 sticker proposals were never
// checked against anything; real evidence showed the same literal sticker
// query proposed repeatedly for similar content. A small, local,
// deterministic dedup collapses an exact (case-insensitive) repeat within
// one job's own final sticker list down to its first occurrence, right
// before resolution.
describe("processAiEditJob — native sticker query dedup", () => {
  const DENSE_CAPTIONS = [
    { text: "hi there this is a great test", startMs: 0, endMs: 2375 },
    { text: "hi there this is a great test", startMs: 2375, endMs: 4750 },
    { text: "hi there this is a great test", startMs: 4750, endMs: 7125 },
    { text: "hi there this is a great test", startMs: 7125, endMs: 9500 },
  ];

  it("collapses an exact (case-insensitive) duplicate sticker query within the same job down to its first occurrence before resolution", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    planTimelineMock.mockResolvedValue({
      captions: DENSE_CAPTIONS,
      zoom: [],
      broll: [],
      stickers: [
        { startMs: 0, endMs: 500, assetQuery: "house icon" },
        { startMs: 5000, endMs: 5500, assetQuery: "House Icon" }, // same query, different case
      ],
      sfx: [],
      transitions: [],
      costUsd: 0.02,
    });

    await processAiEditJob("job_1");

    expect(resolveTimelinePlanAssetsMock).toHaveBeenCalledTimes(1);
    const stickersPassedToResolution = resolveTimelinePlanAssetsMock.mock.calls[0][0].stickers;
    expect(stickersPassedToResolution).toHaveLength(1);
    expect(stickersPassedToResolution[0].assetQuery).toBe("house icon");
  });

  it("never removes genuinely DIFFERENT sticker queries within the same job", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    planTimelineMock.mockResolvedValue({
      captions: DENSE_CAPTIONS,
      zoom: [],
      broll: [],
      stickers: [
        { startMs: 0, endMs: 500, assetQuery: "house icon" },
        { startMs: 5000, endMs: 5500, assetQuery: "design icon" },
      ],
      sfx: [],
      transitions: [],
      costUsd: 0.02,
    });

    await processAiEditJob("job_1");

    const stickersPassedToResolution = resolveTimelinePlanAssetsMock.mock.calls[0][0].stickers;
    expect(stickersPassedToResolution).toHaveLength(2);
  });

  // Follow-up review (2026-08-12) — "which one survives when a native
  // proposal and an auto-inserted item share a query?" Proven by
  // construction, not just documentation: `stickers` is assigned from the
  // model's own native proposals FIRST (`stickers = best.stickers` /
  // `stickers = result.stickers`), and the no-dead-screen auto-fixer's
  // own items are APPENDED after (`stickers = [...stickers,
  // ...fixes.stickers]`) — dedupeStickersByQuery keeps the FIRST
  // occurrence of a repeated query, so the native proposal always wins by
  // construction, with no extra logic needed. This test forces a REAL
  // collision end-to-end (not a synthetic array) — a 5s uncovered gap
  // (5000-10000ms) subdivides into two 2500ms sub-gaps under this file's
  // mocked AI_EDIT_MAX_VISUAL_DWELL_MS (2500); the first sub-gap rotates
  // to "motion_graphic", the second to "sticker" (decideFixForGap's own
  // alternation), and both captions bracketing the gap mention "Ghar" so
  // rule 2 derives the SAME "house construction" concept the native
  // sticker below also (coincidentally, on purpose for this test) uses.
  it("when a native sticker and an auto-inserted sticker end up with the SAME query, the NATIVE one survives (proven via a real end-to-end collision, not a synthetic array)", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    editorAssetFindFirstMock.mockResolvedValue({ id: "asset_1", status: "READY", kind: "AUDIO", durationSeconds: 15, storageKey: "k" });
    planTimelineMock.mockResolvedValue({
      captions: [
        { text: "Khud Ka Ghar", startMs: 0, endMs: 5000 },
        { text: "Aapke Ghar Tak", startMs: 10_000, endMs: 15_000 },
      ],
      zoom: [],
      broll: [],
      stickers: [{ startMs: 0, endMs: 500, assetQuery: "house construction" }], // native — deliberately the SAME concept rule 2 will derive for the gap below
      sfx: [],
      transitions: [],
      costUsd: 0.02,
    });
    resolveTimelinePlanAssetsMock.mockImplementation((plan: { stickers: unknown[]; music: unknown; sfx: unknown[] }) => Promise.resolve(plan));

    await processAiEditJob("job_1");

    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    // Confirms a real collision actually happened (the auto-fixer really
    // did produce a sticker) — otherwise this test would trivially pass
    // for the wrong reason.
    const stickerQueries = savedPlan.stickers.map((s: { assetQuery?: string }) => s.assetQuery);
    expect(stickerQueries.filter((q: string) => q === "house construction").length).toBeGreaterThanOrEqual(1);

    // After dedup: exactly one "house construction" sticker survives, and
    // it's the NATIVE one (no `reason`/`autoInserted` — those are only
    // ever set by the auto-fixer).
    const survivingHouseConstructionStickers = savedPlan.stickers.filter((s: { assetQuery?: string }) => s.assetQuery === "house construction");
    expect(survivingHouseConstructionStickers).toHaveLength(1);
    expect(survivingHouseConstructionStickers[0].reason).toBeUndefined();
    expect(survivingHouseConstructionStickers[0].autoInserted).toBeUndefined();
  });
});

// TASK 12 (2026-08-07 — "quality scoring... if score is poor, automatically
// regenerate only that section, never regenerate the whole edit"). Real,
// end-to-end proof of the bounded single retry: a genuinely thin first
// planTimeline() response (one 300ms caption in a 10s clip — near-zero
// coverage) triggers exactly ONE extra call, and the higher-scoring of
// the two attempts is what actually gets saved.
describe("processAiEditJob — quality-triggered retry", () => {
  it("retries planTimeline exactly once when the first attempt scores poorly, and keeps the higher-scoring attempt", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    planTimelineMock
      .mockResolvedValueOnce({
        captions: [{ text: "hi", startMs: 0, endMs: 300 }], // near-zero coverage of a 10s clip -> low score
        zoom: [],
        broll: [],
        stickers: [],
        sfx: [],
        transitions: [],
        costUsd: 0.02,
      })
      .mockResolvedValueOnce({
        captions: [{ text: "a much better, well covered caption line here", startMs: 0, endMs: 9500 }],
        zoom: [],
        broll: [],
        stickers: [],
        sfx: [],
        transitions: [],
        costUsd: 0.02,
      });

    await processAiEditJob("job_1");

    expect(planTimelineMock).toHaveBeenCalledTimes(2);
    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    // The SECOND (higher-scoring) attempt's captions are what got saved.
    expect(savedPlan.captions[0].text).toBe("a much better, well covered caption line here");
    expect(savedPlan.qualityScores).toBeDefined();
    expect(savedPlan.qualityScores.editingScore).toBeGreaterThanOrEqual(55);
  });

  it("does NOT retry when the first attempt already scores well", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    mockFullPlanResult();

    await processAiEditJob("job_1");

    expect(planTimelineMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the FIRST attempt (never throws the job) when the retry itself fails", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    planTimelineMock
      .mockResolvedValueOnce({ captions: [{ text: "hi", startMs: 0, endMs: 300 }], zoom: [], broll: [], stickers: [], sfx: [], transitions: [], costUsd: 0.02 })
      .mockRejectedValueOnce(new Error("vendor timeout on retry"));

    await processAiEditJob("job_1");

    expect(planTimelineMock).toHaveBeenCalledTimes(2);
    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    expect(savedPlan.captions[0].text).toBe("hi");
    // The job still reaches READY_FOR_REVIEW — a failed retry is never
    // fatal to an already-successful first attempt.
    expect(aiEditJobUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READY_FOR_REVIEW" }) }));
  });

  // Production fix (2026-08-08, "B-roll still not appearing") — the real
  // production case this whole investigation traced: planTimeline fails
  // COMPLETELY (e.g. every configured REASONING provider times out, no
  // fallback provider) — not a low-score retry, the very first attempt
  // itself throws. Live-reproduced and confirmed via a real job's
  // persisted timelinePlan.broll === 0 (not degraded — literally zero,
  // and the no-dead-screen fallback never ran either, since it used to
  // live inside the same try block that threw). This proves both halves
  // of the fix: (1) the job still reaches READY_FOR_REVIEW with an
  // unambiguous "generated ZERO creative content" planningError rather
  // than a generic one, and (2) the no-dead-screen pass now runs anyway
  // and fills in real fallback b-roll/zoom/stickers despite zero GPT
  // output.
  it("a TOTAL planTimeline failure (both attempts) still gets the no-dead-screen fallback, with an unambiguous planningError", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    planTimelineMock.mockRejectedValue(new Error('All REASONING providers failed for "plan_timeline": gpt5 (2 attempt(s): Timed out after 60000ms)'));
    // Override the file-wide "always resolves empty" default just for this
    // test — the auto-fixer's own OUTPUT is what's under test here, not
    // stock resolution (which has its own dedicated test suite).
    resolveBrollItemsMock.mockImplementation((items: unknown[]) => Promise.resolve(items));

    await processAiEditJob("job_1");

    expect(aiEditJobUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READY_FOR_REVIEW" }) }));
    const savedData = aiEditJobUpdateMock.mock.calls[0][0].data;
    const savedPlan = savedData.timelinePlan;

    expect(savedPlan.captions).toEqual([]); // genuinely no captions — GPT never returned, and this test's own default transcript has zero real words for the new fallback to chunk from (see the dedicated fallback test below)
    expect(savedData.planningError).toContain("ANY creative timeline content");
    expect(savedData.planningError).toContain("Timed out after 60000ms");

    // Test 4 (visual-pacing upgrade, 2026-08-09) — a total planning
    // failure must produce MULTIPLE visual interventions (subdivideGap
    // splits the one huge uncovered stretch into several sub-gaps), never
    // just the old 1-2-clip fallback.
    const autoInsertedCount = savedPlan.broll.length + savedPlan.zoom.length + savedPlan.stickers.length;
    expect(autoInsertedCount).toBeGreaterThan(2);
    const anyAutoInserted =
      savedPlan.broll.some((b: { autoInserted?: boolean }) => b.autoInserted) ||
      savedPlan.zoom.some((z: { reason?: string }) => z.reason?.includes("no-dead-screen")) ||
      savedPlan.stickers.some((s: { reason?: string }) => s.reason?.includes("no-dead-screen"));
    expect(anyAutoInserted).toBe(true);
  });

  // Fix (2026-08-12) — the test above uses this file's default empty
  // transcript (transcribeAudioMock's `words: []`), under which the new
  // caption fallback correctly stays a no-op (nothing to chunk from) —
  // that test's own `captions: []` assertion is untouched by this fix.
  // THIS test uses a REAL, non-empty transcript (matching real production
  // jobs, which always have real transcript words) to prove the actual
  // new behavior: a total planTimeline failure now produces deterministic
  // fallback captions from those real words, while planningError remains
  // fully present and unambiguous (the job is never made to look like it
  // succeeded normally).
  it("a TOTAL planTimeline failure with a REAL (non-empty) transcript now produces deterministic fallback captions, while planningError remains present", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    transcribeAudioMock.mockResolvedValue({
      providerId: "assemblyai",
      words: [
        { word: "hello", startMs: 0, endMs: 300 },
        { word: "this", startMs: 300, endMs: 500 },
        { word: "is", startMs: 500, endMs: 650 },
        { word: "a", startMs: 650, endMs: 700 },
        { word: "real", startMs: 700, endMs: 950 },
        { word: "transcript", startMs: 950, endMs: 1400 },
      ],
      durationSeconds: 10,
      costUsd: 0.01,
    });
    planTimelineMock.mockRejectedValue(new Error('All REASONING providers failed for "plan_timeline": gpt5 (2 attempt(s): Timed out after 60000ms)'));
    resolveBrollItemsMock.mockImplementation((items: unknown[]) => Promise.resolve(items));

    await processAiEditJob("job_1");

    const savedData = aiEditJobUpdateMock.mock.calls[0][0].data;
    const savedPlan = savedData.timelinePlan;

    // Fallback captions were produced from the real transcript words —
    // never empty when real words existed.
    expect(savedPlan.captions.length).toBeGreaterThan(0);
    expect(savedPlan.captions[0].text.toLowerCase()).toContain("hello");

    // planningError is still fully present and unambiguous — the job is
    // NOT made to look like a normal success.
    expect(savedData.planningError).toContain("ANY creative timeline content");
    expect(savedData.planningError).toContain("Timed out after 60000ms");
  });

  // Successful-planning path must stay completely untouched by this fix —
  // the fallback only ever runs from inside the catch block.
  it("a SUCCESSFUL planTimeline call is never touched by the new caption fallback, even with a real transcript present", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    transcribeAudioMock.mockResolvedValue({
      providerId: "assemblyai",
      words: [{ word: "hello", startMs: 0, endMs: 300 }],
      durationSeconds: 10,
      costUsd: 0.01,
    });
    mockFullPlanResult();

    await processAiEditJob("job_1");

    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    // The model's own real captions (mockFullPlanResult's 4 short ones),
    // never the word-chunk fallback text.
    expect(savedPlan.captions).toHaveLength(4);
    expect(savedPlan.captions[0].text).toBe("hi there this is a great test");
  });

  // Follow-up review (2026-08-12) — explicit verification: the fallback
  // must respect module selection exactly like every other section
  // (`wantsModule("captions")`), even on a total planning failure with a
  // real, non-empty transcript available to chunk from.
  it("does NOT produce fallback captions when the captions module was deselected, even on total planning failure with a real transcript", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: ["broll"] });
    transcribeAudioMock.mockResolvedValue({
      providerId: "assemblyai",
      words: [{ word: "hello", startMs: 0, endMs: 300 }],
      durationSeconds: 10,
      costUsd: 0.01,
    });
    planTimelineMock.mockRejectedValue(new Error("total failure"));
    resolveBrollItemsMock.mockImplementation((items: unknown[]) => Promise.resolve(items));

    await processAiEditJob("job_1");

    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    expect(savedPlan.captions).toEqual([]);
  });

  // Test 6 (visual-pacing upgrade, 2026-08-09) — a genuinely successful
  // GPT plan (2 real, SHORT captions bookending one clean internal gap)
  // must get that gap cleanly subdivided WITHOUT disturbing GPT's own
  // real content, and without spamming excessive/duplicate fixes on top
  // of what GPT already covered. Both captions are deliberately <= the
  // real AI_EDIT_MAX_VISUAL_DWELL_MS default (2500ms) so neither is
  // itself subject to Option B's caption-coverage cap — that behavior has
  // its own dedicated tests in visual-coverage.test.ts; this test isolates
  // subdivision specifically.
  it("a normal successful GPT plan with one real internal gap gets clean subdivided fill-in, without disturbing GPT's own real items", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    editorAssetFindFirstMock.mockResolvedValue({ id: "asset_1", status: "READY", kind: "AUDIO", durationSeconds: 20, storageKey: "k" });
    planTimelineMock.mockResolvedValue({
      captions: [
        { text: "a solid opening line", startMs: 0, endMs: 2000 },
        { text: "a solid closing line", startMs: 18_000, endMs: 20_000 }, // real 16s internal gap: 2000-18000
      ],
      zoom: [],
      broll: [],
      stickers: [],
      sfx: [],
      transitions: [],
      costUsd: 0.03,
    });
    resolveBrollItemsMock.mockImplementation((items: unknown[]) => Promise.resolve(items));
    // Override the file-wide "always resolves empty stickers" default —
    // otherwise any auto-fixed STICKER events would be silently dropped
    // before this test could count them, undercounting the real
    // subdivision output for a reason unrelated to what's under test here.
    resolveTimelinePlanAssetsMock.mockImplementation((plan: { stickers: unknown[]; music: unknown; sfx: unknown[] }) => Promise.resolve(plan));

    await processAiEditJob("job_1");

    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    // GPT's own 2 real captions are completely untouched.
    expect(savedPlan.captions).toHaveLength(2);
    expect(savedPlan.captions[0].text).toBe("a solid opening line");
    expect(savedPlan.captions[1].text).toBe("a solid closing line");

    // The real 16s internal gap gets filled with MULTIPLE subdivided
    // auto-fixes (max dwell 2500ms -> ceil(16000/2500) = 7 slices), not
    // one giant fix spanning the whole stretch.
    const autoInsertedBroll = savedPlan.broll.filter((b: { autoInserted?: boolean }) => b.autoInserted);
    const autoInsertedZoom = savedPlan.zoom.filter((z: { reason?: string }) => z.reason?.includes("no-dead-screen"));
    const autoInsertedStickers = savedPlan.stickers.filter((s: { reason?: string }) => s.reason?.includes("no-dead-screen"));
    const totalAutoInserted = autoInsertedBroll.length + autoInsertedZoom.length + autoInsertedStickers.length;
    expect(totalAutoInserted).toBe(7);

    // No auto-fix overlaps the real GPT-covered spans (0-2000, 18000-20000),
    // and none exceeds the configured max dwell (2500ms).
    const allAutoFixed = [...autoInsertedBroll, ...autoInsertedZoom, ...autoInsertedStickers] as { startMs: number; endMs: number }[];
    for (const fix of allAutoFixed) {
      const overlapsRealCoverage = fix.startMs < 2000 || fix.endMs > 18_000;
      expect(overlapsRealCoverage).toBe(false);
      expect(fix.endMs - fix.startMs).toBeLessThanOrEqual(2500);
    }
  });
});

// AI Video Director (2026-08-07) — the integration point itself: does
// ai-edit-jobs.ts correctly branch on AI_EDIT_DIRECTOR_PIPELINE_ENABLED,
// call the Director pipeline instead of legacy planTimeline when it's on,
// and persist its story/v2-qualityScores/cost onto the saved plan? The
// orchestrator's own internal logic (agent ordering, the retry loop,
// stagnation detection, etc.) is NOT re-tested here — see
// director/orchestrator.test.ts for that.
describe("processAiEditJob — AI Video Director pipeline (flag on)", () => {
  const DIRECTOR_RESULT = {
    captions: [{ text: "director caption", startMs: 0, endMs: 9500 }],
    zoom: [{ startMs: 0, endMs: 500, scaleFrom: 100, scaleTo: 112 }],
    broll: [{ startMs: 0, endMs: 500, trackHint: "broll", source: "stock", searchQuery: "office" }],
    stickers: [],
    transitions: [],
    music: undefined,
    sfx: [],
    story: { beats: [{ kind: "hook", startMs: 0, endMs: 500, description: "opening" }], hookText: "director hook", retentionRisks: [] },
    scores: {
      captionScore: 90, brollScore: 90, musicScore: 100, sfxScore: 100, zoomScore: 90, visualVarietyScore: 90, editingRhythmScore: 90,
      hookScore: 90, retentionScore: 90, storyScore: 90,
      overallScore: 92, thresholdMet: true, iterations: 1, weakCategoriesFinal: [],
    },
    reasoningCostUsd: 0.2,
    warnings: [],
    iterationHistory: [],
  };

  beforeEach(() => {
    getConfigMock.mockImplementation((key: string) => Promise.resolve(key === "AI_EDIT_DIRECTOR_PIPELINE_ENABLED" ? true : 700));
    runDirectorPipelineMock.mockResolvedValue(DIRECTOR_RESULT);
  });

  it("calls runDirectorPipeline instead of planTimeline, and persists story + v2 qualityScores + cost onto the saved plan", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });

    await processAiEditJob("job_1");

    expect(runDirectorPipelineMock).toHaveBeenCalledTimes(1);
    expect(planTimelineMock).not.toHaveBeenCalled();

    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    expect(savedPlan.captions[0].text).toBe("director caption");
    expect(savedPlan.story.hookText).toBe("director hook");
    expect(savedPlan.qualityScores.overallScore).toBe(92);
    expect(savedPlan.qualityScores.thresholdMet).toBe(true);
    expect(savedPlan.cost.reasoningUsd).toBeCloseTo(0.2);
    // The job still reaches READY_FOR_REVIEW on the Director path.
    expect(aiEditJobUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READY_FOR_REVIEW" }) }));
  });

  it("a Director pipeline failure is non-fatal — job continues with sceneRemoval-only, planningError surfaced", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    runDirectorPipelineMock.mockRejectedValue(new Error("director pipeline blew up"));

    await processAiEditJob("job_1");

    expect(aiEditJobUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READY_FOR_REVIEW" }) }));
    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    expect(savedPlan.captions).toEqual([]);
  });

  // Production fix (2026-08-08, "B-roll still not appearing") — real bug,
  // live-reproduced: a TOTAL Director pipeline failure used to skip the
  // deterministic no-dead-screen auto-fixer entirely (it lived inside the
  // same try block that threw), leaving timelinePlan.broll/zoom/stickers
  // all genuinely empty with zero fallback. It's now moved to run
  // unconditionally after the Director/legacy branch, regardless of
  // success or failure.
  it("a TOTAL Director pipeline failure still gets the no-dead-screen fallback — b-roll is not silently zero", async () => {
    aiEditJobFindUniqueMock.mockResolvedValue({ ...BASE_JOB, selectedModules: null });
    runDirectorPipelineMock.mockRejectedValue(new Error("director pipeline blew up"));
    resolveBrollItemsMock.mockImplementation((items: unknown[]) => Promise.resolve(items));

    await processAiEditJob("job_1");

    const savedPlan = aiEditJobUpdateMock.mock.calls[0][0].data.timelinePlan;
    expect(savedPlan.captions).toEqual([]); // genuinely no captions — GPT never ran
    // Test 4 (visual-pacing upgrade, 2026-08-09) — same requirement as the
    // legacy path's own version of this test: multiple visual
    // interventions, never just the old 1-2-clip fallback.
    const autoInsertedCount = savedPlan.broll.length + savedPlan.zoom.length + savedPlan.stickers.length;
    expect(autoInsertedCount).toBeGreaterThan(2);
    const anyAutoInserted =
      savedPlan.broll.some((b: { autoInserted?: boolean }) => b.autoInserted) ||
      savedPlan.zoom.some((z: { reason?: string }) => z.reason?.includes("no-dead-screen")) ||
      savedPlan.stickers.some((s: { reason?: string }) => s.reason?.includes("no-dead-screen"));
    expect(anyAutoInserted).toBe(true);
  });
});
