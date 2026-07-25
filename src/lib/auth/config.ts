import type { NextAuthConfig } from "next-auth";

// Edge-safe base config — NO Prisma import anywhere in this file or its
// import chain. This is what middleware.ts loads (Edge runtime can't run
// the `pg` driver). The full config (./index.ts, Node runtime only) spreads
// this and adds the adapter + providers + DB-aware jwt callback.
//
// Route protection groups (PRD Section 11 — dashboard route group screens).
const PROTECTED_PATHS = [
  "/dashboard",
  "/create",
  "/videos",
  "/templates",
  "/brand-kit",
  "/media-library",
  "/credits",
  "/settings",
  "/team",
  "/admin",
  // Milestone 14
  "/studio",
  "/projects",
  "/images",
  "/marketing-creatives",
  "/usage",
  // Milestone 24 — Cloud Video Editor (non-AI). An ungrouped top-level
  // route (like /admin), not under (dashboard) — it opts out of the
  // dashboard chrome for a full-screen editor shell.
  "/editor",
];
const ADMIN_PATH = "/admin";
const ONBOARDING_PATH = "/onboarding";
const LOGIN_PATH = "/login";

// Module 10 — the Export render worker's headless browser has no user
// session (a fresh Playwright context, not the logged-in user's browser),
// so /editor/[projectId]/render can't require one at the edge the way
// every other /editor path does. This carve-out only skips the SESSION
// check here — it does NOT skip real authorization: the page itself
// (src/app/editor/[projectId]/render/page.tsx) verifies a short-lived
// HMAC-signed render token server-side and 404s without one, the same
// "edge check is a courtesy, the real boundary is server-side" pattern
// this file's own admin-role check below already documents.
const EDITOR_RENDER_PATH = /^\/editor\/[^/]+\/render(\/.*)?$/;

function matchesPath(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export const authConfig = {
  // Required in production: Auth.js v5 refuses to trust the Host header
  // (UntrustedHost) unless told to, even when NEXTAUTH_URL is set — that
  // env var only supplies a default/fallback, it doesn't itself satisfy
  // this check. Safe here because the app sits behind our own reverse
  // proxy/host, not arbitrary user-supplied hosts.
  trustHost: true,
  pages: {
    signIn: LOGIN_PATH,
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;
      const isOnboarding = matchesPath(pathname, ONBOARDING_PATH);
      const isProtected =
        !EDITOR_RENDER_PATH.test(pathname) &&
        (isOnboarding || PROTECTED_PATHS.some((p) => matchesPath(pathname, p)));
      const isLoginPage = matchesPath(pathname, LOGIN_PATH);

      if (isLoginPage) {
        if (user) {
          const dest = user.onboardingCompleted ? "/dashboard" : ONBOARDING_PATH;
          return Response.redirect(new URL(dest, request.nextUrl));
        }
        return true;
      }

      if (isProtected) {
        if (!user) return false; // NextAuth redirects to `pages.signIn`
        if (!isOnboarding && !user.onboardingCompleted) {
          return Response.redirect(new URL(ONBOARDING_PATH, request.nextUrl));
        }
        if (isOnboarding && user.onboardingCompleted) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        // Admin panel — role check at the edge for fast UX; the (admin)
        // route group layout repeats this server-side as the real guard
        // (a redirect here is a courtesy, not the security boundary).
        if (matchesPath(pathname, ADMIN_PATH) && user.role !== "ADMIN") {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      return true;
    },
    // Minimal, DB-free fallback — overridden by the Prisma-aware jwt callback
    // in lib/auth/index.ts for real sign-ins. This version only runs inside
    // the edge NextAuth instance used by middleware, which never performs an
    // actual sign-in (no providers configured there), so the `user` branch
    // below never actually executes at request time — it exists purely so
    // this config type-checks as a complete NextAuthConfig on its own.
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.onboardingCompleted = user.onboardingCompleted ?? false;
        token.role = user.role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.onboardingCompleted = token.onboardingCompleted;
        session.user.role = token.role ?? "USER";
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
