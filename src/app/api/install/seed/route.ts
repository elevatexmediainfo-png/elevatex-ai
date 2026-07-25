import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isInstalled } from "@/lib/installation";
import { seedDefaults } from "@/lib/seed-defaults";

// POST /api/install/seed — Step 6. Calls the SAME seedDefaults() the CLI
// `prisma db seed` uses (src/lib/seed-defaults.ts) against the app's own
// prisma singleton — one seed dataset, reachable from either path.
export async function POST() {
  if (await isInstalled()) {
    return apiError("ERR_FORBIDDEN", "Installation is already complete.", 403);
  }
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Sign in as the Super Admin first.", 403);

  const summary = await seedDefaults(prisma);
  return apiSuccess({ summary });
}
