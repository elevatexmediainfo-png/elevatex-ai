import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isInstalled } from "@/lib/installation";
import { createAdminSchema } from "@/lib/validations/auth";
import { hashPassword } from "@/lib/security/password";
import { grantCredits } from "@/lib/credits/engine";
import { getConfig } from "@/lib/admin/config";

// POST /api/install/create-admin — Installation Wizard Step 1 (MVP,
// 2026-07-27). Replaces the phone-OTP verify-then-promote two-step
// (signIn("otp", ...) + POST /api/install/promote-admin) with a single
// direct create: a fresh install has no OTP vendor configured yet and no
// admin account to log in as, so requiring phone verification here was a
// real chicken-and-egg blocker, not a security requirement — the OTP path
// itself was just Step 1's UI decision, not something this route depended
// on structurally. Guarded by isInstalled() exactly like the route it
// replaces, so this can never be called again once installation is
// complete — never a privilege-escalation/account-creation backdoor.
// Phone-OTP and Google sign-in are completely untouched; this only adds a
// second, independent path.
export async function POST(req: Request) {
  if (await isInstalled()) {
    return apiError("ERR_FORBIDDEN", "Installation is already complete.", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input.", 400);
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return apiError("ERR_CONFLICT", "An account with this email already exists.", 409);
  }

  const passwordHash = await hashPassword(password);
  const created = await prisma.user.create({
    data: {
      email,
      emailVerified: new Date(),
      passwordHash,
      role: "ADMIN",
      profile: { create: {} },
    },
  });

  // Same auditable-grant pattern as the OTP signup path (lib/auth/index.ts)
  // — account creation always goes through the credit engine, regardless of
  // role, rather than special-casing admin accounts.
  const signupBonus = await getConfig("SIGNUP_BONUS_CREDITS");
  await grantCredits({
    userId: created.id,
    lotType: "SIGNUP_BONUS",
    transactionType: "SIGNUP_BONUS",
    amount: signupBonus,
    description: `Welcome bonus — ${signupBonus} free credit(s)`,
  });

  return apiSuccess({ ok: true });
}
