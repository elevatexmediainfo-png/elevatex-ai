import { NextRequest } from "next/server";
import { z } from "zod";

import type { ProviderCategory } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { findCatalogueEntry, upsertProviderConfig } from "@/lib/admin/ai-providers";

const CATEGORIES = ["LLM", "IMAGE", "VOICE", "VIDEO", "STORAGE", "PAYMENT", "TRANSCRIPTION", "EMAIL", "STOCK_MEDIA", "ICON", "VIDEO_UNDERSTANDING", "REASONING"] as const;

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  // "" clears a saved secret; omitted leaves it untouched; the Admin Panel
  // never sends a real saved secret back (only a masked preview).
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  extraSecret: z.string().optional(),
  model: z.string().nullable().optional(),
  defaultQuality: z.string().nullable().optional(),
  // Negative priority is a real, intentional convention here (lib/generation/
  // engine.ts's runGeneration() sorts the failover chain priority ASC, so a
  // lower/negative number means "try this first") — gemini/openai/veo/every
  // mock provider all ship seeded with negative priorities. `.min(0)` was
  // wrong: it silently blocked re-saving any of those rows, and the
  // workaround (typing a non-negative number just to get the save through)
  // is exactly what silently reordered veo behind mock in production and
  // caused every real generation to quietly resolve to the mock placeholder
  // instead of a real Veo call. No lower bound now, matching the DB column
  // (`Int @default(0)`, unconstrained).
  priority: z.number().int().optional(),
  monthlyBudgetUsd: z.number().min(0).nullable().optional(),
  dailyBudgetUsd: z.number().min(0).nullable().optional(),
  rateLimitPerMinute: z.number().int().min(0).nullable().optional(),
  timeoutMs: z.number().int().min(0).nullable().optional(),
  retryCount: z.number().int().min(0).nullable().optional(),
  extraConfig: z.record(z.string(), z.string()).nullable().optional(),
  keyExpiresAt: z.string().datetime().nullable().optional(),
});

// PATCH /api/admin/ai-providers/[category]/[providerId] — the one write path
// for every provider's config. Only fields present in the raw JSON body are
// touched (see upsertProviderConfig's "in rawBody" checks) — this is what
// lets the form submit without its masked secret inputs and leave the saved
// credential alone.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ category: string; providerId: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { category: categoryParam, providerId } = await params;
  const category = categoryParam.toUpperCase();
  if (!CATEGORIES.includes(category as ProviderCategory)) {
    return apiError("ERR_VALIDATION", `Unknown category "${categoryParam}".`, 400);
  }

  const entry = findCatalogueEntry(category as ProviderCategory, providerId);
  if (!entry) {
    return apiError("ERR_NOT_FOUND", `"${providerId}" is not a configurable ${category} provider.`, 404);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid provider config.", 400, { issues: parsed.error.issues });
  }

  const updated = await upsertProviderConfig(
    category as ProviderCategory,
    providerId,
    body,
    parsed.data,
    session.user.id
  );
  return apiSuccess({ provider: updated });
}
