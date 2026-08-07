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

// TASK 12 (2026-08-07) — the caption here deliberately spans most of the
// mocked asset's 10s duration (editorAssetFindFirstMock's durationSeconds:
// 10 below), not just a token 500ms — scoreAiTimelinePlan's caption-
// coverage heuristic would otherwise score this mock plan low enough to
// trip the new quality-triggered retry (ai-edit-jobs.ts calling
// planTimeline a SECOND time), which is real, correct, intentional
// behavior for a genuinely thin plan but not what these module-selection
// tests are about — they need planTimeline to be called exactly once.
function mockFullPlanResult() {
  planTimelineMock.mockResolvedValue({
    captions: [{ text: "hi there this is a great test", startMs: 0, endMs: 9500 }],
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
  getConfigMock.mockResolvedValue(700);
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
    expect(savedPlan.captions).toHaveLength(1);
    expect(savedPlan.zoom).toHaveLength(1);
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
    expect(savedPlan.captions).toHaveLength(1);
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
});
