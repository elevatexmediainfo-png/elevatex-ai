import type { ProviderCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/security/encryption";
import { testProviderConnection } from "@/lib/providers/test-connection";
import { resolveProviderCredentials } from "@/lib/providers/credentials";

// The fixed catalogue of admin-configurable providers per category — the
// list the Admin AI Providers page renders even before a row exists in the
// DB. "mock" is never listed (it needs no credentials, and is always the
// implicit final fallback); "self_hosted" (LLM) is intentionally excluded
// too — it's a URL, not an apiKey/apiSecret pair, so it stays env-var-only
// (SELF_HOSTED_LLM_URL), unchanged from Milestone 6.
export interface ProviderCatalogueEntry {
  category: ProviderCategory;
  providerId: string;
  label: string;
  requiresApiSecret: boolean;
  requiresExtraSecret: boolean;
  extraConfigFields: { key: string; label: string }[];
  // Real bug fix (2026-07-24) — the generic "API Key" label was genuinely
  // misleading for providers whose vendor docs (and error messages) call
  // the exact same single credential something else entirely. Optional,
  // defaults to "API Key" everywhere else; does NOT add a second
  // credential field — every provider still has exactly one apiKey slot,
  // this only changes what the form calls it.
  apiKeyLabel?: string;
}

export const PROVIDER_CATALOGUE: ProviderCatalogueEntry[] = [
  { category: "LLM", providerId: "openai", label: "OpenAI (GPT)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "LLM", providerId: "gemini", label: "Google Gemini", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "IMAGE", providerId: "openai_images", label: "OpenAI (GPT Image)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "IMAGE", providerId: "flux", label: "Flux Pro (Replicate)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "IMAGE", providerId: "ideogram", label: "Ideogram (best-effort)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Separate providerId from the LLM "gemini" row on purpose (same pattern
  // as openai vs openai_images) — its own enable/model/priority/budget,
  // even though the founder will likely paste the same underlying Google
  // API key into both. Default model gemini-3-pro-image ("Nano Banana
  // Pro") — confirmed working end-to-end with a billing-enabled project
  // via a real generation call (200, real image returned in ~20-30s).
  // Served over Google's newer /v1beta/interactions API, NOT the classic
  // :generateContent endpoint the LLM "gemini" provider uses — see
  // gemini-images.provider.ts.
  { category: "IMAGE", providerId: "gemini_images", label: "Google Gemini (Nano Banana Pro)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Google's Imagen line — a distinct model family and REST shape (:predict,
  // instances/parameters) from gemini-3-pro-image above, not a mode toggle
  // on the same provider. Confirmed via Google's own current docs that the
  // imagen-4.0-generate-001 endpoints are DEPRECATED, shutting down
  // 2026-08-17 — added anyway per explicit request, short-lived by design.
  { category: "IMAGE", providerId: "imagen", label: "Google Imagen 4 (deprecated 2026-08-17)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VOICE", providerId: "elevenlabs", label: "ElevenLabs", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Real, free, no-key TTS fallback (2026-07-25) — listed here (unlike
  // "mock") so an admin can see it and, if they ever want to, explicitly
  // disable it. Unlike every other catalogue entry, generateVoiceover()
  // (lib/generation/voice.ts) treats this one as implicitly available even
  // with no ProviderConfig row at all — see that file's own comment for why
  // a resilience safety net can't depend on a founder remembering to flip
  // an admin toggle first.
  { category: "VOICE", providerId: "edge_tts", label: "Edge TTS (free, unofficial — real fallback when ElevenLabs is unavailable)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "TRANSCRIPTION", providerId: "openai_whisper", label: "OpenAI Whisper (whisper-1 — on OpenAI's retirement schedule)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // 2026-07-12 provider review — recommended default: native word-level
  // timestamps + documented Hindi/Hinglish code-switching (Universal-3.5
  // Pro), without depending on a model OpenAI is sunsetting. See
  // assemblyai.provider.ts's header comment for the full comparison.
  { category: "TRANSCRIPTION", providerId: "assemblyai", label: "AssemblyAI (Hindi/Hinglish code-switching)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Phase 12 Module 1 — a distinct providerId from openai_whisper (same
  // "different model, different endpoint, own slot" reasoning as IMAGE's
  // openai_images vs LLM's openai): gpt-4o-transcribe is a newer OpenAI
  // model/endpoint, not a mode toggle on whisper-1. Credential slot ready;
  // no adapter yet (see stock-media/registry.ts's iconscout entry for the
  // established "slot ready, adapter later" pattern this follows).
  { category: "TRANSCRIPTION", providerId: "gpt4o_transcribe", label: "OpenAI (gpt-4o-transcribe)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VIDEO", providerId: "replicate", label: "Replicate", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VIDEO", providerId: "veo", label: "Google Veo (best-effort)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VIDEO", providerId: "kling", label: "Kling AI (best-effort)", requiresApiSecret: true, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VIDEO", providerId: "hailuo", label: "Hailuo / MiniMax (best-effort)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VIDEO", providerId: "runway", label: "Runway (best-effort)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VIDEO", providerId: "sora", label: "OpenAI Sora (best-effort)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VIDEO", providerId: "seedance2", label: "Seedance 2 / ByteDance (best-effort)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Phase 12 Module 1 — two more VIDEO (generation) providers the AI Auto-
  // Editor's B-roll generation-fallback step needs, per the founder's own
  // list ("Gemini Omni/Seedance/OmniHuman") — Seedance is already covered
  // above (seedance2); these are the two genuinely missing ones. Both
  // credential slots only, no adapter yet.
  { category: "VIDEO", providerId: "gemini_omni", label: "Google Gemini Omni (video, best-effort)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "VIDEO", providerId: "omnihuman", label: "OmniHuman / ByteDance (best-effort)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Phase 12 Module 1 — Gemini "watching" the uploaded video + audio
  // together (emphasis/emotion/gestures/visual context, all timestamped)
  // for the scene-removal and B-roll-placement planning steps. Credential
  // slot only; no adapter yet.
  { category: "VIDEO_UNDERSTANDING", providerId: "gemini", label: "Google Gemini (video understanding)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Phase 12 Module 1 — combines the transcript + VIDEO_UNDERSTANDING's
  // output into real scene-removal/timeline-planning decisions. Credential
  // slot only; no adapter yet.
  { category: "REASONING", providerId: "gpt5", label: "OpenAI (GPT-5.x reasoning)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  {
    category: "STORAGE",
    providerId: "s3",
    label: "S3 / Cloudflare R2",
    requiresApiSecret: true,
    requiresExtraSecret: false,
    extraConfigFields: [
      { key: "bucket", label: "Bucket" },
      { key: "region", label: "Region" },
      { key: "endpoint", label: "Endpoint (R2/MinIO only — leave blank for AWS S3)" },
      { key: "publicBaseUrl", label: "Public base URL (optional override)" },
    ],
  },
  {
    category: "PAYMENT",
    providerId: "razorpay",
    label: "Razorpay",
    requiresApiSecret: true,
    requiresExtraSecret: true,
    extraConfigFields: [],
  },
  // Milestone 12 — transactional email (render-complete notices, receipts,
  // admin broadcasts). DB-only category, same as TRANSCRIPTION — no legacy
  // env-var fallback existed before this milestone.
  { category: "EMAIL", providerId: "resend", label: "Resend", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [{ key: "fromAddress", label: "From address (e.g. notifications@yourdomain.com)" }] },
  // Milestone 26 — Admin Settings: live-API stock media/icon search
  // providers for the Creative Studio Sidebar (Module 11) and future Image
  // Generation reference search. One row per provider, single API key each.
  // See lib/providers/stock-media/ for the search/fetch adapters and
  // lib/providers/test-connection.ts for each provider's health check.
  { category: "STOCK_MEDIA", providerId: "pexels", label: "Pexels (stock video + image)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "STOCK_MEDIA", providerId: "pixabay", label: "Pixabay (stock video + image)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "STOCK_MEDIA", providerId: "lottiefiles", label: "LottieFiles (adapter not yet built — no confirmed public API)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Stock providers expansion (2026-07-18) — same "credential slot ready,
  // key added later" pattern IconScout/Icons8 already established: the
  // adapter is real and fully wired (stock-media/registry.ts), just
  // waiting on a founder-provided key. Coverr covers video + music (its
  // own terms REQUIRE attribution — see coverr.adapter.ts); Unsplash
  // covers images (requires attribution per its API Terms, a real finding
  // distinct from its general/website license — see unsplash.adapter.ts's
  // own doc comment).
  { category: "STOCK_MEDIA", providerId: "coverr", label: "Coverr (stock video + music — attribution required)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  { category: "STOCK_MEDIA", providerId: "unsplash", label: "Unsplash (stock images — attribution required per API Terms)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // No API key required at all — search is public. Attribution is
  // per-item (driven by each result's own CC license, see
  // openverse.adapter.ts) rather than a blanket provider-level flag.
  { category: "STOCK_MEDIA", providerId: "openverse", label: "Openverse (images + audio, 50+ sources — no API key required)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
  // Real, working adapter (stock-media/iconscout.adapter.ts) — the stale
  // "adapter not yet built" note that used to sit here applied to icons8
  // below, not this one; left it on the wrong line by mistake. IconScout's
  // API authenticates via a header literally named "Client-ID" (confirmed
  // live: their own error is `{"message":"Client-ID is missing."}`), which
  // is exactly what this provider's single apiKey credential IS — not a
  // second field, just a clearer label than the generic default so an
  // admin isn't left guessing which of their IconScout dashboard's values
  // goes in a field labeled "API Key" (2026-07-24 fix).
  { category: "ICON", providerId: "iconscout", label: "IconScout (icons + Lottie animations)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [], apiKeyLabel: "Client-ID" },
  { category: "ICON", providerId: "icons8", label: "Icons8 (adapter not yet built)", requiresApiSecret: false, requiresExtraSecret: false, extraConfigFields: [] },
];

export interface ProviderConfigSummary {
  category: ProviderCategory;
  providerId: string;
  label: string;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  hasApiSecret: boolean;
  apiSecretMasked: string | null;
  hasExtraSecret: boolean;
  model: string | null;
  defaultQuality: string | null;
  priority: number;
  monthlyBudgetUsd: number | null;
  dailyBudgetUsd: number | null;
  rateLimitPerMinute: number | null;
  timeoutMs: number | null;
  retryCount: number | null;
  extraConfig: Record<string, string> | null;
  keyExpiresAt: Date | null;
  lastTestedAt: Date | null;
  lastTestResult: boolean | null;
  lastTestError: string | null;
}

// Never returns a decrypted secret in full — only enough trailing
// characters (maskSecret) to confirm which key is saved, per Part 9's "never
// expose secrets" rule.
export async function listProviderConfigs(): Promise<ProviderConfigSummary[]> {
  const rows = await prisma.providerConfig.findMany();
  const rowByKey = new Map(rows.map((r) => [`${r.category}:${r.providerId}`, r]));

  return PROVIDER_CATALOGUE.map((entry) => {
  const row = rowByKey.get(`${entry.category}:${entry.providerId}`);

  let apiKeyMasked: string | null = null;
  if (row?.apiKeyEncrypted) {
    try {
      apiKeyMasked = maskSecret(decryptSecret(row.apiKeyEncrypted));
    } catch (err) {
      console.error(
        `[ProviderConfig] Failed to decrypt API key for ${row.category}/${row.providerId}`,
        err
      );
    }
  }

  let apiSecretMasked: string | null = null;
  if (row?.apiSecretEncrypted) {
    try {
      apiSecretMasked = maskSecret(decryptSecret(row.apiSecretEncrypted));
    } catch (err) {
      console.error(
        `[ProviderConfig] Failed to decrypt API secret for ${row.category}/${row.providerId}`,
        err
      );
    }
  }

  return {
    category: entry.category,
    providerId: entry.providerId,
    label: entry.label,
    enabled: row?.enabled ?? false,
    hasApiKey: !!row?.apiKeyEncrypted,
    apiKeyMasked,
    hasApiSecret: !!row?.apiSecretEncrypted,
    apiSecretMasked,
    hasExtraSecret: !!row?.extraSecretEncrypted,
    model: row?.model ?? null,
    defaultQuality: row?.defaultQuality ?? null,
    priority: row?.priority ?? 0,
    monthlyBudgetUsd: row?.monthlyBudgetUsd ?? null,
    dailyBudgetUsd: row?.dailyBudgetUsd ?? null,
    rateLimitPerMinute: row?.rateLimitPerMinute ?? null,
    timeoutMs: row?.timeoutMs ?? null,
    retryCount: row?.retryCount ?? null,
    extraConfig: (row?.extraConfig as Record<string, string> | null) ?? null,
    keyExpiresAt: row?.keyExpiresAt ?? null,
    lastTestedAt: row?.lastTestedAt ?? null,
    lastTestResult: row?.lastTestResult ?? null,
    lastTestError: row?.lastTestError ?? null,
  };
});
    };
  });
}

export function findCatalogueEntry(category: ProviderCategory, providerId: string): ProviderCatalogueEntry | undefined {
  return PROVIDER_CATALOGUE.find((e) => e.category === category && e.providerId === providerId);
}

export interface ExpiringProviderKey {
  category: ProviderCategory;
  providerId: string;
  label: string;
  keyExpiresAt: Date;
  expired: boolean;
}

// Milestone 10 Part 9 — key expiration reminders. The per-card banner on the
// AI Providers page only fires for an admin who opens that exact card; this
// powers a reminder visible across every /admin page (admin/layout.tsx) so
// an expiring key can't go unnoticed just because nobody happened to visit
// that one provider's settings.
export async function listExpiringProviderKeys(withinDays = 7): Promise<ExpiringProviderKey[]> {
  const cutoff = new Date(Date.now() + withinDays * 86_400_000);
  const rows = await prisma.providerConfig.findMany({
    where: { enabled: true, keyExpiresAt: { not: null, lte: cutoff } },
  });

  return rows
    .map((row) => {
      const entry = findCatalogueEntry(row.category, row.providerId);
      return {
        category: row.category,
        providerId: row.providerId,
        label: entry?.label ?? row.providerId,
        keyExpiresAt: row.keyExpiresAt as Date,
        expired: (row.keyExpiresAt as Date).getTime() < Date.now(),
      };
    })
    .sort((a, b) => a.keyExpiresAt.getTime() - b.keyExpiresAt.getTime());
}

// PATCH-style partial update: a field is only touched when the caller's raw
// JSON body actually included that key. This is what lets the Admin Panel's
// masked password input submit a form WITHOUT the secret fields (leaving
// them untouched) — an explicit empty string "" is what clears one,
// distinct from omitting the key entirely.
export interface ProviderConfigUpdateInput {
  enabled?: boolean;
  apiKey?: string;
  apiSecret?: string;
  extraSecret?: string;
  model?: string | null;
  defaultQuality?: string | null;
  priority?: number;
  monthlyBudgetUsd?: number | null;
  dailyBudgetUsd?: number | null;
  rateLimitPerMinute?: number | null;
  timeoutMs?: number | null;
  retryCount?: number | null;
  extraConfig?: Record<string, string> | null;
  keyExpiresAt?: string | null;
}

function secretUpdate(value: string | undefined): { encrypted: string | null } | undefined {
  if (value === undefined) return undefined; // not present in body — leave untouched
  if (value === "") return { encrypted: null }; // explicit clear
  return { encrypted: encryptSecret(value) };
}

export async function upsertProviderConfig(
  category: ProviderCategory,
  providerId: string,
  rawBody: Record<string, unknown>,
  input: ProviderConfigUpdateInput,
  performedBy: string | undefined
): Promise<ProviderConfigSummary> {
  const data: Record<string, unknown> = {};

  if ("enabled" in rawBody) data.enabled = input.enabled;
  const apiKeyUpdate = secretUpdate(input.apiKey);
  if (apiKeyUpdate) data.apiKeyEncrypted = apiKeyUpdate.encrypted;
  const apiSecretUpdate = secretUpdate(input.apiSecret);
  if (apiSecretUpdate) data.apiSecretEncrypted = apiSecretUpdate.encrypted;
  const extraSecretUpdate = secretUpdate(input.extraSecret);
  if (extraSecretUpdate) data.extraSecretEncrypted = extraSecretUpdate.encrypted;
  if ("model" in rawBody) data.model = input.model;
  if ("defaultQuality" in rawBody) data.defaultQuality = input.defaultQuality;
  if ("priority" in rawBody) data.priority = input.priority;
  if ("monthlyBudgetUsd" in rawBody) data.monthlyBudgetUsd = input.monthlyBudgetUsd;
  if ("dailyBudgetUsd" in rawBody) data.dailyBudgetUsd = input.dailyBudgetUsd;
  if ("rateLimitPerMinute" in rawBody) data.rateLimitPerMinute = input.rateLimitPerMinute;
  if ("timeoutMs" in rawBody) data.timeoutMs = input.timeoutMs;
  if ("retryCount" in rawBody) data.retryCount = input.retryCount;
  if ("extraConfig" in rawBody) data.extraConfig = input.extraConfig;
  if ("keyExpiresAt" in rawBody) {
    data.keyExpiresAt = input.keyExpiresAt ? new Date(input.keyExpiresAt) : null;
  }

  await prisma.providerConfig.upsert({
    where: { category_providerId: { category, providerId } },
    create: { category, providerId, ...data },
    update: data,
  });

  await prisma.providerAuditLog.create({
    data: {
      category,
      providerId,
      action: "update",
      performedBy,
      // Field NAMES only — never secret values — so the audit trail stays
      // useful for "who changed what, when" without becoming a second place
      // a credential could leak from.
      detail: { fieldsChanged: Object.keys(data) },
    },
  });

  const configs = await listProviderConfigs();
  const updated = configs.find((c) => c.category === category && c.providerId === providerId);
  if (!updated) throw new Error("Provider config not found after upsert.");
  return updated;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

// Tests against whatever is currently SAVED for this provider (DB row,
// falling back to legacy env vars — the same resolution every real adapter
// uses), then persists the result so the Admin Panel can show "last tested"
// without a second round trip.
export async function testAndPersistProviderConnection(
  category: ProviderCategory,
  providerId: string,
  performedBy: string | undefined
): Promise<TestConnectionResult> {
  const config = await resolveProviderCredentials(category, providerId);
  const result = await testProviderConnection(category, providerId, config);

  await prisma.providerConfig.upsert({
    where: { category_providerId: { category, providerId } },
    create: {
      category,
      providerId,
      lastTestedAt: new Date(),
      lastTestResult: result.ok,
      lastTestError: result.ok ? null : result.message,
    },
    update: {
      lastTestedAt: new Date(),
      lastTestResult: result.ok,
      lastTestError: result.ok ? null : result.message,
    },
  });

  await prisma.providerAuditLog.create({
    data: {
      category,
      providerId,
      action: "test_connection",
      performedBy,
      detail: { ok: result.ok, message: result.message },
    },
  });

  return result;
}

export interface ProviderAuditLogFilter {
  category?: ProviderCategory;
  providerId?: string;
  limit?: number;
}

export async function listProviderAuditLogs(filter: ProviderAuditLogFilter = {}) {
  return prisma.providerAuditLog.findMany({
    where: {
      category: filter.category,
      providerId: filter.providerId,
    },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 50,
  });
}
