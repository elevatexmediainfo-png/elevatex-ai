# Talking Head Architecture — a `sourceType`-pluggable pipeline

This document explains the seam Milestone 11 introduced so a future editor (Podcast, Webinar, Course, Interview, AI Shorts from raw footage, etc.) can be added as a new input modality without touching Scene rendering, the Timeline/Editor, the render Queue, the Credit Engine, the Provider abstraction, Versioning, or the Prompt system.

## The core idea

Every video this platform produces ends up as the same thing downstream: a `VideoProject` with some `Scene` rows, each with a `visualType`-driven asset decision, composited on a `Track`/`Clip` Timeline, rendered through the Generation Engine, billed through the Credit Engine. What differs between input modalities is only **how the Scenes get created** and **what a Scene's "render" means**.

`VideoProject.sourceType` is the discriminator:

```prisma
enum VideoProjectSourceType {
  GENERATED          // brief -> AI script -> deterministic scene-split
  TALKING_HEAD_UPLOAD // uploaded video -> transcript -> AI-planned scenes
}
```

Both producers terminate at the exact same `Scene` table. Nothing downstream of "a project now has some Scenes" branches on `sourceType` except in three places, listed below. Everything else — Timeline, Editor, Queue, Credits, Versioning, Prompt history — runs unmodified for both.

## The three places that actually branch on `sourceType`

### 1. Project + Scene creation (the producer)

| | `GENERATED` | `TALKING_HEAD_UPLOAD` |
|---|---|---|
| Entry route | `POST /api/videos` | `POST /api/videos/talking-head` |
| Input | brief (product/key message/offer/CTA) | an uploaded video `Asset` |
| Step 1 | `generateScript()` (LLM) | `transcribeAudio()` (Whisper/Mock) — `RenderJob{payload.kind:"transcribe"}` |
| Step 2 | `splitScriptIntoSceneTexts()` (deterministic `[HOOK]/[BODY]/[CTA]` marker split, `lib/scenes/engine.ts`) | `runContextAnalysisBatch()` + `runVisualPlanningBatch()` (LLM, batched) + `groupSegmentsIntoScenes()` (pure) — `RenderJob{payload.kind:"analyze"}` |
| Output | `Scene[]` (`DRAFT`, `visualType: null`) | `Scene[]` (`DRAFT`, `visualType` set from the Visual Planner) |

A future editor (say, Podcast) adds: one new `sourceType` enum value, one new entry route, and one new segment-grouping/scene-planning function mirroring `groupSegmentsIntoScenes()`. It does **not** need a new Scene table, a new Track/Clip model, a new Queue, or a new Credit mechanism.

### 2. Scene rendering — generate vs. resolve-existing-asset

`GENERATED` scenes always need their image/video/voice generated from scratch — there's no pre-existing footage. `TALKING_HEAD_UPLOAD` scenes are slices of footage that *already exists* (the uploaded source video) plus an optional overlay (B-roll/image/logo/etc.) that may or may not need generating.

`lib/render/pipeline.ts`'s `processSceneRenderJob()` has exactly one branch:

```ts
if (scene.visualType !== null) {
  await renderTalkingHeadScene(job, scene, project, storage, context);
  await tryFinalizeProject(project.id);
  return;
}
// ...falls through to the original GENERATED-flow rendering below, unmodified
```

`renderTalkingHeadScene()` calls the pure `selectAssetForScene()` waterfall (`lib/talking-head/asset-selector.ts`):

```
REUSE_EXISTING -> REUSE_BRAND -> REUSE_UPLOADED -> STOCK -> AI_IMAGE / AI_VIDEO
```

Only `AI_IMAGE`/`AI_VIDEO` decisions call `generateImage()`/`renderVideo()` (the same Generation Engine every other category goes through — failover/retry/timeout/cost/health for free). Every other decision copies an existing storage key — no provider call, no vendor cost, no credit charge. `AI_VIDEO` is only ever reachable when the admin-configurable `TALKING_HEAD_AI_VIDEO_GENERATION_ENABLED` flag is on; otherwise it downgrades to `AI_IMAGE`.

A future editor that also has "this asset already exists, don't regenerate it" semantics (e.g. a Podcast editor reusing a guest's headshot) would extend this same waterfall, not invent a second one.

### 3. Finalization — merge job vs. direct-to-completed

`GENERATED` scenes are independently rendered video clips that must be concatenated — that's what the merge `RenderJob` (`payload.kind` unset, `sceneId` null) does. `TALKING_HEAD_UPLOAD` scenes don't have independent clips to concatenate: they're all slices of **one shared source video** (sliced via `Clip.trimStartMs`) plus Timeline overlay clips on top. There is nothing to merge.

`tryFinalizeProject()` branches once, right after the atomic `mergeQueued` claim:

```ts
if (project.sourceType === "TALKING_HEAD_UPLOAD") {
  await finalizeTalkingHeadProject(project);
} else {
  await enqueueJob({ videoProjectId: project.id }); // unchanged merge-job path
}
```

`finalizeTalkingHeadProject()` calls `applyAutomaticEditingPlan()` (adds TEXT/IMAGE/VIDEO overlay clips to the Timeline from the visual plan + asset-selector decisions), then sets the project `COMPLETED` with `previewVideoUrl`/`masterVideoUrl` pointing straight at the source asset. The *real* compositing of base video + overlays only happens once, at Export time, through the Editor's already-existing `composeTimeline()` — deliberately not a second compositing engine.

## What's inherited for free (zero new code)

- **Scene rendering infrastructure**: retry/attempts, per-scene caching, `RenderJob` claim/complete/fail mechanics, pause/resume/cancel (these operate purely on `status`, never on `payload.kind`, so the new `"transcribe"`/`"analyze"` job kinds needed zero pause/resume/cancel changes).
- **Timeline/Editor**: `Track`/`Clip`, split/merge/duplicate clip math, the Caption Editor, the Media Library, AI Editing panel — all Scene/Asset-id-referencing, sourceType-agnostic.
- **Generation Engine**: failover, retry, timeout, health circuit-breaker, cost tracking, per-provider budget/rate-limit — Transcription got all of this for free by joining `GenerationCategory`.
- **Credit Engine**: `consumeCredits()` is generic over transaction type; Talking Head added `AI_GENERATION`/`EXPORT` types, not a new spending mechanism.
- **Versioning, Prompt history, Asset Library**: read/write the same tables Scene/Asset already populate.

## What a new editor needs to add

Using the Talking Head editor as the template, a future Podcast/Webinar/Course/Interview editor needs:

1. A new `VideoProjectSourceType` enum value.
2. A new project-creation route (its own input shape — e.g. an audio file + RSS metadata for Podcast).
3. A new "understand the input" step if the source isn't already structured text (e.g. transcription again, or an existing RSS transcript).
4. A new segment-grouping/scene-planning function mirroring `groupSegmentsIntoScenes()` — this is genuinely the one function that's different per modality; everything it produces (`Scene` rows with a `visualType`) is identical in shape to every other modality's output.
5. (Optional) A modality-specific asset-selector tier if the new input type has its own "this already exists, reuse it" case beyond what `selectAssetForScene()`'s waterfall already covers.
6. (Optional) A modality-specific finalization branch in `tryFinalizeProject()`, *only* if the new modality also can't use the merge job (most can — Talking Head's "one shared source video" case is the unusual one, not the norm).

Everything else in this document's "inherited for free" list applies unchanged.

## Known sharp edges for whoever adds the next modality

- **`TRANSCRIPTION` (and any new `GenerationCategory`/`ProviderCategory` added after the Admin Panel existed) has no legacy `SystemConfig` priority-list fallback** — `lib/providers/credentials.ts`'s `legacyPriorityList()` only returns `["mock"]` for the four categories that predate the Admin Panel (LLM/Image/Voice/Video). A new category needs an admin to explicitly enable a provider via `/admin/ai-providers` before it works at all, even in dev with Mock providers. Worth fixing globally (a bootstrap default) rather than re-discovering this per new category.
- **Credit boundary convention**: "everything free until the user explicitly commits to paid generation" (upload/transcribe/analyze/plan/estimate all free; only actual AI image/video generation and Export charge) is a deliberate UX decision specific to Talking Head's confirmed scope, not an architectural requirement — a future editor should make its own explicit free/paid boundary decision and document it, the same way this one did.
