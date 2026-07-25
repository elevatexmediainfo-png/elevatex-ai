import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Every authenticated API route calls this instead of duplicating the
// `auth()` + `session?.user` null-check inline (it was identical across a
// dozen route files). lib/admin/guard.ts's requireAdminSession composes this
// with a role check for /api/admin/*.
//
// Milestone 12 — also the enforcement point for manual admin suspension
// (User.accountStatus, lib/admin/abuse-detection.ts's suspendUser()). The
// JWT session itself doesn't carry accountStatus (it's set once at sign-in,
// not worth re-minting on every suspend/unsuspend), so this is one extra
// indexed lookup per authenticated request — the only way a suspension
// takes effect immediately rather than only after the JWT's own expiry.
export async function requireSession() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountStatus: true },
  });
  if (!user || user.accountStatus !== "ACTIVE") return null;

  return session;
}
