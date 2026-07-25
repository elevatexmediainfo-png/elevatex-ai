// Real, pre-existing gap, surfaced by AI Film's character sheet route
// (2026-07-12): MockStorageProvider.getPublicUrl() returns a path relative
// to this app's own origin ("/uploads/..."), correct for a client-rendered
// <img> tag but useless to an external vendor's vision API (Gemini/OpenAI),
// which fetches the URL from ITS OWN servers, not the browser's — a bare
// "/uploads/..." string isn't a resolvable URL there at all
// ("Failed to parse URL from /uploads/...", confirmed live).
// S3StorageProvider.getPublicUrl() already returns a fully-qualified URL
// (its own bucket/CDN domain), so this is a no-op there — only Mock's
// relative path needs the app's own origin prepended. The identical bug
// already existed, silently swallowed via a try/catch that marks
// analysisStatus FAILED instead of crashing, in
// lib/admin/reference-library.ts's vision analysis — fixed at both call
// sites via this one shared helper rather than patching each inline, so a
// third future caller (any future generateScript({ imageUrl }) call
// against a Mock-stored asset) can't reintroduce the same bug.
const APP_BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export function resolveAbsoluteUrl(url: string): string {
  return url.startsWith("/") ? `${APP_BASE_URL}${url}` : url;
}
