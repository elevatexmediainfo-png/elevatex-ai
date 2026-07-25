import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { generateAndStoreInvoicePdf } from "@/lib/billing/invoices";
import { getStorageProvider } from "@/lib/providers/storage";

const SIGNED_URL_TTL_SECONDS = 300;

// GET /api/billing/invoices/[id]/pdf — mints a short-lived signed URL,
// rendering the PDF on first request (pdfKey is null until then) and
// reusing the stored key on every later download.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, userId: session.user.id } });
  if (!invoice) {
    return apiError("ERR_NOT_FOUND", "Invoice not found.", 404);
  }

  const key = invoice.pdfKey ?? (await generateAndStoreInvoicePdf(invoice.id));
  const storage = await getStorageProvider();
  const signed = await storage.getSignedDownloadUrl(key, SIGNED_URL_TTL_SECONDS);

  return apiSuccess({ url: signed.url, expiresAt: signed.expiresAt });
}
