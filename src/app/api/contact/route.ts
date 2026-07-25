import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendNotificationEmail } from "@/lib/notifications/email";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  message: z.string().trim().min(1).max(5000),
});

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// The message body is unauthenticated, attacker-controlled text rendered as
// HTML in the admin's email client — escape it the same way any other
// untrusted-input-into-HTML context would be.
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// POST /api/contact — the marketing site's public Contact form. Unauthenticated
// by nature, so it's rate-limited by IP (not userId) and stores every
// submission for the admin to review even if the email fan-out fails.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit("contact_form", ip);
  if (!rateLimit.allowed) {
    return apiError("ERR_RATE_LIMIT", "Too many messages sent. Please try again later.", 429, {
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Please check the form and try again.", 400, { issues: parsed.error.issues });
  }

  const contactMessage = await prisma.contactMessage.create({ data: parsed.data });

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { email: true } });
  if (admin?.email) {
    void sendNotificationEmail(
      admin.email,
      `New contact message from ${parsed.data.name}`,
      `<p><strong>From:</strong> ${escapeHtml(parsed.data.name)} (${escapeHtml(parsed.data.email)})</p><p>${escapeHtml(parsed.data.message)}</p>`
    );
  }

  return apiSuccess({ id: contactMessage.id }, 201);
}
