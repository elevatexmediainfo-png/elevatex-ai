import type { UniversalPrompt } from "../schema";
import { buildGenericPrompt } from "./generic.adapter";
import { buildOpenAIPrompt } from "./openai.adapter";
import { buildFluxPrompt } from "./flux.adapter";
import { buildIdeogramPrompt } from "./ideogram.adapter";
import { buildGeminiPrompt } from "./gemini.adapter";

export { buildGenericPrompt, buildOpenAIPrompt, buildFluxPrompt, buildIdeogramPrompt, buildGeminiPrompt };

type AdapterFn = (prompt: UniversalPrompt) => string;

// Resolves by image-provider id. Adding a new provider's adapter never
// requires touching call sites — register it here and it's live everywhere
// the registry is used (the literal "switching providers without changing
// application logic" requirement).
//
// [gemini_images routing fix] The real Gemini image provider (built in
// providers/image/gemini-images.provider.ts) registers itself under the id
// "gemini_images" (see IMAGE_PROVIDER_IDS in providers/image/index.ts) —
// this map only had the bare "gemini" key, a leftover placeholder from
// before the real provider existed. Every live Gemini AI_IMAGE generation
// was silently falling through to buildGenericPrompt (the no-match
// fallback), which carries no ethnicity instruction at all — confirmed by
// checking ProviderConfig directly (gemini_images is the only enabled IMAGE
// provider) and by reading buildGenericPrompt, which has zero ethnicity
// handling. This is the actual root cause of the Western-subjects bug, not
// a missing instruction inside gemini.adapter.ts (that adapter was never
// even being reached). Both ids kept for safety.
const ADAPTERS: Record<string, AdapterFn> = {
  openai_images: buildOpenAIPrompt,
  flux: buildFluxPrompt,
  ideogram: buildIdeogramPrompt,
  gemini: buildGeminiPrompt,
  gemini_images: buildGeminiPrompt,
};

export function resolvePromptAdapter(providerId: string | null | undefined): AdapterFn {
  if (providerId && ADAPTERS[providerId]) return ADAPTERS[providerId];
  return buildGenericPrompt;
}
