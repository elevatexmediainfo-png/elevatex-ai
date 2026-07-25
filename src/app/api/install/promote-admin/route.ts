import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isInstalled } from "@/lib/installation";

// POST /api/install/promote-admin — Installation Wizard Step 1's second
// half. The client already created/verified its own session via the
// EXISTING phone-OTP sign-in (signIn("otp", ...) — same route every regular
// user goes through, unchanged), which creates a normal role:"USER"
// account. This promotes that session's user to ADMIN — but ONLY while the
// app isn't installed yet, so it can never be called as a privilege
// escalation path afterwards.
export async function POST() {
  if (await isInstalled()) {
    return apiError("ERR_FORBIDDEN", "Installation is already complete.", 403);
  }

  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "Verify your phone number first.", 401);

  await prisma.user.update({ where: { id: session.user.id }, data: { role: "ADMIN" } });
  return apiSuccess({ ok: true });
}
