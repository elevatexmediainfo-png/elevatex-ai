// LLMOrchestrator — the single entry point for ALL LLM calls made by AI OS modules.
//
// Creative Director, Scene Planner, Prompt Spec, and Asset Understanding must call
// through here. No module inside lib/ai-os/* should import generateScript(),
// LLMProvider, or any lib/providers/llm/* type directly.
//
// Responsibilities:
//   1. Cache lookup / store (via cache.ts)
//   2. Provider selection (via factory.ts)
//   3. Unified error surface (throws with LLMOrchestratorError for typed handling)

import { getCached, isCacheable, setCached } from "./cache";
import { LLMFactory } from "./factory";
import type { AILLMHealth, AILLMRequest, AILLMResponse, AILLMVisionRequest, LLMTaskType } from "./types";

export class LLMOrchestratorError extends Error {
  constructor(
    message: string,
    public readonly taskType: LLMTaskType,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMOrchestratorError";
  }
}

export class LLMOrchestrator {
  // ── Text generation ─────────────────────────────────────────────────────────

  static async generateText(req: AILLMRequest): Promise<AILLMResponse> {
    const taskType: LLMTaskType = req.taskType ?? "creative_text";
    const language = req.language ?? "EN";

    if (isCacheable(taskType)) {
      const hit = getCached(req.prompt, taskType, language);
      if (hit) return hit;
    }

    try {
      const provider = LLMFactory.getDefault();
      const response = await provider.generateText({ ...req, taskType });
      if (isCacheable(taskType)) setCached(req.prompt, taskType, language, response);
      return response;
    } catch (err) {
      throw new LLMOrchestratorError(
        `LLM text generation failed (task=${taskType})`,
        taskType,
        err,
      );
    }
  }

  // ── JSON extraction ─────────────────────────────────────────────────────────

  static async generateJSON<T>(req: AILLMRequest): Promise<T> {
    const taskType: LLMTaskType = "json_extraction";
    const language = req.language ?? "EN";

    if (isCacheable(taskType)) {
      const hit = getCached(req.prompt, taskType, language);
      if (hit) {
        try {
          return JSON.parse(hit.text) as T;
        } catch {
          // Cache entry is corrupt — fall through to a fresh call.
        }
      }
    }

    try {
      const provider = LLMFactory.getDefault();
      const data = await provider.generateJSON<T>({ ...req, taskType });
      // Store serialized so the cache can serve both JSON and raw text consumers.
      setCached(req.prompt, taskType, language, {
        text: JSON.stringify(data),
        cached: false,
        taskType,
      });
      return data;
    } catch (err) {
      throw new LLMOrchestratorError(
        "LLM JSON extraction failed",
        taskType,
        err,
      );
    }
  }

  // ── Vision / image analysis ─────────────────────────────────────────────────

  static async analyzeImage(req: AILLMVisionRequest): Promise<AILLMResponse> {
    // Image analysis is never cached — image content can change at the same URL.
    try {
      const provider = LLMFactory.getDefault();
      return provider.analyzeImage({ ...req, taskType: "image_analysis" });
    } catch (err) {
      throw new LLMOrchestratorError(
        "LLM image analysis failed",
        "image_analysis",
        err,
      );
    }
  }

  // ── Health ──────────────────────────────────────────────────────────────────

  static async healthCheck(): Promise<AILLMHealth[]> {
    const provider = LLMFactory.getDefault();
    const result = await provider.healthCheck();
    return [result];
  }
}
