import type { ProviderRuntimeConfig } from "../credentials";
import { pollUntilSettled } from "../poll";
import type { VideoRenderRequest, VideoRenderResult, VideoProvider } from "./types";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // ~5 minutes
const DEFAULT_MODEL = "sora-2";

// Real bug fix (2026-07-24, same bug class as ideogram.provider.ts's own
// fix) — the stored admin config's `model` value was "Elevatex Sora", a
// leftover display label, not a real OpenAI model id, silently overriding
// this file's own correct DEFAULT_MODEL. Confirmed against OpenAI's
// current docs (developers.openai.com/api/docs/guides/video-generation,
// 2026-07-24): the only two general model ids are "sora-2" (speed/
// iteration) and "sora-2-pro" (higher quality, required for 1080p), plus
// optional timestamped pinned versions of each (e.g. "sora-2-2025-10-06").
// Validated here, not silently substituted, same "surface a real typo
// instead of quietly running a different model" reasoning as the Ideogram
// fix. Real, time-sensitive fact worth knowing regardless of this fix:
// OpenAI's docs state the Sora 2 models and Videos API are deprecated,
// shutting down 2026-09-24 — about 2 months from today.
const VALID_MODEL_PATTERN = /^sora-2(-pro)?(-\d{4}-\d{2}-\d{2})?$/;

const SIZE_BY_RATIO: Record<VideoRenderRequest["aspectRatio"], string> = {
  RATIO_9_16: "720x1280",
  RATIO_1_1: "1024x1024",
  RATIO_16_9: "1280x720",
};

// Best-effort adapter — OpenAI's Sora video-generation API (create task +
// poll, same shape as every other adapter in this directory). Defaults to
// disabled (ProviderConfig.enabled) until an admin turns it on and supplies
// a key. NOT verified against a live account — confirm the endpoint paths,
// accepted `seconds` values, and response field names still match current
// docs/account access tier before depending on it in production, same
// caveat as runway/veo/kling/hailuo above.
export class SoraVideoProvider implements VideoProvider {
  readonly id = "sora";
  readonly category = "VIDEO" as const;
  readonly model: string;
  // Real, confirmed constraint (2026-07-25 — see VideoProvider's own doc
  // comment for the live 400 this was found from) — OpenAI's Videos API
  // only accepts these three exact values for `seconds`.
  readonly supportedDurationsSeconds = [4, 8, 12];

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("sora is enabled but no API key is configured (Admin → AI Providers).");
    }
    if (!VALID_MODEL_PATTERN.test(this.model)) {
      throw new Error(
        `sora is configured with an invalid model "${this.model}" — must be "sora-2", "sora-2-pro", or a timestamped pin of either (e.g. "sora-2-2025-10-06"). Fix the Model field in Admin → AI Providers.`
      );
    }
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

    const createRes = await fetch("https://api.openai.com/v1/videos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        prompt: req.script,
        size: SIZE_BY_RATIO[req.aspectRatio],
        seconds: String(req.durationSeconds),
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      throw new Error(`Sora task create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }
    const created = await createRes.json();
    const videoId: string | undefined = created.id;
    if (!videoId) {
      throw new Error("Sora did not return a video id.");
    }

    await pollUntilSettled<null>(
      async () => {
        const pollRes = await fetch(`https://api.openai.com/v1/videos/${videoId}`, { headers });
        if (!pollRes.ok) return { status: "pending" as const };

        const polled = await pollRes.json();
        if (polled.status === "completed") {
          return { status: "succeeded" as const, data: null };
        }
        if (polled.status === "failed") {
          return { status: "failed" as const, error: polled.error?.message ?? "no error detail" };
        }
        // "queued" or "in_progress" — keep polling.
        return { status: "pending" as const };
      },
      { intervalMs: POLL_INTERVAL_MS, maxAttempts: MAX_POLL_ATTEMPTS, label: "Sora task" }
    );

    // Sora's content endpoint streams the rendered file directly rather than
    // returning a hosted URL — fetched and re-encoded as a data: URI so the
    // result is self-contained, the same shape openai-images.provider.ts
    // uses for its b64_json responses.
    const contentRes = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, { headers });
    if (!contentRes.ok) {
      const body = await contentRes.text().catch(() => "");
      throw new Error(`Sora content download failed (${contentRes.status}): ${body.slice(0, 300)}`);
    }
    const buffer = Buffer.from(await contentRes.arrayBuffer());
    const videoUrl = `data:video/mp4;base64,${buffer.toString("base64")}`;

    return { videoUrl, durationSeconds: req.durationSeconds, providerRef: videoId, usage: { seconds: req.durationSeconds } };
  }

  // Honest limitation, not a fake — see runway.provider.ts's identical gap.
  async mergeScenes(): Promise<VideoRenderResult> {
    throw new Error(
      "sora has no generic scene-merge capability — configure a dedicated video-editing/concat provider for merge, or use the mock pipeline for end-to-end scene merging today."
    );
  }

  async composeTimeline(): Promise<VideoRenderResult> {
    throw new Error(
      "sora has no multi-track timeline-compositing capability — configure a dedicated video-editing/compositing provider for Export, or use the mock pipeline for end-to-end export today."
    );
  }
}
