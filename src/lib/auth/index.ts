import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { authConfig } from "./config";
import { passwordLoginSchema, emailSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/security/password";
import { grantCredits } from "@/lib/credits/engine";
import { getConfig } from "@/lib/admin/config";

// OTP/phone authentication removed entirely (2026-08-06) — this codebase
// used to support phone-OTP (Credentials provider "otp", MSG91/Twilio SMS)
// alongside Google and email+password. Only Google and email+password
// remain now. See PROJECT_STATUS.md for the removal note.
//
// Dev-only admin login bypass — re-keyed from phone to email (2026-08-06,
// same removal) so it has no dependency on the now-deleted OTP/SMS stack.
// Unblocks local Admin Panel testing without a password. Excluded from the
// `providers` array entirely in production (not just refused at runtime),
// and `authorize()` below re-checks it independently as a second guard.
export const DEV_LOGIN_BYPASS_ENABLED = process.env.NODE_ENV !== "production";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as ReturnType<typeof PrismaAdapter>,
  // Separate accounts unless a user explicitly links them — avoids silently
  // merging a Google sign-in into an existing email+password account on
  // email match.
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
    // MVP install-flow password login (2026-07-27) — the Installation
    // Wizard's Super Admin step creates the account directly (email +
    // password, no OTP vendor needed for a fresh install) via
    // POST /api/install/create-admin, then signs in through this provider.
    // Also reachable from the main /login page for any account this
    // creates, so a password-based admin always has a durable way back in —
    // an unrelated Google-only account has no passwordHash and can never
    // authenticate through here.
    Credentials({
      id: "password",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = passwordLoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { profile: true },
        });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

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
    // Dev-only admin login bypass (see DEV_LOGIN_BYPASS_ENABLED above).
    // Re-keyed from phone to email (2026-08-06, OTP removal) — email
    // lookup only, and only for accounts that are already ADMIN. Never
    // registered in production.
    ...(DEV_LOGIN_BYPASS_ENABLED
      ? [
          Credentials({
            id: "dev-bypass",
            name: "Dev Admin Bypass",
            credentials: { email: { label: "Email", type: "email" } },
            async authorize(raw) {
              // Re-checked at call time, not just at provider-registration
              // time, in case a long-lived dev process's env changed
              // without a restart.
              if (process.env.NODE_ENV === "production") {
                return null;
              }

              const parsed = emailSchema.safeParse(raw?.email);
              if (!parsed.success) return null;

              const user = await prisma.user.findUnique({
                where: { email: parsed.data },
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
    // Google OAuth path goes through the adapter; the Credentials providers
    // above only ever look up an existing user, never create one.
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
