import type { LLMGenerateRequest, LLMGenerateResult, LLMProvider } from "./types";

// Generic adapter for any self-hosted/local model server — the seam future
// self-hosted models plug into (e.g. Ollama, vLLM, or a custom inference
// box behind a thin shim). The contract is deliberately minimal so this
// codebase never needs to know which engine is actually running:
//   POST {prompt, contentLanguage} -> {text, tokens?}
// Included in the LLM provider priority list by adding "self_hosted" to
// PROVIDER_LLM_PRIORITY; requires SELF_HOSTED_LLM_URL. The same contract
// shape (URL + optional bearer token env var) is the pattern to follow when
// adding self-hosted Image/Voice/Video adapters later.
export class SelfHostedLLMProvider implements LLMProvider {
  readonly id = "self_hosted";
  readonly category = "LLM" as const;

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    const url = process.env.SELF_HOSTED_LLM_URL;
    if (!url) {
      throw new Error(
        "self_hosted is in the LLM provider priority list but SELF_HOSTED_LLM_URL is not configured."
      );
    }
    const apiKey = process.env.SELF_HOSTED_LLM_API_KEY;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ prompt: req.prompt, contentLanguage: req.contentLanguage }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Self-hosted LLM request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    if (typeof json.text !== "string") {
      throw new Error("Self-hosted LLM response did not contain a `text` field.");
    }

    return { text: json.text, usage: { tokens: json.tokens } };
  }
}
