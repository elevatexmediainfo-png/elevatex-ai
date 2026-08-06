// Fix (2026-08-06) — real production incident: Timeline Planning
// (lib/providers/reasoning/gpt5.provider.ts) started failing with OpenAI's
// own 400 error `Unsupported value: 'temperature'. Only the default (1)
// value is supported.` OpenAI's REASONING-TIER models — the o-series
// (o1, o1-mini, o3, o3-mini, o4-mini, ...) and the GPT-5 family
// (gpt-5, gpt-5-mini, gpt-5-nano, and any future gpt-5.x variant) — do
// NOT accept a custom `temperature` value via the Chat Completions API at
// all; only the default (1, i.e. omitted) is accepted. Every OTHER OpenAI
// chat model (gpt-4o, gpt-4o-mini, gpt-4.1, gpt-3.5-turbo, ...) DOES
// support a custom temperature and must keep getting one — dropping it
// for those would silently make their output more deterministic/less
// varied than intended, a real regression of its own.
//
// Detected by NAMING CONVENTION (OpenAI's own model-family prefixes), not
// a fixed list of exact model ids — a hardcoded allowlist would need a
// code change every time OpenAI ships a new reasoning-tier model (gpt-5.1,
// gpt-6, o5, ...), which is exactly the "hardcoding" this fix was asked to
// avoid. This is the same prefix-based heuristic other OpenAI SDKs/clients
// (Vercel AI SDK, LangChain) already use for the identical reason.
//
// Shared (not gpt5.provider.ts-only) since ANY OpenAI Chat Completions
// caller in this codebase has an admin-configurable `model` field and
// could in principle be pointed at a reasoning-tier model — one place to
// get this right, not a copy per adapter.
const OPENAI_REASONING_MODEL_PREFIX_RE = /^(o\d|gpt-5)/i;

export function isOpenAIReasoningModel(model: string): boolean {
  return OPENAI_REASONING_MODEL_PREFIX_RE.test(model.trim());
}

// true when a custom (non-default) `temperature` value is safe to send to
// this model via OpenAI's Chat Completions API.
export function supportsCustomTemperature(model: string): boolean {
  return !isOpenAIReasoningModel(model);
}

// Spreads `{ temperature }` into a request body ONLY when the selected
// model actually supports a custom value — omitted entirely (not sent as
// `undefined`, which JSON.stringify would still drop, but explicit intent
// reads better at the call site) for a reasoning-tier model, so that
// model gets OpenAI's own default (1) rather than a rejected override.
export function chatTemperatureParam(model: string, temperature: number): { temperature: number } | Record<string, never> {
  return supportsCustomTemperature(model) ? { temperature } : {};
}
