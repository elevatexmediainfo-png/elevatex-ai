import type { ProviderCategory } from "@/generated/prisma/client";
import { getConfig } from "@/lib/admin/config";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/encryption";

// Milestone 10 — the ONE place that knows credentials/config might come from
// either the admin-editable ProviderConfig table (the new, zero-code path)
// or the original env-var-only model (Milestones 4/6, kept as a one-time
// migration fallback). Every adapter receives an already-resolved
// ProviderRuntimeConfig via its constructor and never reads process.env
// itself — adding a future provider never needs a second place taught about
// this fallback.
export interface ProviderRuntimeConfig {
  apiKey?: string;
  apiSecret?: string;
  extraSecret?: string;
  model?: string;
  defaultQuality?: string;
  timeoutMs?: number;
  retryCount?: number;
  extraConfig?: Record<string, string>;
}

interface LegacyEnvFallback {
  apiKeyVar?: string;
  apiSecretVar?: string;
  extraSecretVar?: string;
  modelVar?: string;
  // extraConfig key -> env var name
  extraConfigVars?: Record<string, string>;
}

// Exact env var names each adapter read directly before Milestone 10 — kept
// here, and ONLY here, so an instance deployed via .env before the Admin AI
// Providers page existed keeps working unchanged until an admin saves new
// values through the panel.
const LEGACY_ENV_FALLBACK: Record<string, LegacyEnvFallback> = {
  openai: { apiKeyVar: "OPENAI_API_KEY" },
  gemini: { apiKeyVar: "GEMINI_API_KEY", modelVar: "GEMINI_MODEL" },
  openai_images: { apiKeyVar: "OPENAI_API_KEY" },
  flux: { apiKeyVar: "REPLICATE_API_TOKEN", modelVar: "FLUX_MODEL_VERSION" },
  elevenlabs: { apiKeyVar: "ELEVENLABS_API_KEY" },
  replicate: { apiKeyVar: "REPLICATE_API_TOKEN", modelVar: "REPLICATE_MODEL_VERSION" },
  s3: {
    apiKeyVar: "S3_ACCESS_KEY_ID",
    apiSecretVar: "S3_SECRET_ACCESS_KEY",
    extraConfigVars: {
      bucket: "S3_BUCKET",
      region: "S3_REGION",
      endpoint: "S3_ENDPOINT",
      publicBaseUrl: "S3_PUBLIC_BASE_URL",
    },
  },
  razorpay: {
    apiKeyVar: "RAZORPAY_KEY_ID",
    apiSecretVar: "RAZORPAY_KEY_SECRET",
    extraSecretVar: "RAZORPAY_WEBHOOK_SECRET",
  },
};

function mergeExtraConfig(
  dbValue: unknown,
  fallbackVars?: Record<string, string>
): Record<string, string> | undefined {
  const merged: Record<string, string> = { ...((dbValue as Record<string, string> | null) ?? {}) };
  if (fallbackVars) {
    for (const [key, envVar] of Object.entries(fallbackVars)) {
      if (!merged[key]) {
        const envValue = process.env[envVar];
        if (envValue) merged[key] = envValue;
      }
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

// SECURITY/RELIABILITY (2026-07-27) — decryptSecret() throws (a raw Node
// `crypto` "Unsupported state or unable to authenticate data" GCM
// auth-tag error) whenever a row's ciphertext was encrypted under a
// DIFFERENT CREDENTIAL_ENCRYPTION_KEY than the one this process currently
// has (a key rotation, a row copied from another environment, or genuinely
// corrupted ciphertext) — confirmed live: this crashed the entire
// Dashboard render, since getContinueWorking() calls getStorageProvider()
// unconditionally on every load, which resolves credentials through this
// exact function with no error handling anywhere in between. One bad
// row must never take down every caller of this shared function — same
// "log and treat as absent" pattern already used by
// lib/admin/ai-providers.ts's listProviderConfigs() for the same failure
// mode, just applied here too, at the one place that was missing it.
function safeDecrypt(
  payload: string | null | undefined,
  category: ProviderCategory,
  providerId: string,
  field: "apiKey" | "apiSecret" | "extraSecret"
): string | undefined {
  if (!payload) return undefined;
  try {
    return decryptSecret(payload);
  } catch (err) {
    console.error(`[ProviderConfig] Failed to decrypt ${field} for ${category}/${providerId}:`, err);
    return undefined;
  }
}

// Resolves one provider's credentials/config: DB row first, legacy env vars
// only for whatever the DB row leaves unset.
export async function resolveProviderCredentials(
  category: ProviderCategory,
  providerId: string
): Promise<ProviderRuntimeConfig> {
  const row = await prisma.providerConfig.findUnique({
    where: { category_providerId: { category, providerId } },
  });
  const fallback = LEGACY_ENV_FALLBACK[providerId];

  const apiKey =
    safeDecrypt(row?.apiKeyEncrypted, category, providerId, "apiKey") ||
    (fallback?.apiKeyVar ? process.env[fallback.apiKeyVar] : undefined);
  const apiSecret =
    safeDecrypt(row?.apiSecretEncrypted, category, providerId, "apiSecret") ||
    (fallback?.apiSecretVar ? process.env[fallback.apiSecretVar] : undefined);
  const extraSecret =
    safeDecrypt(row?.extraSecretEncrypted, category, providerId, "extraSecret") ||
    (fallback?.extraSecretVar ? process.env[fallback.extraSecretVar] : undefined);
  const model = row?.model || (fallback?.modelVar ? process.env[fallback.modelVar] : undefined);

  return {
    apiKey: apiKey || undefined,
    apiSecret: apiSecret || undefined,
    extraSecret: extraSecret || undefined,
    model: model || undefined,
    defaultQuality: row?.defaultQuality ?? undefined,
    timeoutMs: row?.timeoutMs ?? undefined,
    retryCount: row?.retryCount ?? undefined,
    extraConfig: mergeExtraConfig(row?.extraConfig, fallback?.extraConfigVars),
  };
}

async function legacyPriorityList(category: ProviderCategory): Promise<string[]> {
  switch (category) {
    case "LLM":
      return getConfig("PROVIDER_LLM_PRIORITY");
    case "IMAGE":
      return getConfig("PROVIDER_IMAGE_PRIORITY");
    case "VOICE":
      return getConfig("PROVIDER_VOICE_PRIORITY");
    case "VIDEO":
      return getConfig("PROVIDER_VIDEO_PRIORITY");
    case "STORAGE": {
      // SECURITY (2026-07-23) — this legacy key's own schema default is
      // "mock" (admin/config.ts), which used to mean a truly fresh
      // install/a deleted ProviderConfig row silently resolved to Mock
      // storage the moment this fallback engaged, with nothing "wrong"
      // ever explicitly chosen by anyone. Only honor a REAL legacy value an
      // admin actually set pre-Milestone-10 (e.g. PROVIDER_STORAGE=s3 via
      // the old settings UI, credentials still in env vars) — never let the
      // bare, never-touched schema default stand in for a real choice.
      // getStorageProvider()'s own production check is the actual
      // enforcement; this just stops the unsafe value from ever reaching it.
      const legacy = await getConfig("PROVIDER_STORAGE");
      return legacy === "mock" ? [] : [legacy];
    }
    case "PAYMENT": {
      // SECURITY (2026-07-23) — identical reasoning to STORAGE above; see
      // that case's comment.
      const legacy = await getConfig("PROVIDER_PAYMENT");
      return legacy === "mock" ? [] : [legacy];
    }
    case "TRANSCRIPTION":
      // Milestone 11 — DB-only, no pre-existing SystemConfig priority key
      // (this category didn't exist before the Admin Panel did).
      return [];
    case "EMAIL":
      // Milestone 12 — same DB-only pattern as TRANSCRIPTION.
      return [];
    case "STOCK_MEDIA":
    case "ICON":
      // Milestone 26 — same DB-only pattern as TRANSCRIPTION/EMAIL; no
      // failover concept (a search UI picks a provider explicitly, it
      // doesn't try one then fall back to another).
      return [];
    case "VIDEO_UNDERSTANDING":
    case "REASONING":
      // Phase 12 Module 1 — same DB-only pattern as TRANSCRIPTION/EMAIL;
      // these categories didn't exist before the Admin Panel did either.
      return [];
  }
}

// Returns provider ids in try-order for a category. LLM/IMAGE/VOICE/VIDEO
// use this as a failover chain; STORAGE/PAYMENT (no failover concept) just
// take the first element. Falls back to the pre-Milestone-10 SystemConfig
// priority keys ONLY when the admin hasn't saved anything for this category
// in the new ProviderConfig table yet — once they save once, the DB is
// authoritative and an empty/all-disabled result legitimately means "use
// mock," not "fall back to the old config."
export async function listEnabledProviderConfigs(category: ProviderCategory): Promise<string[]> {
  const rows = await prisma.providerConfig.findMany({ where: { category } });
  if (rows.length === 0) {
    return legacyPriorityList(category);
  }
  return rows
    .filter((row) => row.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((row) => row.providerId);
}

export interface ProviderPolicyOverrides {
  timeoutMs?: number;
  retryCount?: number;
  dailyBudgetUsd?: number;
  monthlyBudgetUsd?: number;
  rateLimitPerMinute?: number;
}

// Lightweight sibling of resolveProviderCredentials() — reads only the
// non-secret per-provider policy columns, so the Generation Engine (which
// calls this on every attempt) never pays for a decrypt it doesn't need.
// Used to override the category-wide GENERATION_TIMEOUT_MS_*/
// GENERATION_RETRY_MAX_ATTEMPTS policy (lib/generation/engine.ts) and to
// enforce per-provider budgets/rate limits (lib/generation/budget.ts) —
// unset fields simply leave the category-wide default in place.
export async function getProviderPolicyOverrides(
  category: ProviderCategory,
  providerId: string
): Promise<ProviderPolicyOverrides> {
  const row = await prisma.providerConfig.findUnique({
    where: { category_providerId: { category, providerId } },
    select: {
      timeoutMs: true,
      retryCount: true,
      dailyBudgetUsd: true,
      monthlyBudgetUsd: true,
      rateLimitPerMinute: true,
    },
  });
  return {
    timeoutMs: row?.timeoutMs ?? undefined,
    retryCount: row?.retryCount ?? undefined,
    dailyBudgetUsd: row?.dailyBudgetUsd ?? undefined,
    monthlyBudgetUsd: row?.monthlyBudgetUsd ?? undefined,
    rateLimitPerMinute: row?.rateLimitPerMinute ?? undefined,
  };
}
