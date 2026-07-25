import { auth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { isInstalled } from "@/lib/installation";

// GET /api/install/status — lets the wizard's client component know whether
// it's already installed (shouldn't normally be reachable — the page-level
// ensureNotInstalled() guard handles that — but the wizard polls this after
// each step so it never has to guess session/installation state) and
// whether the current visitor already has a session (so Step 1 can skip
// itself if they signed in moments ago).
export async function GET() {
  const [installed, session] = await Promise.all([isInstalled(), auth()]);
  return apiSuccess({
    installed,
    session: session?.user ? { id: session.user.id, role: session.user.role, phone: session.user.phone ?? null } : null,
  });
}
