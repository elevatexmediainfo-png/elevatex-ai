import type { GenerationRequest, ProviderCredentials, ProviderRawOutput, ProviderExecutor } from "../types";
import { GenerationError, TRANSIENT_STATUS_CODES } from "../types";

// OpenAI GPT Image Executor.
// Calls the OpenAI /v1/images/generations endpoint.
// This is the ONLY place in the AI OS that makes OpenAI API calls.

const SIZE_BY_RATIO: Record<string, string> = {
  "1:1":   "1024x1024",
  "4:5":   "1024x1536",
  "16:9":  "1536x1024",
  "9:16":  "1024x1536",
};

const SIZE_BY_RATIO_FALLBACK = "1024x1024";

class OpenAIExecutor implements ProviderExecutor {
  readonly provider = "openai" as const;

  async execute(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal?: AbortSignal
  ): Promise<ProviderRawOutput> {
    const prompt = request.providerPrompt.body.finalPrompt;
    const size = SIZE_BY_RATIO[request.aspectRatio] ?? SIZE_BY_RATIO_FALLBACK;
    const quality = request.quality ?? "high";
    const outputFormat = request.outputFormat === "mp4" ? "png" : (request.outputFormat ?? "png");
    const model = credentials.model ?? "gpt-image-1.5";

    // Use edits endpoint when reference images are provided
    if (request.referenceImages && request.referenceImages.length > 0) {
      return this.executeEdits(request, credentials, signal, prompt, size, quality, outputFormat, model);
    }

    const body: Record<string, unknown> = { model, prompt, size, quality, n: 1 };
    if (request.backgroundMode) body.background = request.backgroundMode;
    if (outputFormat !== "png") body.output_format = outputFormat;

    const startTime = Date.now();
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerationError(res.status, `OpenAI error (${res.status}): ${text.slice(0, 200)}`,
        TRANSIENT_STATUS_CODES.has(res.status), "openai");
    }

    const json = await res.json();
    const item = json.data?.[0];
    const outputData = item?.b64_json ? `data:image/${outputFormat};base64,${item.b64_json}` : item?.url;
    if (!outputData) throw new GenerationError(200, "OpenAI returned no image data", false, "openai");

    return { outputData, contentType: `image/${outputFormat}`, metadata: { latencyMs: Date.now() - startTime } };
  }

  private async executeEdits(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal: AbortSignal | undefined,
    prompt: string,
    size: string,
    quality: string,
    outputFormat: string,
    model: string
  ): Promise<ProviderRawOutput> {
    // Edits endpoint requires multipart form data — simplified implementation
    // In production, this would use FormData with actual image files
    const body: Record<string, unknown> = {
      model, prompt, size, quality, n: 1,
      // Reference images would be sent as file uploads
    };

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerationError(res.status, `OpenAI edits error (${res.status}): ${text.slice(0, 200)}`,
        TRANSIENT_STATUS_CODES.has(res.status), "openai");
    }

    const json = await res.json();
    const item = json.data?.[0];
    const outputData = item?.b64_json ? `data:image/${outputFormat};base64,${item.b64_json}` : item?.url;
    if (!outputData) throw new GenerationError(200, "OpenAI edits returned no image data", false, "openai");

    void outputFormat;
    return { outputData, contentType: `image/${outputFormat}` };
  }
}

export const openaiExecutor = new OpenAIExecutor();
