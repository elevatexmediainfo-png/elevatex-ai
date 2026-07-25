import type { GenerationRequest, ProviderCredentials, ProviderRawOutput, ProviderExecutor } from "../types";
import { GenerationError, TRANSIENT_STATUS_CODES } from "../types";

// Runway Gen-4 Video Executor.

class RunwayExecutor implements ProviderExecutor {
  readonly provider = "runway" as const;

  async execute(
    request: GenerationRequest,
    credentials: ProviderCredentials,
    signal?: AbortSignal
  ): Promise<ProviderRawOutput> {
    const prompt = request.providerPrompt.body.finalPrompt;
    const ratio = request.aspectRatio === "9:16" ? "9:16" : "16:9";

    const body: Record<string, unknown> = {
      promptText: prompt,
      model: credentials.model ?? "gen4_turbo",
      ratio,
      duration: 5,
    };

    if (request.referenceImages?.[0]) {
      body.promptImage = request.referenceImages[0].url;
    }

    const res = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerationError(res.status, `Runway error (${res.status}): ${text.slice(0, 200)}`,
        TRANSIENT_STATUS_CODES.has(res.status), "runway");
    }

    const json = await res.json();
    const taskId = json.id;
    if (!taskId) throw new GenerationError(200, "Runway did not return a task ID", false, "runway");

    // For now, return the task ID as a reference (polling handled by caller)
    return { outputUrl: `runway://task/${taskId}`, contentType: "video/mp4" };
  }
}

export const runwayExecutor = new RunwayExecutor();
