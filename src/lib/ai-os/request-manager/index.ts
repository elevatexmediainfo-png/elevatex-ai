import { ZodError } from "zod";
import { enhanceCreativePromptSchema } from "@/lib/validations/creative";
import { checkRateLimit } from "@/lib/security/rate-limit";
import type { CreativeRequest } from "../types";

// Phase 1 — AI Request Manager.
// Single responsibility: parse and validate an incoming creative request,
// enforce rate limits, and produce a typed CreativeRequest ready for the
// AI pipeline. Returns a discriminated union (ok/error) so callers can map
// error cases to HTTP responses without coupling this module to NextResponse.

export interface CreativeRequestError {
  type: "RATE_LIMITED" | "VALIDATION_ERROR";
  message: string;
  details?: unknown;
  retryAfterSeconds?: number;
}

export type BuildRequestResult =
  | { ok: true; request: CreativeRequest }
  | { ok: false; error: CreativeRequestError };

// ─────────────────────────────────────────────────────────────────────────────
// Prompt injection sanitizer
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns that signal an attempt to hijack the AI system via prompt injection.
 *  Each entry is a case-insensitive substring or regex fragment. */
const INJECTION_PATTERNS: RegExp[] = [
  // Direct override commands
  /ignore\s+(all\s+)?(?:previous|prior|above|earlier|the)?\s*(instructions?|rules?|context|prompt|guidelines?)/i,
  /forget\s+(all\s+)?(?:previous|prior|above|your|the)?\s*(instructions?|rules?|context|training|guidelines?)/i,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)/i,
  /override\s+(all\s+)?(instructions?|rules?|guidelines?|prompt)/i,
  /bypass\s+(all\s+)?(safety|filters?|guidelines?|rules?|restrictions?)/i,
  /discard\s+(all\s+)?(previous|prior|instructions?)/i,

  // Role-switching attempts — specific AI brand names + generic role switching
  /act\s+as\s+(?:chatgpt|gpt-?4?|claude|gemini|llama|dan|an?\s+ai)/i,
  /you\s+are\s+now\s+(?:chatgpt|gpt-?4?|claude|gemini|dan|an?\s+ai)/i,
  /act\s+as\s+(a\s+|an\s+)?(unrestricted|uncensored|unfiltered|jailbroken|unlimited|different|evil)/i,
  /act\s+as\s+(a\s+|an\s+)?[\w\s]{1,30}(without|who\s+ignores?|who\s+doesn)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a\s+|an\s+)?/i,
  /roleplay\s+as\s+(a\s+|an\s+)?/i,
  /act\s+as\s+an?\s+(?:unrestricted|uncensored|unfiltered|different)/i,

  // Developer / system prompt injection
  /system\s+prompt/i,
  /developer\s+prompt/i,
  /\[?user\s*prompt\]?/i,
  /\[?assistant\s*prompt\]?/i,
  /###\s*(system|instruction|prompt)/i,
  /<<<\s*(system|instruction|prompt)/i,

  // Jailbreak keywords
  /jailbreak/i,
  /dan\s+mode/i,
  /developer\s+mode/i,
  /god\s+mode/i,
  /unrestricted\s+(ai|assistant|mode|bot)/i,
  /no\s+restrictions?\s+mode/i,

  // Execute / command injection
  /execute\s+(this\s+)?(command|instruction|code|script)/i,
  /run\s+this\s+(command|script|code)/i,
  /output\s+(only|nothing\s+but)\s+(the\s+)?following/i,
  /print\s+your\s+(system\s+)?prompt/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  /show\s+me\s+your\s+(system\s+)?prompt/i,
  /what\s+(are\s+)?your\s+(system\s+)?instructions?/i,

  // Generic instruction manipulation
  /new\s+instructions?:/i,
  /from\s+now\s+on[,\s]+you\s+(will|must|should)/i,
  /for\s+this\s+(task|request|conversation)[,\s]+you\s+(will|must|should)\s+(not|ignore)/i,
];

/** Returns true if the text contains one or more injection patterns. */
export function containsInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

/** Sanitizes a user idea string by neutralizing injection sequences.
 *  The original meaning is preserved — only injected control instructions are stripped.
 *
 *  Strategy:
 *  1. Split the text into sentences (by . ! ? and newline).
 *  2. Drop any sentence that matches a known injection pattern.
 *  3. Re-join the remaining sentences.
 *  4. If nothing remains, return a safe empty-ish string that won't crash downstream.
 */
export function sanitizeIdea(raw: string): string {
  if (!raw || raw.trim().length === 0) return raw;

  // Split on sentence-ending punctuation and line breaks, preserving delimiters
  const sentences = raw.split(/(?<=[.!?\n])\s*/).filter(Boolean);

  const clean = sentences.filter((s) => !containsInjection(s));

  const result = clean.join(" ").replace(/\s{2,}/g, " ").trim();

  // If the entire input was injection (nothing survived), return a neutral placeholder
  // so downstream modules receive something parseable rather than an empty string.
  return result.length > 0 ? result : "creative advertisement";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/** Builds a CreativeRequest from a raw (pre-parsed) request body and the
 *  authenticated userId. Enforces the "ai_assistant" rate-limit bucket and
 *  runs Zod validation via enhanceCreativePromptSchema.
 *
 *  The returned CreativeRequest always has:
 *  - `rawIdea`         — sanitized, safe for downstream AI prompts
 *  - `originalRawIdea` — the user's original text, for audit/logging only */
export async function buildEnhancePromptRequest(
  rawBody: unknown,
  userId: string
): Promise<BuildRequestResult> {
  // Rate-limit check — same bucket/key as before the refactor.
  const rateLimit = await checkRateLimit("ai_assistant", userId);
  if (!rateLimit.allowed) {
    return {
      ok: false,
      error: {
        type: "RATE_LIMITED",
        message: "You've hit the hourly limit for prompt enhancement. Please try again later.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
    };
  }

  // Schema validation.
  try {
    const { prompt, kind, presetKey, referenceAssetId, logoAssetId } = enhanceCreativePromptSchema.parse(rawBody);

    const originalRawIdea = prompt;
    const rawIdea = sanitizeIdea(prompt);

    return {
      ok: true,
      request: {
        userId,
        rawIdea,
        originalRawIdea,
        kind,
        presetKey,
        referenceAssetId,
        logoAssetId,
        requestedAt: new Date(),
      },
    };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: {
          type: "VALIDATION_ERROR",
          message: "Please describe what you want, then try again.",
          details: err.issues,
        },
      };
    }
    throw err; // Unexpected error — let the caller's catch handle it
  }
}
