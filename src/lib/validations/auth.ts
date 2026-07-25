import { z } from "zod";

// FR-AU-010 — 10-digit Indian mobile number, first digit 6, 7, 8, or 9
// (TRAI-compliant range). Country code +91 is implied and pre-filled in the UI.
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const phoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s-]/g, ""))
  .pipe(
    z
      .string()
      .regex(INDIAN_MOBILE_REGEX, "Enter a valid 10-digit Indian mobile number")
  );

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpCodeSchema,
});

/** Normalises a bare 10-digit number to E.164 (+91XXXXXXXXXX) for storage/lookup. */
export function toE164Phone(phone: string): string {
  return phone.startsWith("+91") ? phone : `+91${phone}`;
}
