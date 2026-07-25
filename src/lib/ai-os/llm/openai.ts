// OpenAI adapter for the AI OS LLM layer.
// Does NOT call the OpenAI SDK directly — delegates to lib/generation/llm.ts
// (generateScript), which reads the admin-configured ProviderConfig table,
// handles priority ordering, retries, cost tracking, and failover automatically.
// Admin changes at /admin/ai-providers take effect with no redeploy.

import { generateScript } from "@/lib/generation/llm";
import type { AILLMProvider } from "./provider";
import type { AILLMHealth, AILLMRequest, AILLMResponse, AILLMVisionRequest, LLMTaskType } from "./types";
import { SYSTEM_PROMPTS } from "./types";

export class OpenAIAILLMProvider implements AILLMProvider {
  readonly providerId = "openai";

  async generateText(req: AILLMRequest): Promise<AILLMResponse> {
    const taskType: LLMTaskType = req.taskType ?? "creative_text";
    const result = await generateScript(
      {
        prompt: req.prompt,
        contentLanguage: req.language ?? "EN",
        systemPrompt: req.systemPrompt ?? SYSTEM_PROMPTS[taskType],
        responseFormat: "text",
      },
      undefined,
      req.operation ?? taskType,
      this.providerId,
    );
    return { text: result.text, providerRef: result.providerRef, cached: false, taskType };
  }

  async generateJSON<T>(req: AILLMRequest): Promise<T> {
    const taskType: LLMTaskType = "json_extraction";
    const result = await generateScript(
      {
        prompt: req.prompt,
        contentLanguage: req.language ?? "EN",
        systemPrompt: req.systemPrompt ?? SYSTEM_PROMPTS[taskType],
        responseFormat: "json",
      },
      undefined,
      req.operation ?? taskType,
      this.providerId,
    );
    return JSON.parse(result.text) as T;
  }

  async analyzeImage(req: AILLMVisionRequest): Promise<AILLMResponse> {
    const taskType: LLMTaskType = "image_analysis";
    const result = await generateScript(
      {
        prompt: req.prompt,
        contentLanguage: req.language ?? "EN",
        systemPrompt: req.systemPrompt ?? SYSTEM_PROMPTS[taskType],
        imageUrl: req.imageUrl,
        responseFormat: "text",
      },
      undefined,
      req.operation ?? taskType,
      this.providerId,
    );
    return { text: result.text, providerRef: result.providerRef, cached: false, taskType };
  }

  async healthCheck(): Promise<AILLMHealth> {
    const start = Date.now();
    try {
      await generateScript(
        { prompt: "Respond with exactly: OK", contentLanguage: "EN", responseFormat: "text" },
        undefined,
        "health_check",
        this.providerId,
      );
      return {
        providerId: this.providerId,
        status: "healthy",
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err) {
      return {
        providerId: this.providerId,
        status: "down",
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
