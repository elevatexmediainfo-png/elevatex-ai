import { createHmac, timingSafeEqual } from "node:crypto";

// Module 10 — the headless-browser worker that drives /editor/[projectId]/
// render has no real user session (it's a fresh Playwright browser context,
// not the logged-in user's browser), so the render-mode route can't use the
// normal `auth()` session check every other editor route does. Instead the
// worker mints a short-lived, single-purpose signed token when it claims an
// EditorExport job, scoped to exactly that export's projectId, and the
// render-mode route verifies it server-side instead of a session cookie.
// Reuses AUTH_SECRET (already a required, validated env var — see
// lib/env.ts) rather than introducing a second secret to manage.
//
// Deliberately NOT a JWT/next-auth session token: this only ever needs to
// carry two ids and an expiry, verified by ONE server-side route, so a
// minimal HMAC-signed payload is simpler than pulling in a JWT library for
// a one-off internal use.

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes — comfortably longer than any single frame-capture render should take to START, not the whole render (the token is only checked once, on page load).

interface RenderTokenPayload {
  exportId: string;
  projectId: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET!).update(payload).digest("base64url");
}

export function createRenderToken(exportId: string, projectId: string): string {
  const payload: RenderTokenPayload = { exportId, projectId, exp: Date.now() + TOKEN_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

// Returns the verified payload, or null if the token is malformed, forged,
// expired, or doesn't match the expected export/project — the render route
// treats any of these identically (404, not a detailed auth error, so a
// forged token doesn't learn which failure mode it hit).
export function verifyRenderToken(token: string, expectedProjectId: string): { exportId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: RenderTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    return null;
  }

  if (payload.exp < Date.now()) return null;
  if (payload.projectId !== expectedProjectId) return null;
  return { exportId: payload.exportId };
}
