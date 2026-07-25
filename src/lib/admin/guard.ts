import { requireSession } from "@/lib/auth/guard";

// Every admin API route calls this first. Middleware's role check
// (lib/auth/config.ts) is a UX courtesy that runs on the Edge; this is the
// actual security boundary, since middleware can be misconfigured or
// bypassed by calling the route directly.
export async function requireAdminSession() {
  const session = await requireSession();
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}
