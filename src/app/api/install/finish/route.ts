import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isInstalled, markInstallationComplete } from "@/lib/installation";

// POST /api/install/finish — Step 7. Flips the one-way INSTALLATION_COMPLETED
// flag (lib/installation.ts) — every top-level layout's ensureInstalled()
// check, and this wizard's own ensureNotInstalled() check, immediately start
// honoring it. The wizard can never be reached again after this.
export async function POST() {
  if (await isInstalled()) {
    return apiError("ERR_FORBIDDEN", "Installation is already complete.", 403);
  }
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Sign in as the Super Admin first.", 403);

  await markInstallationComplete(session.user.id);
  return apiSuccess({ ok: true });
}
