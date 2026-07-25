// Phase 5 — GPT Creative Director Engine.
//
// runGPTCreativeDirector() is the async GPT-powered Creative Director.
// It wraps the deterministic buildCampaignPlan() as a SILENT fallback:
// the user never experiences a failure — if GPT fails, the deterministic plan
// is returned as if it were the primary result.
//
// Call path:
//   runGPTCreativeDirector(input)
//     → LLMOrchestrator.generateText (via lib/ai-os/llm — NEVER generateScript directly)
//     → validateGPTCampaignDirection
//     → on failure: retry once → on double failure: buildCampaignPlan (fallback)

import { LLMOrchestrator } from "@/lib/ai-os/llm";
import { buildCreativeContext } from "@/lib/ai-os/creative-decision-engine";
import { buildCampaignPlan } from "./engine";
import { buildCreativeDirectorPrompt, buildRepairPrompt, GPT_CD_SYSTEM_PROMPT } from "./gpt-prompt";
import type { GPTCampaignDirection, GPTDirectorDebug, GPTDirectorInput, GPTDirectorResult } from "./gpt-types";
import { validateGPTCampaignDirection } from "./gpt-validation";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function stripMarkdownFences(text: string): string {
  // Some models wrap JSON in ```json ... ``` despite instructions — strip them.
  return text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
}

async function callGPT(
  prompt:       string,
  systemPrompt: string,
): Promise<{ direction: GPTCampaignDirection; rawOutput: string; providerRef: string | null }> {
  const response = await LLMOrchestrator.generateText({
    prompt,
    language:      "EN",
    taskType:      "json_extraction",
    systemPrompt,
    operation:     "creative_director",
  });

  const rawOutput  = response.text;
  const providerRef = response.providerRef ?? null;
  const cleaned    = stripMarkdownFences(rawOutput);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (jsonErr) {
    throw new Error(`JSON parse failed: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`);
  }

  const direction = validateGPTCampaignDirection(parsed);
  return { direction, rawOutput, providerRef };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function runGPTCreativeDirector(
  input: GPTDirectorInput,
): Promise<GPTDirectorResult> {
  const start = Date.now();

  // Always compute the deterministic plan — it is the fallback AND a useful
  // comparison target in the admin debug panel even when GPT succeeds.
  const fallbackPlan = buildCampaignPlan(input.strategy);

  const basePrompt = buildCreativeDirectorPrompt(input);
  const ctx = buildCreativeContext({
    industry:     input.strategy.business.industry.value ?? "",
    rawIdea:      input.rawIdea ?? "",
    campaignGoal: input.strategy.marketing.campaignGoal.value,
    campaignType: input.strategy.marketing.campaignGoal.value ?? undefined,
  });
  const prompt         = ctx ? `${basePrompt}\n\n${ctx}` : basePrompt;
  const promptSizeChars = prompt.length;

  let direction:   GPTCampaignDirection | null = null;
  let rawOutput:   string | null               = null;
  let providerRef: string | null               = null;
  let error:       string | null               = null;
  let retryCount                               = 0;
  let mode: "gpt" | "fallback"                 = "gpt";

  // ── First attempt ──────────────────────────────────────────────────────────
  try {
    const result = await callGPT(prompt, GPT_CD_SYSTEM_PROMPT);
    direction   = result.direction;
    rawOutput   = result.rawOutput;
    providerRef = result.providerRef;
  } catch (firstErr) {
    const firstErrMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);

    // ── One retry with a repair prompt ────────────────────────────────────────
    retryCount++;
    try {
      const repairPrompt = buildRepairPrompt(prompt, firstErrMsg);
      const result        = await callGPT(repairPrompt, GPT_CD_SYSTEM_PROMPT);
      direction   = result.direction;
      rawOutput   = result.rawOutput;
      providerRef = result.providerRef;
    } catch (secondErr) {
      // Both attempts failed → silent fallback
      error = secondErr instanceof Error ? secondErr.message : String(secondErr);
      mode  = "fallback";
    }
  }

  const debug: GPTDirectorDebug = {
    executionTimeMs:  Date.now() - start,
    model:            providerRef,
    tokenUsage:       null, // token usage flows to cost tracker at generation layer; not surfaced here
    rawOutput,
    retryCount,
    promptSizeChars,
    error,
  };

  return { direction, fallbackPlan, mode, debug };
}
