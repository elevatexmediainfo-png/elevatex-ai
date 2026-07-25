import { randomInt, createHash } from "crypto";
import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { sendOtpSchema, toE164Phone } from "@/lib/validations/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendOtpSms, SmsDeliveryError } from "@/lib/sms/send-otp-sms";

// FR-AU-011 — 6-digit OTP, 10 minute validity.
const OTP_TTL_MS = 10 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone: localPhone } = sendOtpSchema.parse(body);
    const phone = toE164Phone(localPhone);
    const ipAddress = getClientIp(req);

    const [phoneLimit, ipLimit] = await Promise.all([
      checkRateLimit("otp_send_phone", phone),
      ipAddress === "unknown" ? Promise.resolve(null) : checkRateLimit("otp_send_ip", ipAddress),
    ]);
    if (!phoneLimit.allowed || (ipLimit && !ipLimit.allowed)) {
      return apiError(
        "ERR_RATE_LIMIT",
        "Too many OTP requests. Please try again later.",
        429,
        { retryAfterSeconds: Math.max(phoneLimit.retryAfterSeconds, ipLimit?.retryAfterSeconds ?? 0) }
      );
    }

    const otp = randomInt(100000, 1000000).toString();
    const otpHash = createHash("sha256").update(otp).digest("hex");

    await prisma.$transaction([
      // Opportunistic cleanup — without this, otp_requests grows forever
      // since nothing else ever deletes old rows. Bounded to this phone's
      // own backlog so the query stays cheap (uses the [phone, createdAt] index).
      prisma.otpRequest.deleteMany({
        where: { phone, expiresAt: { lt: new Date() } },
      }),
      prisma.otpRequest.create({
        data: {
          phone,
          otpHash,
          ipAddress: ipAddress === "unknown" ? null : ipAddress,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      }),
    ]);

    // Without a configured SMS gateway, fall back to a transparent dev mode:
    // log the code server-side and return it in the response so the flow is
    // testable end-to-end locally. Disabled automatically once MSG91_AUTH_KEY
    // is set, and never active when NODE_ENV === "production".
    const devMode = process.env.NODE_ENV !== "production" && !process.env.MSG91_AUTH_KEY;

    if (devMode) {
      console.log(`[DEV MODE] OTP for ${phone}: ${otp} (expires in 10 min)`);
      return apiSuccess({ expiresIn: OTP_TTL_MS / 1000, devOtp: otp });
    }

    // Real bug fix (2026-07-24, found live during the codebase health
    // check) — MSG91/Twilio integration was a literal TODO; this branch
    // used to console.warn and then return apiSuccess() anyway, so a real
    // user saw a working-looking "code sent" response for an OTP that was
    // never actually delivered — a silent failure. sendOtpSms() now makes
    // the real MSG91-primary/Twilio-failover attempt (lib/sms/send-otp-sms.ts)
    // and throws with the real per-provider errors if delivery couldn't be
    // confirmed through either path; that's surfaced here as a real
    // apiError, not swallowed into a fake success.
    try {
      await sendOtpSms(phone, otp);
    } catch (err) {
      if (err instanceof SmsDeliveryError) {
        console.error("SMS delivery failed for OTP send", { phone, message: err.message });
        return apiError("ERR_SMS_DELIVERY_FAILED", "We couldn't send a verification code right now. Please try again in a few minutes.", 502);
      }
      throw err;
    }

    return apiSuccess({ expiresIn: OTP_TTL_MS / 1000 });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError(
        "ERR_INVALID_PHONE",
        "Enter a valid 10-digit Indian mobile number",
        400,
        { issues: err.issues }
      );
    }
    console.error("POST /api/auth/otp/send failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
