import type { ProviderRuntimeConfig } from "../credentials";
import type { VideoRenderRequest, VideoRenderResult, VideoProvider } from "./types";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60; // ~3 minutes

// Real adapter — plain REST call against Replicate's prediction API, which
// hosts a wide range of swappable text-to-video models without locking the
// codebase to any single vendor's SDK. Credentials/model resolved by
// lib/providers/credentials.ts (Admin AI Providers panel, falling back to
// REPLICATE_API_TOKEN/REPLICATE_MODEL_VERSION) and injected here. No
// sensible default model exists (Replicate model versions are opaque vendor
// hashes), so a missing model is a configuration error, not a fallback case.
export class ReplicateVideoProvider implements VideoProvider {
  readonly id = "replicate";
  readonly category = "VIDEO" as const;
  readonly model?: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model;
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const apiToken = this.config.apiKey;
    const modelVersion = this.config.model;
    if (!apiToken || !modelVersion) {
      throw new Error(
        "replicate is enabled but API token/model version are not configured (Admin → AI Providers, or REPLICATE_API_TOKEN/REPLICATE_MODEL_VERSION)."
      );
    }

    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          prompt: req.script,
          negative_prompt: req.negativePrompt,
          aspect_ratio: req.aspectRatio === "RATIO_9_16" ? "9:16" : req.aspectRatio === "RATIO_1_1" ? "1:1" : "16:9",
          duration: req.durationSeconds,
          audio_url: req.voiceoverUrl,
          resolution: req.quality,
          // Not every underlying model supports a burned-in watermark
          // parameter — model-specific wiring (or a post-process overlay
          // step) belongs here, behind this same interface, without
          // business logic ever knowing which model is selected.
          watermark_text: req.watermarkText,
        },
      }),
    });

    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      throw new Error(`Replicate prediction create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }

    const prediction = await createRes.json();
    const predictionUrl: string = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const pollRes = await fetch(predictionUrl, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (!pollRes.ok) continue;

      const polled = await pollRes.json();
      if (polled.status === "succeeded") {
        const videoUrl: string | undefined = Array.isArray(polled.output)
          ? polled.output[0]
          : polled.output;
        if (!videoUrl) throw new Error("Replicate prediction succeeded but returned no output URL.");
        return {
          videoUrl,
          durationSeconds: req.durationSeconds,
          providerRef: polled.id,
          usage: { seconds: req.durationSeconds },
        };
      }
      if (polled.status === "failed" || polled.status === "canceled") {
        throw new Error(`Replicate prediction ${polled.status}: ${polled.error ?? "no error detail"}`);
      }
      // status is "starting" or "processing" — keep polling.
    }

    throw new Error("Replicate prediction timed out waiting for completion.");
  }

  // Honest limitation, not a fake: Replicate's text-to-video prediction API
  // generates clips, it doesn't expose a generic multi-clip concatenation
  // capability. A real deployment using Replicate as the video provider
  // needs a dedicated video-editing/concat service behind this same
  // VideoProvider interface (e.g. a Shotstack/ffmpeg-on-Lambda adapter) —
  // documented in PROJECT_STATUS.md rather than silently faking support.
  async mergeScenes(): Promise<VideoRenderResult> {
    throw new Error(
      "replicate has no generic scene-merge capability — configure a dedicated video-editing/concat provider for merge, or use the mock pipeline for end-to-end scene merging today."
    );
  }

  // Milestone 9 — same honest gap as mergeScenes(): Replicate's text-to-video
  // prediction API has no multi-track compositing capability (overlays,
  // arbitrary layer stacking). A production deployment needs a dedicated
  // video-editing/compositing adapter (e.g. Shotstack, ffmpeg-on-Lambda,
  // Remotion Lambda) behind this same VideoProvider interface.
  async composeTimeline(): Promise<VideoRenderResult> {
    throw new Error(
      "replicate has no multi-track timeline-compositing capability — configure a dedicated video-editing/compositing provider for Export, or use the mock pipeline for end-to-end export today."
    );
  }
}
