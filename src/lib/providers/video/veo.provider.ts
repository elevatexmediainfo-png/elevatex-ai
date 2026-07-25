import type { ProviderRuntimeConfig } from "../credentials";
import { pollUntilSettled } from "../poll";
import type { VideoRenderRequest, VideoRenderResult, VideoProvider } from "./types";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // ~5 minutes
// Reverted back to veo-3.1-lite-generate-preview as the default (founder
// decision, 2026-07-11): standard Veo was tried live and confirmed working,
// but at ~5-8x Lite's per-second cost ($0.40/sec 1080p vs Lite's $0.08/sec)
// — real evidence of the problem: the Google Cloud prepaid balance drained
// fast running standard-Veo verification calls this same session. Lite
// fits the ₹300-500 target user budget (VIDEO_ACTION_CREDIT_COSTS.veo_lite,
// ~20 credits/clip); standard stays reachable via an explicit model
// override (see the constructor below) for a future Premium-tier path
// (VIDEO_ACTION_CREDIT_COSTS.veo_standard, ~100 credits/clip) — no caller
// wires that override in yet, this just keeps the capability from being
// deleted outright.
const DEFAULT_MODEL = "veo-3.1-lite-generate-preview";

// personGeneration was tried and REVERTED — confirmed live, not guessed:
// sending personGeneration: "allow_adult" gets a real 400 back ("allow_adult
// for personGeneration is currently not supported"), even though it's a
// real, recognized field name on this endpoint (unlike negativePrompt's
// blanket rejection) — the VALUE is restricted for this
// account/model/region, not a naming mistake. No other value has been
// confirmed to work, so — same principle as negativePrompt — better to not
// send an unproven parameter than guess a second value against a
// quota-limited API. Needs a real, deliberate investigation (Google Cloud
// Console policy settings, or a support query) before this is retried.

// RATIO_9_16 confirmed live against the standard model (2026-07-11, real
// 8.00s/1080x1920/24fps output with audio) — resolves the contradiction in
// Google's own Veo 3.1 Python sample (its code passes "9:16", its inline
// comment claims only "16:9"/"16:10" are supported); the code was right.
// Already independently confirmed for Lite since Phase 2. Safe for both
// models this app actually uses.
const ASPECT_RATIO_PARAM: Record<VideoRenderRequest["aspectRatio"], string> = {
  RATIO_9_16: "9:16",
  RATIO_1_1: "1:1",
  RATIO_16_9: "16:9",
};

// Real adapter — Google's Veo, exposed through the Gemini API's
// long-running-operation pattern (predictLongRunning + poll). The
// predictLongRunning/poll/download plumbing below is confirmed live against
// a real account for BOTH veo-3.1-lite-generate-preview (Phase 2, and
// throughout this session's default path) and veo-3.1-generate-preview
// (2026-07-11, real 8.00s/1080x1920/24fps output) — same request/response
// shape on the same endpoint for both, as expected (same API family/
// version). Two real bugs already found and fixed on THIS endpoint shape
// regardless of model: auth was a `?key=` query param where the current API
// wants the `x-goog-api-key` header (same fix already applied to
// gemini-images.provider.ts), and the model id was a stale Veo 3.0 string.
export class VeoVideoProvider implements VideoProvider {
  readonly id = "veo";
  readonly category = "VIDEO" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("veo is enabled but no API key is configured (Admin → AI Providers).");
    }
    const model = this.model;
    const authHeaders = { "x-goog-api-key": apiKey };

    const createRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`,
      {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [
            {
              prompt: req.script,
              // Confirmed working via a real call — `image.inlineData` (the
              // Gemini generateContent convention, and what the public docs
              // implied) is REJECTED by this model's predictLongRunning
              // endpoint with a 400. The accepted shape is Imagen/Vertex's
              // own convention instead: bytesBase64Encoded + mimeType
              // directly on `image`, confirmed end-to-end (create -> poll ->
              // completed) against a real account.
              ...(req.startImage ? { image: { bytesBase64Encoded: req.startImage.data, mimeType: req.startImage.mimeType } } : {}),
            },
          ],
          parameters: {
            // Confirmed live (real 400 from a real user's scene_render call,
            // 2026-07-10): veo-3.1-lite-generate-preview's predictLongRunning
            // endpoint REJECTS the request outright if `negativePrompt` is
            // present at all, even as an empty/undefined-ish value — unlike
            // VideoRenderRequest's own documented contract ("silently ignored
            // where the vendor API has no such parameter"). Deliberately not
            // forwarded here, matching that contract, instead of pushing a
            // workaround up into every caller that happens to set a
            // negativePrompt (lib/render/pipeline.ts's scene render does).
            aspectRatio: ASPECT_RATIO_PARAM[req.aspectRatio],
            resolution: req.quality === "1080p" ? "1080p" : "720p",
            // Only sent for a non-Lite model. Lite's confirmed-working
            // shape (Phase 2, live) never included this field, and Lite is
            // confirmed to always return exactly 8s regardless of what's
            // requested — sending an unconfirmed param to Lite risks the
            // exact class of bug negativePrompt/personGeneration already
            // taught this file to avoid. Standard Veo's own sample
            // documents durationSeconds as a real, honored 5-8s knob, so
            // it's sent when that model is actually in use (not yet, since
            // no caller requests it today — see DEFAULT_MODEL's comment).
            ...(model !== "veo-3.1-lite-generate-preview" ? { durationSeconds: req.durationSeconds } : {}),
          },
        }),
      }
    );
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      throw new Error(`Veo operation create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }
    const created = await createRes.json();
    const operationName: string | undefined = created.name;
    if (!operationName) {
      throw new Error("Veo did not return a long-running operation name.");
    }

    const data = await pollUntilSettled(
      async () => {
        const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}`, {
          headers: authHeaders,
        });
        if (!pollRes.ok) return { status: "pending" as const };

        const polled = await pollRes.json();
        if (!polled.done) return { status: "pending" as const };
        if (polled.error) {
          return { status: "failed" as const, error: polled.error.message ?? JSON.stringify(polled.error) };
        }

        const videoUri: string | undefined =
          polled.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!videoUri) {
          return { status: "failed" as const, error: "operation completed with no video URI in response" };
        }
        return { status: "succeeded" as const, data: { videoUri, providerRef: operationName } };
      },
      { intervalMs: POLL_INTERVAL_MS, maxAttempts: MAX_POLL_ATTEMPTS, label: "Veo operation" }
    );

    // The files/*:download URI Veo returns needs the SAME api-key header to
    // fetch — a generic downstream caller (storage.uploadFromUrl, toBuffer)
    // has no way to attach that. Downloading here and returning a data: URI
    // instead keeps VideoRenderResult.videoUrl fetchable by anything with no
    // extra auth, the same convention gemini-images.provider.ts already
    // uses for images (toBuffer() already handles data: URIs as-is).
    const fileRes = await fetch(data.videoUri, { headers: authHeaders });
    if (!fileRes.ok) {
      throw new Error(`Veo video download failed (${fileRes.status}).`);
    }
    const mimeType = fileRes.headers.get("content-type") ?? "video/mp4";
    const bytes = Buffer.from(await fileRes.arrayBuffer());
    const videoUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;

    return { videoUrl, durationSeconds: req.durationSeconds, providerRef: data.providerRef, usage: { seconds: req.durationSeconds } };
  }

  // Honest limitation, not a fake — see replicate.provider.ts's identical
  // gap. Veo's generation API produces clips; it has no generic multi-clip
  // concat/compositing capability.
  async mergeScenes(): Promise<VideoRenderResult> {
    throw new Error(
      "veo has no generic scene-merge capability — configure a dedicated video-editing/concat provider for merge, or use the mock pipeline for end-to-end scene merging today."
    );
  }

  async composeTimeline(): Promise<VideoRenderResult> {
    throw new Error(
      "veo has no multi-track timeline-compositing capability — configure a dedicated video-editing/compositing provider for Export, or use the mock pipeline for end-to-end export today."
    );
  }
}
