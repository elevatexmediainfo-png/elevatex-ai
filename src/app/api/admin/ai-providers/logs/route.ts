import { NextRequest } from "next/server";

import type { ProviderCategory } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listProviderAuditLogs } from "@/lib/admin/ai-providers";

// GET /api/admin/ai-providers/logs?category=LLM&providerId=openai&limit=50 —
// Part 9's "audit every provider action" requirement. Every PATCH/test
// against a provider writes one row here (lib/admin/ai-providers.ts) with
// field NAMES only, never secret values.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const category = req.nextUrl.searchParams.get("category") as ProviderCategory | null;
  const providerId = req.nextUrl.searchParams.get("providerId") ?? undefined;
  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  const logs = await listProviderAuditLogs({ category: category ?? undefined, providerId, limit });
  return apiSuccess({ logs });
}
