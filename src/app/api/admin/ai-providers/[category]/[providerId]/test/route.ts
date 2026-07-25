import type { ProviderCategory } from "@/generated/prisma/client";
import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { findCatalogueEntry, testAndPersistProviderConnection } from "@/lib/admin/ai-providers";

const CATEGORIES = ["LLM", "IMAGE", "VOICE", "VIDEO", "STORAGE", "PAYMENT", "TRANSCRIPTION", "EMAIL", "STOCK_MEDIA", "ICON", "VIDEO_UNDERSTANDING", "REASONING"] as const;

// POST /api/admin/ai-providers/[category]/[providerId]/test — the "Test
// Connection" button. Tests against whatever is currently saved (DB row,
// falling back to legacy env vars) and persists lastTestedAt/lastTestResult
// so the panel can show it without a second round trip.
export async function POST(
  _req: Request,
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

  const result = await testAndPersistProviderConnection(category as ProviderCategory, providerId, session.user.id);
  return apiSuccess({ result });
}
