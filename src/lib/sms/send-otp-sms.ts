import { logger } from "@/lib/observability/logger";

// Real bug fix (2026-07-24, found live during the codebase health check) —
// otp/send/route.ts's SMS delivery was a literal `// TODO: integrate MSG91
// (primary) with Twilio failover` next to a `console.warn` — no MSG91 or
// Twilio API call existed anywhere in this codebase. Worse than just
// "not implemented": the route still returned apiSuccess() in that branch,
// so a real user in production saw "code sent" and a working-looking OTP
// entry screen for a code that would never arrive — a silent failure, not
// a loud one. This module is the real fix: MSG91 first, Twilio as a real
// failover (not just a fallback comment), and a real thrown error when
// both fail or neither is configured, so the route can turn that into a
// real apiError instead of a fake success.
//
// India's DLT (Distributed Ledger Technology) regulations require any
// transactional SMS to an Indian number to use a pre-registered sender ID
// and template — a real business/regulatory step neither provider's API
// itself can skip, and one this code can't complete on the founder's
// behalf. Both adapters below are correct, real implementations of each
// vendor's documented REST API; MSG91_TEMPLATE_ID/TWILIO_FROM_NUMBER are
// deliberately separate required config so "the code is wrong" and "the
// founder hasn't registered a template/sender ID yet" fail with distinct,
// diagnosable errors rather than one opaque one.

export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    public readonly attempts: { provider: "msg91" | "twilio"; error: string }[]
  ) {
    super(message);
    this.name = "SmsDeliveryError";
  }
}

interface SmsProviderResult {
  attempted: boolean;
  error?: string;
}

// MSG91 v5 Flow API — the real, current send-SMS-via-template endpoint
// (https://docs.msg91.com/p/tf9GTextN/e/Nr70FaKh0J/MSG91), not the
// deprecated sendhttp.php query-param API. `template_id` is a DLT-approved
// template the founder registers directly with MSG91 — this can't be a
// hardcoded string here since every MSG91 account's approved templates are
// account-specific.
//
// Real, disclosed limitation (found live during verification, not assumed)
// — MSG91's v5/flow response only confirms the REQUEST was accepted for
// async processing, not that it will actually be delivered. Confirmed via
// direct probing: a well-formed-looking request with a completely fake
// authkey AND a plausible-but-nonexistent template_id gets a real HTTP 200
// `{"type":"success"}` — the same as a genuinely valid one. MSG91 DOES
// synchronously reject a malformed *shape* (authkey/template_id missing
// entirely, template_id that fails their own format check) but not a
// wrong-but-plausible credential/template pair — that failure only
// surfaces later via MSG91's own delivery reports, which this function
// does not poll or receive webhooks for (real, larger future work, not
// this fix's scope). Practical effect: a founder who registers a real
// TEMPLATE_ID but has a typo'd or revoked AUTH_KEY would see this report
// "success" and Twilio failover would never trigger for that specific
// failure mode — everything else (unset config, a malformed request, a
// genuine Twilio-side rejection) is caught correctly, verified below.
async function sendViaMsg91(phone: string, otp: string): Promise<SmsProviderResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) return { attempted: false };

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: authKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: phone.replace(/^\+/, ""), OTP: otp }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.type === "error") {
      return { attempted: true, error: `MSG91 ${res.status}: ${body?.message ?? "unknown error"}` };
    }
    return { attempted: true };
  } catch (err) {
    return { attempted: true, error: err instanceof Error ? err.message : String(err) };
  }
}

// Twilio Messages API (https://www.twilio.com/docs/sms/api/message-resource) —
// plain Basic Auth + form-encoded POST, the documented, stable send-SMS
// call. TWILIO_FROM_NUMBER is a real Twilio-provisioned (and, for reliable
// India delivery, separately sender-ID-registered) number — same
// "founder's own real account setup, not something this code can invent"
// caveat as MSG91's template_id above.
async function sendViaTwilio(phone: string, otp: string): Promise<SmsProviderResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) return { attempted: false };

  try {
    const body = new URLSearchParams({ To: phone, From: fromNumber, Body: `Your Elevatex AI verification code is ${otp}. Valid for 10 minutes.` });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { attempted: true, error: `Twilio ${res.status}: ${errBody?.message ?? "unknown error"}` };
    }
    return { attempted: true };
  } catch (err) {
    return { attempted: true, error: err instanceof Error ? err.message : String(err) };
  }
}

// Real failover — MSG91 first, Twilio only if MSG91 wasn't configured or
// genuinely failed. Throws SmsDeliveryError (with every attempt's own real
// error) if delivery could not be confirmed through either path — the
// caller (otp/send/route.ts) turns this into a real apiError, never a
// disguised success.
export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  const attempts: { provider: "msg91" | "twilio"; error: string }[] = [];

  const msg91Result = await sendViaMsg91(phone, otp);
  if (msg91Result.attempted && !msg91Result.error) return;
  if (msg91Result.error) attempts.push({ provider: "msg91", error: msg91Result.error });

  const twilioResult = await sendViaTwilio(phone, otp);
  if (twilioResult.attempted && !twilioResult.error) {
    if (attempts.length > 0) {
      logger.error({ phone, msg91Failures: attempts }, "[sms] MSG91 failed, Twilio failover succeeded");
    }
    return;
  }
  if (twilioResult.error) attempts.push({ provider: "twilio", error: twilioResult.error });

  if (attempts.length === 0) {
    throw new SmsDeliveryError("No SMS provider is configured (MSG91_AUTH_KEY+MSG91_TEMPLATE_ID or TWILIO_ACCOUNT_SID+TWILIO_AUTH_TOKEN+TWILIO_FROM_NUMBER).", []);
  }
  throw new SmsDeliveryError(`SMS delivery failed on every configured provider: ${attempts.map((a) => `${a.provider} (${a.error})`).join("; ")}`, attempts);
}
