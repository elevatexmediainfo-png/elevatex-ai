import type { GenerationRequest, ProviderCredentials, ProviderRawOutput, ProviderExecutor } from "../types";
import { GenerationError, TRANSIENT_STATUS_CODES } from "../types";

// Google Gemini Imagen Executor.
// Calls the Google Gemini image generation API.

const ASPECT_RATIO_MAP: Record<string, string> = {
  "1:1": "1:1", "16:9": "16:9", "9:16": "9:16", "4:3": "4:3", "3:4": "3:4",
};

class GeminiExecutor implements ProviderExecutor {
  readonly provider = "gemini" as const;

  async execute(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal?: AbortSignal
  ): Promise<ProviderRawOutput> {
    const prompt = request.providerPrompt.body.finalPrompt;
    const model = credentials.model ?? "imagen-4";
    const aspectRatio = ASPECT_RATIO_MAP[request.aspectRatio] ?? "1:1";

    const body = {
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio },
    };

    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT/locations/us-central1/publishers/google/models/${model}:predict`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerationError(res.status, `Gemini error (${res.status}): ${text.slice(0, 200)}`,
        TRANSIENT_STATUS_CODES.has(res.status), "gemini");
    }

    const json = await res.json();
    const b64 = json.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) throw new GenerationError(200, "Gemini returned no image data", false, "gemini");

    return {
      outputData:  `data:image/png;base64,${b64}`,
      contentType: "image/png",
    };
  }
}

export const geminiExecutor = new GeminiExecutor();
