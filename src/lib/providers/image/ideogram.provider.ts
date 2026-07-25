import type { ProviderRuntimeConfig } from "../credentials";
import type { ImageGenerateRequest, ImageGenerateResult, ImageProvider } from "./types";

const ASPECT_RATIO_MAP: Record<ImageGenerateRequest["aspectRatio"], string> = {
  RATIO_9_16: "ASPECT_9_16",
  RATIO_1_1: "ASPECT_1_1",
  RATIO_16_9: "ASPECT_16_9",
};

const DEFAULT_MODEL = "V_2";

// Real bug fix (2026-07-24) — the request payload's `model` field was
// sending whatever the Admin Panel's `model` free-text input held
// verbatim, with no validation against Ideogram's actual model enum
// (confirmed via a real live 400: "'Ideogram' is not one of ['V_1',
// 'V_1_TURBO', 'V_2', 'V_2_TURBO', 'V_2A', 'V_2A_TURBO', 'V_3', 'AUTO']" —
// the admin config's `model` column literally held the display label
// "Ideogram", not a real model id). DEFAULT_MODEL above was always
// correct; nothing stopped an invalid admin-typed value from silently
// overriding it. Validated here, not silently substituted back to the
// default, so a real typo surfaces as a clear, actionable error instead
// of quietly running a different model than the admin thinks they
// configured — same "surface real problems, don't paper over them"
// convention this codebase uses for provider fallback generally.
const VALID_MODELS = ["V_1", "V_1_TURBO", "V_2", "V_2_TURBO", "V_2A", "V_2A_TURBO", "V_3", "AUTO"] as const;

// Real adapter — Ideogram's REST API, the same request/response shape style
// as openai-images.provider.ts/flux.provider.ts. The only genuinely missing
// vendor named in the Milestone 16 spec (Flux/Runway/Kling/Gemini already
// existed) — strong in-image text rendering is its differentiator, which is
// why lib/prompt-os/adapters/ideogram.adapter.ts phrases its prompt text
// distinctly (explicit headline/CTA text + placement) from the other
// adapters. Credentials/model resolved by lib/providers/credentials.ts
// (Admin AI Providers panel); ships disabled by default like the other
// best-effort vendors until an admin supplies a key.
export class IdeogramImageProvider implements ImageProvider {
  readonly id = "ideogram";
  readonly category = "IMAGE" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generate(req: ImageGenerateRequest): Promise<ImageGenerateResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("ideogram is enabled but no API key is configured (Admin → AI Providers).");
    }
    if (!(VALID_MODELS as readonly string[]).includes(this.model)) {
      throw new Error(
        `ideogram is configured with an invalid model "${this.model}" — must be one of: ${VALID_MODELS.join(", ")}. Fix the Model field in Admin → AI Providers.`
      );
    }

    const res = await fetch("https://api.ideogram.ai/generate", {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_request: {
          prompt: req.prompt,
          negative_prompt: req.negativePrompt,
          aspect_ratio: ASPECT_RATIO_MAP[req.aspectRatio],
          model: this.model,
          magic_prompt_option: "OFF",
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ideogram request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const item = json.data?.[0];
    const imageUrl: string | undefined = item?.url;
    if (!imageUrl) {
      throw new Error("Ideogram returned no image url.");
    }

    return { imageUrl, usage: { images: 1 } };
  }
}
