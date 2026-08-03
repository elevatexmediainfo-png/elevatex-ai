import type { ProviderRuntimeConfig } from "../credentials";
import type { ImageGenerateRequest, ImageGenerateResult, ImageProvider } from "./types";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // ~1 minute

// Flux's aspect_ratio param natively accepts all of these as literal "W:H"
// strings (a richer preset set than OpenAI/Imagen/Ideogram) — no bucketing
// needed, every ratio maps exactly.
const ASPECT_RATIO_MAP: Record<ImageGenerateRequest["aspectRatio"], string> = {
  RATIO_1_1: "1:1",
  RATIO_4_5: "4:5",
  RATIO_3_4: "3:4",
  RATIO_2_3: "2:3",
  RATIO_9_16: "9:16",
  RATIO_16_9: "16:9",
  RATIO_3_2: "3:2",
  RATIO_4_3: "4:3",
};

// Real adapter — Flux (Black Forest Labs) hosted via Replicate's prediction
// API, mirroring video/replicate.provider.ts's polling pattern so a single
// vendor-integration style covers both. Credentials/model resolved by
// lib/providers/credentials.ts (Admin AI Providers panel, falling back to
// REPLICATE_API_TOKEN/FLUX_MODEL_VERSION) and injected here. No sensible
// default model exists (Replicate model versions are opaque vendor hashes),
// so a missing model is a configuration error, not a fallback case.
export class FluxImageProvider implements ImageProvider {
  readonly id = "flux";
  readonly category = "IMAGE" as const;
  readonly model?: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model;
  }

  async generate(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
    const apiToken = this.config.apiKey;
    const modelVersion = this.config.model;
    if (!apiToken || !modelVersion) {
      throw new Error(
        "flux is enabled but API token/model version are not configured (Admin → AI Providers, or REPLICATE_API_TOKEN/FLUX_MODEL_VERSION)."
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
          prompt: req.prompt,
          negative_prompt: req.negativePrompt,
          aspect_ratio: ASPECT_RATIO_MAP[req.aspectRatio],
        },
      }),
    });

    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      throw new Error(`Flux (Replicate) prediction create failed (${createRes.status}): ${body.slice(0, 300)}`);
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
        const imageUrl: string | undefined = Array.isArray(polled.output) ? polled.output[0] : polled.output;
        if (!imageUrl) throw new Error("Flux prediction succeeded but returned no output URL.");
        return { imageUrl, providerRef: polled.id, usage: { images: 1 } };
      }
      if (polled.status === "failed" || polled.status === "canceled") {
        throw new Error(`Flux prediction ${polled.status}: ${polled.error ?? "no error detail"}`);
      }
      // status is "starting" or "processing" — keep polling.
    }

    throw new Error("Flux prediction timed out waiting for completion.");
  }
}
