import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Milestone 12 — CSRF defense-in-depth on top of the session cookie's
// existing sameSite:"lax" (which already blocks the classic cross-site
// form-post). A request with no Origin header (curl, server-to-server
// webhooks like the Razorpay callback) is allowed through unchanged — only
// a browser-presented cross-origin Origin is rejected. Composed into
// authConfig's own `authorized` callback (rather than a second middleware
// function) so the existing single matcher/auth resolution isn't duplicated
// — the matcher below now also covers /api/* so this check actually runs
// there; every page-protection rule in authConfig.authorized is unaffected
// since none of its path patterns match /api/*, so it falls through to its
// existing `return true` for every API request exactly as before.
// Compare the *host* part of the Origin header against the Host request
// header — not against request.nextUrl.origin. NextAuth v5 normalises
// request.nextUrl using NEXTAUTH_URL (so .origin reflects the configured
// URL, not the port the dev server actually bound to), which would cause
// false positives whenever the server starts on an alternate port.
// The Host header is set by the browser and reflects what it actually
// connected to, making it the correct reference for CSRF comparison.
function originIsTrusted(origin: string | null, selfHost: string | null): boolean {
  if (!origin) return true;          // no Origin = curl / server-to-server → allow
  if (!selfHost) return true;        // can't determine host → don't block
  try {
    return new URL(origin).host === selfHost;
  } catch {
    return false;                    // malformed Origin → block
  }
}

const baseAuthorized = authConfig.callbacks!.authorized!;

export const { auth: middleware } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized(params) {
      const { request } = params;
      if (
        request.nextUrl.pathname.startsWith("/api/") &&
        MUTATING_METHODS.has(request.method) &&
        !originIsTrusted(request.headers.get("origin"), request.headers.get("host"))
      ) {
        return NextResponse.json(
          { success: false, error: { code: "ERR_FORBIDDEN_ORIGIN", message: "Cross-origin request blocked." } },
          { status: 403 }
        );
      }
      return baseAuthorized(params);
    },
  },
});

export const config = {
  // Fix (2026-07-20) — api/assets/mock-upload excluded: Next.js buffers a
  // request's ENTIRE body in memory before invoking any middleware whose
  // matcher covers it (see next.config.ts's own middlewareClientMaxBodySize
  // comment) — a real, framework-level buffering step distinct from, and in
  // addition to, whatever the route handler itself does with the body.
  // Traced as a real contributor to repeat-occurring large (~250MB) upload
  // failures: this route already has its own independent HMAC-signature
  // check (verifyStorageSignature — time-limited, key-scoped, only ever
  // handed to an already-authenticated user), so it never relied on this
  // middleware's session/CSRF checks in the first place. Excluding it lets
  // the browser's PUT body stream straight into the route handler (which
  // itself now streams to disk — see mock-upload/route.ts) with no
  // whole-body buffering step anywhere in the request path.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/assets/mock-upload).*)"],
};
