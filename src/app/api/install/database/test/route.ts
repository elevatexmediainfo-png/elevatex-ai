import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isInstalled } from "@/lib/installation";

// POST /api/install/database/test — Step 2. Per the documented constraint:
// the wizard page itself only renders because Prisma already has a working
// DATABASE_URL (the client is constructed at module load, before any
// request) — so this step can only confirm an already-set connection
// string works, not bootstrap a brand-new one from zero. Switching to a
// different Postgres host (Neon/Supabase/Railway) means editing
// DATABASE_URL and restarting, same as today.
export async function POST() {
  if (await isInstalled()) {
    return apiError("ERR_FORBIDDEN", "Installation is already complete.", 403);
  }
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Sign in as the Super Admin first.", 403);

  try {
    await prisma.$queryRaw`SELECT 1`;
    return apiSuccess({ ok: true, message: "Database connection is healthy." });
  } catch (err) {
    return apiSuccess({ ok: false, message: err instanceof Error ? err.message : String(err) });
  }
}
