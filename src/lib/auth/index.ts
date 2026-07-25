import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { authConfig } from "./config";
import { verifyOtpSchema, sendOtpSchema, toE164Phone } from "@/lib/validations/auth";
import { grantCredits } from "@/lib/credits/engine";
import { getConfig } from "@/lib/admin/config";

const MAX_OTP_ATTEMPTS = 3; // FR-AU-015

// Same gate api/auth/otp/send/route.ts already uses for its devOtp fallback —
// reused here, not reinvented, so both "dev mode" concepts can never disagree
// about whether they're active. Real OTP rate limiting (lib/security/rate-
// limit.ts, 3/hour per phone) makes repeated local admin-panel testing
// impractical once that limit is hit — this provider exists purely to
// unblock that loop. It is excluded from the `providers` array entirely
// (not just refused at runtime) whenever this evaluates false, and
// `authorize()` below re-checks it independently as a second guard.
export const DEV_LOGIN_BYPASS_ENABLED =
  process.env.NODE_ENV !== "production" && !process.env.MSG91_AUTH_KEY;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as ReturnType<typeof PrismaAdapter>,
  // Separate accounts unless a user explicitly links them — avoids silently
  // merging a Google sign-in into an existing OTP account on email match.
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
    Credentials({
      id: "otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(raw) {
        const parsed = verifyOtpSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { phone: localPhone, otp } = parsed.data;
        const phone = localPhone.startsWith("+91") ? localPhone : `+91${localPhone}`;

        const record = await prisma.otpRequest.findFirst({
          where: { phone, consumedAt: null },
          orderBy: { createdAt: "desc" },
        });
        if (!record) return null;
        if (record.expiresAt < new Date()) return null;
        if (record.attempts >= MAX_OTP_ATTEMPTS) return null;

        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
        if (otpHash !== record.otpHash) {
          await prisma.otpRequest.update({
            where: { id: record.id },
            data: { attempts: { increment: 1 } },
          });
          return null;
        }

        await prisma.otpRequest.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        });

        const existing = await prisma.user.findUnique({
          where: { phone },
          include: { profile: true },
        });

        if (existing) {
          return {
            id: existing.id,
            name: existing.name,
            email: existing.email,
            phone: existing.phone,
            onboardingCompleted: !!existing.profile?.onboardingCompletedAt,
            role: existing.role,
          };
        }

        const created = await prisma.user.create({
          data: {
            phone,
            phoneVerified: new Date(),
            profile: { create: {} },
          },
          include: { profile: true },
        });

        // Routed through the engine (not a bare CreditAccount.create) so the
        // signup bonus is auditable — see lib/credits/engine.ts. Amount is
        // admin-configurable (SIGNUP_BONUS_CREDITS), not hardcoded.
        const signupBonus = await getConfig("SIGNUP_BONUS_CREDITS");
        await grantCredits({
          userId: created.id,
          lotType: "SIGNUP_BONUS",
          transactionType: "SIGNUP_BONUS",
          amount: signupBonus,
          description: `Welcome bonus — ${signupBonus} free credit(s)`,
        });

        return {
          id: created.id,
          name: created.name,
          email: created.email,
          phone: created.phone,
          onboardingCompleted: false,
          role: created.role,
        };
      },
    }),
    // Dev-only admin login bypass (see DEV_LOGIN_BYPASS_ENABLED above).
    // Skips OTP/rate-limit entirely — phone lookup only, and only for
    // accounts that are already ADMIN. Never registered in production.
    ...(DEV_LOGIN_BYPASS_ENABLED
      ? [
          Credentials({
            id: "dev-bypass",
            name: "Dev Admin Bypass",
            credentials: { phone: { label: "Phone", type: "text" } },
            async authorize(raw) {
              // Re-checked at call time, not just at provider-registration
              // time, in case a long-lived dev process's env changed
              // without a restart.
              if (process.env.NODE_ENV === "production" || process.env.MSG91_AUTH_KEY) {
                return null;
              }

              const parsed = sendOtpSchema.safeParse(raw);
              if (!parsed.success) return null;
              const phone = toE164Phone(parsed.data.phone);

              const user = await prisma.user.findUnique({
                where: { phone },
                include: { profile: true },
              });
              // Admin-only by design — this is an "admin login bypass" for
              // unblocking local Admin Panel testing, not a general
              // passwordless login for arbitrary accounts.
              if (!user || user.role !== "ADMIN") return null;

              return {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                onboardingCompleted: !!user.profile?.onboardingCompletedAt,
                role: user.role,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Overrides the edge-safe fallback in lib/auth/config.ts — this version
    // runs in the Node runtime (real sign-ins only) and is the only place
    // that talks to Prisma. `user` is only present on the actual sign-in
    // request, never on token refresh, so this never hot-loops the DB.
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user.role as "USER" | "ADMIN" | undefined) ?? "USER";
        if (typeof user.onboardingCompleted === "boolean") {
          token.onboardingCompleted = user.onboardingCompleted;
        } else {
          // Google OAuth path — adapter's user object has no profile relation.
          const profile = await prisma.profile.findUnique({
            where: { userId: user.id as string },
          });
          token.onboardingCompleted = !!profile?.onboardingCompletedAt;
        }
      }
      if (trigger === "update" && session?.onboardingCompleted !== undefined) {
        token.onboardingCompleted = session.onboardingCompleted as boolean;
      }
      // Milestone 10 — lets the Installation Wizard's "Create Super Admin"
      // step refresh the just-created user's JWT to ADMIN immediately after
      // promoting them server-side (api/install/promote-admin), without a
      // second full sign-in.
      if (trigger === "update" && session?.role !== undefined) {
        token.role = session.role as "USER" | "ADMIN";
      }
      return token;
    },
  },
  events: {
    // Fires exactly once when the adapter creates a new user — only the
    // Google OAuth path goes through the adapter; the OTP path creates its
    // own Profile/CreditAccount directly in authorize() above.
    async createUser({ user }) {
      if (!user.id) return;
      await prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });

      // Guard against double-granting: grantCredits() always adds on top of
      // the current balance, so this check is what makes the grant
      // idempotent if this event were ever re-delivered.
      const existingAccount = await prisma.creditAccount.findUnique({
        where: { userId: user.id },
      });
      if (!existingAccount) {
        const signupBonus = await getConfig("SIGNUP_BONUS_CREDITS");
        await grantCredits({
          userId: user.id,
          lotType: "SIGNUP_BONUS",
          transactionType: "SIGNUP_BONUS",
          amount: signupBonus,
          description: `Welcome bonus — ${signupBonus} free credit(s)`,
        });
      }
    },
  },
});
