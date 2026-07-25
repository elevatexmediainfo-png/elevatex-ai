import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PaymentIntent, Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getStorageProvider } from "@/lib/providers/storage";

type Db = Prisma.TransactionClient | typeof prisma;

// Called from inside fulfillPaymentIntent()'s transaction — every settled
// PaymentIntent (CREDIT_PACKAGE, SUBSCRIPTION, ONE_TIME_DOWNLOAD alike) gets
// exactly one invoice. businessDetailsSnapshot freezes the admin's tax
// details at issue time so a later edit never rewrites a past invoice.
export async function createInvoiceForPaymentIntent(intent: PaymentIntent, db: Db = prisma) {
  const [businessDetails, gstRatePercent] = await Promise.all([
    getConfig("BUSINESS_TAX_DETAILS"),
    getConfig("GST_RATE_PERCENT"),
  ]);

  const subtotalPaise = intent.amountPaise;
  const taxAmountPaise = Math.round(subtotalPaise * (gstRatePercent / 100));
  const totalPaise = subtotalPaise + taxAmountPaise;

  return db.invoice.create({
    data: {
      userId: intent.userId,
      paymentIntentId: intent.id,
      subtotalPaise,
      taxRatePercent: gstRatePercent,
      taxAmountPaise,
      totalPaise,
      businessDetailsSnapshot: businessDetails,
    },
  });
}

function describeKind(kind: PaymentIntent["kind"]) {
  if (kind === "CREDIT_PACKAGE") return "Credit package purchase";
  if (kind === "SUBSCRIPTION") return "Subscription";
  return "One-time download";
}

function rupees(paise: number) {
  return `Rs. ${(paise / 100).toFixed(2)}`;
}

// Renders a simple one-page invoice and uploads it via the Storage Provider,
// returning the key to persist as Invoice.pdfKey. Generated lazily (on first
// download request) rather than inside the settlement transaction, since PDF
// rendering + a storage upload are both too slow/fallible to belong in the
// same DB transaction that grants credits.
export async function generateAndStoreInvoicePdf(invoiceId: string): Promise<string> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { user: true, paymentIntent: true },
  });

  const business = invoice.businessDetailsSnapshot as {
    legalName: string;
    gstin: string;
    address: string;
    stateCode: string;
  };

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const draw = (text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) => {
    page.drawText(text, { x: 50, y, size: opts.size ?? 11, font: opts.bold ? bold : font, color: rgb(0, 0, 0) });
    y -= opts.gap ?? 18;
  };

  draw(business.legalName || "Elevatex AI", { size: 18, bold: true, gap: 24 });
  draw(business.address || "Address not configured", { size: 10, gap: 14 });
  draw(business.gstin ? `GSTIN: ${business.gstin}` : "GSTIN: not provided", { size: 10, gap: 14 });
  draw(business.stateCode ? `State code: ${business.stateCode}` : "", { size: 10, gap: 28 });

  draw(`Invoice #${invoice.invoiceNumber}`, { size: 14, bold: true, gap: 18 });
  draw(`Date: ${invoice.createdAt.toISOString().slice(0, 10)}`, { gap: 14 });
  draw(`Billed to: ${invoice.user.name ?? invoice.user.email ?? invoice.user.phone ?? invoice.userId}`, { gap: 28 });

  draw(describeKind(invoice.paymentIntent.kind), { bold: true, gap: 18 });
  draw(`Subtotal: ${rupees(invoice.subtotalPaise)}`, { gap: 14 });
  draw(`GST (${invoice.taxRatePercent}%): ${rupees(invoice.taxAmountPaise)}`, { gap: 14 });
  draw(`Total: ${rupees(invoice.totalPaise)}`, { size: 13, bold: true, gap: 28 });

  draw("This is a system-generated invoice.", { size: 9, gap: 12 });

  const bytes = await pdf.save();
  const storage = await getStorageProvider();
  const key = `invoices/${invoice.userId}/${invoice.invoiceNumber}.pdf`;
  await storage.upload({ key, data: Buffer.from(bytes), contentType: "application/pdf" });

  await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfKey: key } });
  return key;
}

export async function listInvoicesForUser(userId: string) {
  return prisma.invoice.findMany({
    where: { userId },
    orderBy: { invoiceNumber: "desc" },
    include: { paymentIntent: { select: { kind: true, referenceId: true } } },
  });
}
