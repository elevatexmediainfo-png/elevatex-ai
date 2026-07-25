import type { GenerationRequest, ProviderCredentials, ProviderRawOutput, ProviderExecutor } from "../types";
import { GenerationError, TRANSIENT_STATUS_CODES } from "../types";

// Ideogram Executor.

const ASPECT_RATIO_MAP: Record<string, string> = {
  "1:1": "ASPECT_1_1", "16:9": "ASPECT_16_9", "9:16": "ASPECT_9_16",
  "4:3": "ASPECT_4_3", "3:4": "ASPECT_3_4",
};

class IdeogramExecutor implements ProviderExecutor {
  readonly provider = "ideogram" as const;

  async execute(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal?: AbortSignal
  ): Promise<ProviderRawOutput> {
    const prompt = request.providerPrompt.body.finalPrompt;
    const model = credentials.model ?? "V_2";
    const aspectRatio = ASPECT_RATIO_MAP[request.aspectRatio] ?? "ASPECT_1_1";

    const body: Record<string, unknown> = {
      image_request: {
        prompt,
        model,
        aspect_ratio: aspectRatio,
        magic_prompt_option: "OFF",  // Never rewrite — AI OS has already optimized
      },
    };

    const res = await fetch("https://api.ideogram.ai/generate", {
      method: "POST",
      headers: { "Api-Key": credentials.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerationError(res.status, `Ideogram error (${res.status}): ${text.slice(0, 200)}`,
        TRANSIENT_STATUS_CODES.has(res.status), "ideogram");
    }

    const json = await res.json();
    const outputUrl = json.data?.[0]?.url;
    if (!outputUrl) throw new GenerationError(200, "Ideogram returned no image URL", false, "ideogram");

    return { outputUrl, contentType: "image/png" };
  }
}

export const ideogramExecutor = new IdeogramExecutor();
