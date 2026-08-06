import { z } from "zod";

// MVP install-flow password login (2026-07-27) — replaces phone-OTP for the
// Installation Wizard's Super Admin step; also usable from the main /login
// page for any account this creates.
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

export const passwordLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const createAdminSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
