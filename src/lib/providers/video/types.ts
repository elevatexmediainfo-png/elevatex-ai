import type { GenerationProvider } from "@/lib/generation/types";

export interface VideoRenderRequest {
  script: string;
  /** Things to steer the render away from. Supported by some adapters (e.g. Replicate text-to-video models); silently ignored where the vendor API has no such parameter. */
  negativePrompt?: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  durationSeconds: number;
  voiceoverUrl?: string;
  templateRef?: string;
  /** Output resolution tier — admin-configurable (PREVIEW_QUALITY/FINAL_QUALITY). */
  quality: "480p" | "720p" | "1080p" | "4K";
  /** Burned-in watermark text for the preview pass; omitted entirely for the master pass. */
  watermarkText?: string;
  /** AI Video Phase 2 — optional starting frame for image-to-video (confirmed working against Veo 3.1's `instances[0].image.inlineData`). Raw bytes, not a URL — the caller resolves them from storage before this reaches a provider, same as every other request field here being an already-resolved primitive rather than a fetchable reference. Silently ignored by adapters with no image-to-video support. */
  startImage?: { mimeType: string; data: string };
}

export interface VideoRenderResult {
  /** The clean, full-quality master asset — never given directly to a client. */
  videoUrl: string;
  durationSeconds: number;
  providerRef?: string;
  usage?: { seconds?: number };
}

// renderVideo()/mergeSceneVideos()/composeTimeline() (lib/generation/video.ts)
// return this PLUS a `providerId` — attached generically by
// runGeneration()'s own success path (lib/generation/engine.ts), not by any
// video-specific code — identifying which provider actually served the
// result. Compare against MOCK_PROVIDER_ID (lib/generation/types.ts) before
// charging credits for a "successful" generation: the failover chain can
// silently resolve to the mock placeholder, and a caller with no way to
// distinguish that from a real vendor result would charge full price for a
// canned sample video (the exact gap this type exists to close).
// Phase 12 Module 10 — costUsd is the SAME generic attachment, real
// per-call vendor cost for callers that need it (e.g. the AI Auto-Editor's
// b-roll generation cost preview).
export type VideoRenderResultWithProvider = VideoRenderResult & { providerId: string; costUsd?: number };

export interface SceneMergeInput {
  videoUrl: string;
  durationSeconds: number;
  transition: "CUT" | "FADE" | "DISSOLVE" | "SLIDE";
}

export interface VideoMergeRequest {
  scenes: SceneMergeInput[];
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  quality: "480p" | "720p" | "1080p" | "4K";
  watermarkText?: string;
}

// Milestone 9 — Export System. One resolved clip from the Timeline (already
// joined against its Scene/Asset to a real source URL where applicable) —
// the provider composites every track's clips together (video/image base
// layers plus text/sticker/caption overlays) into one output file. A
// genuinely different capability from mergeScenes() (which only concatenates
// sequential scene clips, no overlays, no arbitrary track layout).
export interface TimelineClipInput {
  trackKind: "VIDEO" | "IMAGE" | "TEXT" | "CAPTION" | "STICKER" | "AUDIO" | "MUSIC";
  startMs: number;
  durationMs: number;
  /** Resolved source URL for VIDEO/IMAGE/AUDIO/MUSIC clips; absent for TEXT/STICKER/CAPTION. */
  sourceUrl?: string;
  /** Milestone 11 — offset into sourceUrl to start playback from (Talking Head scenes that share one base video, trimmed per scene). 0/absent means "play from the start," the only case that mattered before this milestone. */
  trimStartMs?: number;
  /** Text/sticker/caption payload (style, position, words) for overlay clips. */
  content?: Record<string, unknown>;
}

export interface VideoComposeRequest {
  totalDurationMs: number;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  clips: TimelineClipInput[];
  quality: "480p" | "720p" | "1080p" | "4K";
  /** Mock-level only today — no real adapter performs vendor-specific encoding per codec yet. */
  codec: "H264" | "H265" | "VP9";
  watermarkText?: string;
}

export interface VideoProvider extends GenerationProvider {
  render(req: VideoRenderRequest): Promise<VideoRenderResult>;
  /** Concatenates already-rendered scene clips (with per-scene transitions) into one final video. */
  mergeScenes(req: VideoMergeRequest): Promise<VideoRenderResult>;
  /** Composites a full multi-track Timeline (overlays included) into one exportable file. */
  composeTimeline(req: VideoComposeRequest): Promise<VideoRenderResult>;
  /**
   * Real bug fix (2026-07-25) — Sora only accepts `seconds` of "4", "8", or
   * "12" (confirmed live: a 400 for FILM's 10s scenes, "Invalid value: '10'.
   * Supported values are: '4', '8', and '12'"), but every duration-choosing
   * flow (FILM's 10/20s, GENERATED's arbitrary script-driven per-scene
   * seconds) had no way to know that before burning a real, guaranteed-fail
   * attempt through it. Optional and undefined for every other provider —
   * this is ONLY populated where a real, confirmed (not guessed) vendor
   * constraint exists; an unset value means "no known restriction," not
   * "verified unrestricted." renderVideo() (lib/generation/video.ts) filters
   * a provider out of the chain entirely when set and the request's
   * durationSeconds isn't in the list, so it's never attempted at all —
   * cheaper and more honest than letting it fail and moving on.
   */
  readonly supportedDurationsSeconds?: number[];
}
