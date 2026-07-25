import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listProviderConfigs, PROVIDER_CATALOGUE } from "@/lib/admin/ai-providers";

// GET /api/admin/ai-providers — every admin-configurable provider across all
// six categories (LLM/IMAGE/VOICE/VIDEO/STORAGE/PAYMENT), merged with
// whatever's actually saved in the DB. Secrets are never returned in full —
// only a masked preview (see lib/admin/ai-providers.ts).
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  return apiSuccess({ providers: await listProviderConfigs(), catalogue: PROVIDER_CATALOGUE });
}
