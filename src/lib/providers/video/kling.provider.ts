import { createHmac } from "crypto";

import type { ProviderRuntimeConfig } from "../credentials";
import { pollUntilSettled } from "../poll";
import type { VideoRenderRequest, VideoRenderResult, VideoProvider } from "./types";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // ~5 minutes
const DEFAULT_MODEL = "kling-v1";
const JWT_TTL_SECONDS = 1800;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Kling's API authenticates with a short-lived JWT signed by the access
// key/secret pair (not a static bearer token) — minted fresh per request
// rather than cached, since it's cheap to compute and avoids any expiry
// bookkeeping.
function signJwt(accessKey: string, secretKey: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ iss: accessKey, exp: now + JWT_TTL_SECONDS, nbf: now - 5 }));
  const signature = base64url(createHmac("sha256", secretKey).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

// Best-effort adapter — Kling AI (Kuaishou)'s text-to-video API. Defaults to
// disabled (see prisma ProviderConfig.enabled) until an admin turns it on
// and supplies an access key/secret pair, per Milestone 10's "feature flag
// expensive providers" requirement. NOT verified against a live account —
// confirm the endpoint host/JWT claim shape still matches current
// docs/account access tier before depending on it in production.
export class KlingVideoProvider implements VideoProvider {
  readonly id = "kling";
  readonly category = "VIDEO" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const accessKey = this.config.apiKey;
    const secretKey = this.config.apiSecret;
    if (!accessKey || !secretKey) {
      throw new Error("kling is enabled but no access key/secret is configured (Admin → AI Providers).");
    }
    const token = signJwt(accessKey, secretKey);
    const authHeader = { Authorization: `Bearer ${token}` };

    const createRes = await fetch("https://api-singapore.klingai.com/v1/videos/text2video", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_name: this.model,
        prompt: req.script,
        negative_prompt: req.negativePrompt,
        aspect_ratio: req.aspectRatio === "RATIO_9_16" ? "9:16" : req.aspectRatio === "RATIO_1_1" ? "1:1" : "16:9",
        duration: String(req.durationSeconds),
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      throw new Error(`Kling task create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }
    const created = await createRes.json();
    const taskId: string | undefined = created.data?.task_id;
    if (!taskId) {
      throw new Error("Kling did not return a task_id.");
    }

    const data = await pollUntilSettled(
      async () => {
        const pollRes = await fetch(`https://api-singapore.klingai.com/v1/videos/text2video/${taskId}`, {
          headers: authHeader,
        });
        if (!pollRes.ok) return { status: "pending" as const };

        const polled = await pollRes.json();
        const taskStatus: string | undefined = polled.data?.task_status;
        if (taskStatus === "succeed") {
          const videoUrl: string | undefined = polled.data?.task_result?.videos?.[0]?.url;
          if (!videoUrl) {
            return { status: "failed" as const, error: "task succeeded with no video URL in response" };
          }
          return { status: "succeeded" as const, data: { videoUrl } };
        }
        if (taskStatus === "failed") {
          return { status: "failed" as const, error: polled.data?.task_status_msg ?? "no error detail" };
        }
        return { status: "pending" as const };
      },
      { intervalMs: POLL_INTERVAL_MS, maxAttempts: MAX_POLL_ATTEMPTS, label: "Kling task" }
    );

    return { videoUrl: data.videoUrl, durationSeconds: req.durationSeconds, providerRef: taskId, usage: { seconds: req.durationSeconds } };
  }

  // Honest limitation, not a fake — see replicate.provider.ts's identical
  // gap. Kling's generation API produces clips; it has no generic
  // multi-clip concat/compositing capability.
  async mergeScenes(): Promise<VideoRenderResult> {
    throw new Error(
      "kling has no generic scene-merge capability — configure a dedicated video-editing/concat provider for merge, or use the mock pipeline for end-to-end scene merging today."
    );
  }

  async composeTimeline(): Promise<VideoRenderResult> {
    throw new Error(
      "kling has no multi-track timeline-compositing capability — configure a dedicated video-editing/compositing provider for Export, or use the mock pipeline for end-to-end export today."
    );
  }
}
