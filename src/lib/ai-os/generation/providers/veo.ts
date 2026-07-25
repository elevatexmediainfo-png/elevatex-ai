import type { GenerationRequest, ProviderCredentials, ProviderRawOutput, ProviderExecutor } from "../types";
import { GenerationError, TRANSIENT_STATUS_CODES } from "../types";

// Google Veo Video Executor.

class VeoExecutor implements ProviderExecutor {
  readonly provider = "veo" as const;

  async execute(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal?: AbortSignal
  ): Promise<ProviderRawOutput> {
    const prompt = request.providerPrompt.body.finalPrompt;
    const aspectRatio = request.aspectRatio === "9:16" ? "9:16" : "16:9";

    const body = {
      instances: [{ prompt }],
      parameters: { aspectRatio, sampleCount: 1, durationSeconds: 8 },
    };

    const model = credentials.model ?? "veo-3";
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT/locations/us-central1/publishers/google/models/${model}:predictLongRunning`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerationError(res.status, `Veo error (${res.status}): ${text.slice(0, 200)}`,
        TRANSIENT_STATUS_CODES.has(res.status), "veo");
    }

    const json = await res.json();
    const outputUrl = json.predictions?.[0]?.videoUri ?? json.name;
    if (!outputUrl) throw new GenerationError(200, "Veo returned no video URL", false, "veo");

    return { outputUrl, contentType: "video/mp4" };
  }
}

export const veoExecutor = new VeoExecutor();
