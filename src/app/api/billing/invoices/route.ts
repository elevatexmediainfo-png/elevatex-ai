import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listInvoicesForUser } from "@/lib/billing/invoices";

// GET /api/billing/invoices — billing history's invoice list for the
// signed-in user. Read-only; PDF generation happens lazily on download.
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const invoices = await listInvoicesForUser(session.user.id);
  return apiSuccess({ invoices });
}
