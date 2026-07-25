import type { GenerationRequest, ProviderCredentials, ProviderRawOutput, ProviderExecutor } from "../types";
import { GenerationError, TRANSIENT_STATUS_CODES } from "../types";

// Kling AI Video Executor.

class KlingExecutor implements ProviderExecutor {
  readonly provider = "kling" as const;

  async execute(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal?: AbortSignal
  ): Promise<ProviderRawOutput> {
    const prompt = request.providerPrompt.body.finalPrompt;
    const negativePrompt = request.providerPrompt.body.negativePrompt;
    const ratio = request.aspectRatio === "9:16" ? "9:16" : request.aspectRatio === "1:1" ? "1:1" : "16:9";
    const model = credentials.model ?? "kling-v2-0";

    const body: Record<string, unknown> = {
      model_name: model,
      prompt,
      negative_prompt: negativePrompt ?? "",
      cfg_scale: 0.5,
      mode: "pro",
      aspect_ratio: ratio,
      duration: "5",
    };

    const res = await fetch("https://api.klingai.com/v1/videos/text2video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerationError(res.status, `Kling error (${res.status}): ${text.slice(0, 200)}`,
        TRANSIENT_STATUS_CODES.has(res.status), "kling");
    }

    const json = await res.json();
    const taskId = json.data?.task_id;
    if (!taskId) throw new GenerationError(200, "Kling did not return a task ID", false, "kling");

    return { outputUrl: `kling://task/${taskId}`, contentType: "video/mp4" };
  }
}

export const klingExecutor = new KlingExecutor();
