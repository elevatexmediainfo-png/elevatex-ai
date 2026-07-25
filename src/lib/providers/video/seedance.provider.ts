import type { ProviderRuntimeConfig } from "../credentials";
import { pollUntilSettled } from "../poll";
import type { VideoRenderRequest, VideoRenderResult, VideoProvider } from "./types";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // ~5 minutes
const DEFAULT_MODEL = "seedance-2-0";
const VALID_MODELS = ["seedance-2-0", "seedance-2-0-fast", "seedance-2-0-mini"] as const;

const RATIO_BY_ASPECT: Record<VideoRenderRequest["aspectRatio"], string> = {
  RATIO_9_16: "9:16",
  RATIO_1_1: "1:1",
  RATIO_16_9: "16:9",
};

// Real bug fix (2026-07-24) — this adapter was pointed at the WRONG
// service entirely. It's not ByteDance/Volcengine's own Ark platform (the
// "doubao-seedance-*" naming and the ark.cn-beijing.volces.com host were
// both wrong) — this codebase's actual configured provider is a distinct
// third-party service, Seedance2.ai, confirmed by cross-referencing the
// stored `sk_live_...` key against that service's own real API Keys
// dashboard. This explained a real, live-reproduced 401 "The API key
// format is incorrect" — the key was genuinely valid, just sent to a
// service that had never issued it. Verified against Seedance2.ai's real
// docs (seedance2.ai/api-docs) before writing this, not guessed: base URL,
// endpoint paths, the nested `input: {...}` request shape, the `taskId`
// response field (not `id`), the polling response's `data.results[0]`
// video-URL location, and the real model id list are all confirmed from
// that source, not carried over from the old Ark-shaped code below.
const BASE_URL = "https://api.seedance2.ai";

export class SeedanceVideoProvider implements VideoProvider {
  readonly id = "seedance2";
  readonly category = "VIDEO" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("seedance2 is enabled but no API key is configured (Admin → AI Providers).");
    }
    // Real bug found live (2026-07-24) — a genuine, non-obvious founder
    // mistake: pasting a MASKED preview string (e.g. "sk_live_K0jA…OBjt",
    // with a literal "…" ellipsis character) copied from a dashboard's
    // "reveal-once" key list, instead of the real full secret. Undetected,
    // this reached fetch() and failed with a cryptic, unrelated-looking
    // low-level error ("Cannot convert argument to a ByteString...") since
    // HTTP headers can't carry non-Latin-1 characters — nothing about that
    // message points a founder at the real cause. Caught here instead with
    // a clear, actionable one.
    // eslint-disable-next-line no-control-regex
    if (!/^[\x00-\xFF]*$/.test(apiKey)) {
      throw new Error(
        "seedance2's configured API key contains a character that can't appear in a real API key (likely a masked/truncated preview like \"sk_live_K0jA…OBjt\" copied from a dashboard instead of the real key). Copy the FULL key from Seedance2.ai's API Keys page — regenerate one if the original was only ever shown once — and re-save it in Admin → AI Providers."
      );
    }
    if (!(VALID_MODELS as readonly string[]).includes(this.model)) {
      throw new Error(
        `seedance2 is configured with an invalid model "${this.model}" — must be one of: ${VALID_MODELS.join(", ")}. Fix the Model field in Admin → AI Providers.`
      );
    }
    // Docs-confirmed: "Authorization: Bearer sk_live_xxxxxxxx" — unchanged
    // from the old code, this part was never the problem.
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

    const createRes = await fetch(`${BASE_URL}/v1/videos/generations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        input: {
          prompt: req.script,
          generation_type: "text-to-video",
          duration: req.durationSeconds,
          aspect_ratio: RATIO_BY_ASPECT[req.aspectRatio],
          resolution: "720p",
          // Real bug fix (2026-07-25) — this was `false`, an unexplained
          // oversight from this adapter's original rewrite against
          // Seedance2.ai's real docs. Confirmed via a real live incident: a
          // real Quick Video generation (this session, real founder
          // account) came back completely silent — downloaded and ffprobed
          // the actual output file, confirmed zero audio streams. Not
          // Quick-Video-specific: every flow that asks a character to speak
          // (Quick Video, GENERATED, FILM) relies on the video model's own
          // native speech generation — Veo does this correctly (confirmed
          // live, veo.provider.ts's own comment), but Seedance was
          // unconditionally telling the vendor not to generate any audio at
          // all, silently defeating every spoken-line prompt whenever
          // Seedance ends up serving the request — which, with Veo
          // currently disabled, is the common case right now.
          generate_audio: true,
          watermark: false,
          web_search: false,
          return_last_frame: false,
          seed: -1,
        },
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      throw new Error(`Seedance task create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }
    const created = await createRes.json();
    const taskId: string | undefined = created.taskId;
    if (!taskId) {
      throw new Error("Seedance did not return a taskId.");
    }

    const data = await pollUntilSettled(
      async () => {
        const pollRes = await fetch(`${BASE_URL}/v1/tasks/${taskId}`, { headers });
        if (!pollRes.ok) return { status: "pending" as const };

        const polled = await pollRes.json();
        if (polled.status === "completed") {
          const videoUrl: string | undefined = polled.data?.results?.[0];
          if (!videoUrl) {
            return { status: "failed" as const, error: "task completed with no data.results[0] in response" };
          }
          return { status: "succeeded" as const, data: { videoUrl } };
        }
        if (polled.status === "failed") {
          return { status: "failed" as const, error: polled.data?.failed_reason ?? "no error detail" };
        }
        // "queued" or "generating" — keep polling.
        return { status: "pending" as const };
      },
      { intervalMs: POLL_INTERVAL_MS, maxAttempts: MAX_POLL_ATTEMPTS, label: "Seedance task" }
    );

    return { videoUrl: data.videoUrl, durationSeconds: req.durationSeconds, providerRef: taskId, usage: { seconds: req.durationSeconds } };
  }

  // Honest limitation, not a fake — see runway.provider.ts's identical gap.
  async mergeScenes(): Promise<VideoRenderResult> {
    throw new Error(
      "seedance2 has no generic scene-merge capability — configure a dedicated video-editing/concat provider for merge, or use the mock pipeline for end-to-end scene merging today."
    );
  }

  async composeTimeline(): Promise<VideoRenderResult> {
    throw new Error(
      "seedance2 has no multi-track timeline-compositing capability — configure a dedicated video-editing/compositing provider for Export, or use the mock pipeline for end-to-end export today."
    );
  }
}
