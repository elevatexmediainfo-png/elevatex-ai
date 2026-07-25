import { getEmailProvider } from "@/lib/providers/email";
import { logger } from "@/lib/observability/logger";

// Thin wrapper around the Email Provider — never throws. A failed send is
// logged and dropped; nothing that triggers a notification email (a render
// completing, an admin broadcast) may ever fail or retry because of it.
export async function sendNotificationEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const provider = await getEmailProvider();
    const result = await provider.send({ to, subject, html });
    if (!result.sent) {
      logger.warn({ to, subject, error: result.error }, "Notification email not sent");
    }
  } catch (err) {
    logger.warn({ to, subject, err }, "Notification email dispatch failed");
  }
}
