import type { ProviderRuntimeConfig } from "../credentials";
import type { ImageGenerateRequest, ImageGenerateResult, ImageProvider } from "./types";

// gpt-image-1/1.5's `size` param only accepts these 3 fixed values (no
// arbitrary aspect ratio) — every ratio buckets to whichever of the 3 is
// closest by orientation, same approximation the original 9:16/16:9 entries
// already relied on (1024x1536 is actually 2:3, not exactly 9:16; 1536x1024
// is actually 3:2, not exactly 16:9 — there is no exact OpenAI size for
// either, and never was).
const SIZE_BY_RATIO: Record<ImageGenerateRequest["aspectRatio"], string> = {
  RATIO_1_1: "1024x1024",
  RATIO_4_5: "1024x1536",
  RATIO_3_4: "1024x1536",
  RATIO_2_3: "1024x1536",
  RATIO_9_16: "1024x1536",
  RATIO_16_9: "1536x1024",
  RATIO_3_2: "1536x1024",
  RATIO_4_3: "1536x1024",
};

// gpt-image-1.5 has stronger instruction following than gpt-image-1 —
// directly improves adherence to the complex advertising briefs the
// Creative Director produces. Admin can still override via ProviderConfig.
const DEFAULT_MODEL = "gpt-image-1.5";

export class OpenAIImagesProvider implements ImageProvider {
  readonly id = "openai_images";
  readonly category = "IMAGE" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generate(req: ImageGenerateRequest, signal?: AbortSignal): Promise<ImageGenerateResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error(
        "openai_images is enabled but no API key is configured (Admin → AI Providers, or OPENAI_API_KEY)."
      );
    }

    // OpenAI's Images API has no negative_prompt field (unlike Flux/Ideogram),
    // so "must avoid" constraints have to be folded into the prompt text itself
    // or they never reach the model at all.
    const prompt = req.negativePrompt?.trim()
      ? `${req.prompt}\n\nAvoid the following: ${req.negativePrompt.trim()}`
      : req.prompt;

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        size: SIZE_BY_RATIO[req.aspectRatio],
        // defaultQuality is already resolved from the admin panel by
        // credentials.ts into ProviderRuntimeConfig — an admin's own
        // configured value always wins, unchanged. Temporary debug change
        // (2026-08-04): fallback default lowered "high" -> "medium" while
        // investigating real generation latency against the 30s/120s
        // timeout — "high" quality is the slowest of the three tiers.
        quality: this.config.defaultQuality ?? "medium",
        n: 1,
      }),
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI Images request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const item = json.data?.[0];
    // gpt-image-1/1.5 always returns b64_json (no response_format param).
    // A data: URI lets the rest of the pipeline treat both URL and b64
    // shapes identically without this adapter needing storage access.
    const imageUrl: string | undefined =
      item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : undefined);
    if (!imageUrl) {
      throw new Error("OpenAI Images returned neither a url nor b64_json.");
    }

    return { imageUrl, usage: { images: 1 } };
  }
}
