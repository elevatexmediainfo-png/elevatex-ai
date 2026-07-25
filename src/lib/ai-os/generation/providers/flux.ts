import type { GenerationRequest, ProviderCredentials, ProviderRawOutput, ProviderExecutor } from "../types";
import { GenerationError, TRANSIENT_STATUS_CODES } from "../types";

// Flux (Black Forest Labs) Executor via Replicate API.

class FluxExecutor implements ProviderExecutor {
  readonly provider = "flux" as const;

  async execute(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal?: AbortSignal
  ): Promise<ProviderRawOutput> {
    const prompt = request.providerPrompt.body.finalPrompt;
    const negativePrompt = request.providerPrompt.body.negativePrompt;
    const model = credentials.model ?? "black-forest-labs/flux-1.1-pro";

    const input: Record<string, unknown> = { prompt, num_outputs: 1 };
    if (negativePrompt) input.negative_prompt = negativePrompt;

    // Determine dimensions from aspect ratio
    const dimMap: Record<string, [number, number]> = {
      "1:1": [1024, 1024], "16:9": [1024, 576], "9:16": [576, 1024],
      "4:5": [896, 1120],
    };
    const [width, height] = dimMap[request.aspectRatio] ?? [1024, 1024];
    input.width = width;
    input.height = height;

    const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ input }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerationError(res.status, `Flux error (${res.status}): ${text.slice(0, 200)}`,
        TRANSIENT_STATUS_CODES.has(res.status), "flux");
    }

    const json = await res.json();
    const outputUrl = Array.isArray(json.output) ? json.output[0] : json.output;
    if (!outputUrl) throw new GenerationError(200, "Flux returned no output URL", false, "flux");

    return { outputUrl, contentType: "image/png" };
  }
}

export const fluxExecutor = new FluxExecutor();
