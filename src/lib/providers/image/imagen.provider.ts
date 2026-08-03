import type { ProviderRuntimeConfig } from "../credentials";
import type { ImageGenerateRequest, ImageGenerateResult, ImageProvider } from "./types";

// Imagen's aspectRatio parameter only accepts exactly "1:1", "3:4", "4:3",
// "9:16", "16:9" (Google's documented set, no arbitrary ratio) — 4:5 and
// 2:3 have no exact match and bucket to the closest supported value (3:4),
// 3:2 buckets to the closest supported value (4:3).
const ASPECT_RATIO_BY_REQUEST: Record<ImageGenerateRequest["aspectRatio"], string> = {
  RATIO_1_1: "1:1",
  RATIO_4_5: "3:4",
  RATIO_3_4: "3:4",
  RATIO_2_3: "3:4",
  RATIO_9_16: "9:16",
  RATIO_16_9: "16:9",
  RATIO_3_2: "4:3",
  RATIO_4_3: "4:3",
};

// Google's Imagen line — a different model family and a different REST
// shape (:predict, instances/parameters) than gemini-3-pro-image's
// /v1beta/interactions used by gemini-images.provider.ts. Confirmed from
// Google's own current docs that the imagen-4.0-generate-001 endpoints are
// DEPRECATED, shutting down 2026-08-17 — kept in anyway per explicit
// request, but this is a short-lived integration by design, not an
// oversight. Admin can point `model` at whatever Imagen model id remains
// current without a code change.
const DEFAULT_MODEL = "imagen-4.0-generate-001";

interface PredictResponse {
  predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
}

export class ImagenProvider implements ImageProvider {
  readonly id = "imagen";
  readonly category = "IMAGE" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generate(req: ImageGenerateRequest, signal?: AbortSignal): Promise<ImageGenerateResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error(
        "imagen is enabled but no API key is configured (Admin → AI Providers)."
      );
    }

    // Imagen has no dedicated negative-prompt field on this endpoint — same
    // "fold it into the prompt text" fallback openai-images.provider.ts
    // uses for the same reason.
    const prompt = req.negativePrompt?.trim()
      ? `${req.prompt}\n\nAvoid the following: ${req.negativePrompt.trim()}`
      : req.prompt;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predict`,
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            numberOfImages: 1,
            imageSize: "1K",
            aspectRatio: ASPECT_RATIO_BY_REQUEST[req.aspectRatio],
            // Our use case (marketing posters depicting real people) needs
            // this explicitly — Imagen defaults to restricting adult-person
            // generation without it.
            personGeneration: "ALLOW_ADULT",
          },
        }),
        signal,
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Imagen request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json: PredictResponse = await res.json();
    const prediction = json.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      throw new Error("Imagen response contained no image data.");
    }
    const mimeType = prediction.mimeType ?? "image/png";

    return { imageUrl: `data:${mimeType};base64,${prediction.bytesBase64Encoded}`, usage: { images: 1 } };
  }
}
