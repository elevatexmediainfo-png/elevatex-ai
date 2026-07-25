import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPaymentProvider } from "@/lib/providers/payment";
import { dispatchWebhookEvent, markWebhookFailed, markWebhookProcessed, recordWebhookEvent } from "@/lib/billing/webhook-log";

// POST /api/billing/webhook — the real vendor webhook (Razorpay today; any
// future PROVIDER_PAYMENT vendor tomorrow). Signature verification happens
// inside the provider adapter (it knows the header name/algorithm); this
// route maps a normalized WebhookEvent onto our own PaymentIntent/
// Subscription rows via dispatchWebhookEvent() — the exact same dispatch an
// admin "Retry" action re-runs against a stored payload. Milestone 13 added
// the WebhookEvent persistence (record on receipt, mark processed/failed) —
// purely additive instrumentation; the response codes returned to the
// vendor are unchanged from before (a processing failure still surfaces as
// a non-2xx so Razorpay's own retry still kicks in, now alongside our own
// stored record + manual retry button).
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-razorpay-signature");

  const payment = await getPaymentProvider();
  let event;
  try {
    event = payment.verifyAndParseWebhook(rawBody, signatureHeader);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook payload.";
    await prisma.webhookEvent.create({
      data: {
        provider: "razorpay",
        eventType: "unknown",
        payload: { rawBodyLength: rawBody.length },
        signatureValid: false,
        status: "FAILED",
        errorMessage: message,
        processedAt: new Date(),
      },
    });
    return apiError("ERR_FORBIDDEN", message, 400);
  }

  const webhookRow = await recordWebhookEvent({ provider: "razorpay", event, signatureValid: true });

  try {
    const result = await dispatchWebhookEvent(event);
    await markWebhookProcessed(webhookRow.id, result);
  } catch (err) {
    await markWebhookFailed(webhookRow.id, err instanceof Error ? err.message : "Unknown error");
    return apiError("ERR_INTERNAL", "Webhook processing failed.", 500);
  }

  return apiSuccess({ received: true });
}
