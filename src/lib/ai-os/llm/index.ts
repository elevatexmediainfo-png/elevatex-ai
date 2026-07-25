// Public API for the AI OS LLM module.
//
// Consumers (Creative Director, Scene Planner, Prompt Spec, Asset Understanding)
// import exclusively from here. Never import from sub-files directly.
//
// Usage:
//   import { LLMOrchestrator } from "@/lib/ai-os/llm";
//   const { text } = await LLMOrchestrator.generateText({ prompt, taskType: "analysis" });

export { LLMOrchestrator, LLMOrchestratorError } from "./engine";
export { LLMFactory } from "./factory";
export { clearLLMCache, llmCacheSize } from "./cache";

export type {
  AILLMRequest,
  AILLMVisionRequest,
  AILLMResponse,
  AILLMHealth,
  LLMTaskType,
} from "./types";

export type { AILLMProvider } from "./provider";
