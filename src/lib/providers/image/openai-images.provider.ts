import type { ProviderRuntimeConfig } from "../credentials";
import type { ImageGenerateRequest, ImageGenerateResult, ImageProvider } from "./types";

const SIZE_BY_RATIO: Record<ImageGenerateRequest["aspectRatio"], string> = {
  RATIO_9_16: "1024x1536",
  RATIO_1_1: "1024x1024",
  RATIO_16_9: "1536x1024",
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
        // credentials.ts into ProviderRuntimeConfig — default to "high"
        // since every use case here is commercial advertising.
        quality: this.config.defaultQuality ?? "high",
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
