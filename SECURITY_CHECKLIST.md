# Security Checklist — Elevatex AI

What was verified during Milestone 12's security pass (Phase D), how, and what's intentionally out of scope. This is a verification record, not a generic security-101 list — every line below maps to real code in this repo.

## Verified — code review + grep

- **No SQL injection surface.** Grepped the repo for `$queryRawUnsafe`/`$executeRawUnsafe`/any string-concatenated SQL: zero instances. All database access goes through Prisma's parameterized query builder.
- **No XSS via unescaped HTML.** Grepped for `dangerouslySetInnerHTML`: zero instances in application code. The `/contact` form's `ContactMessage.message` field is stored and ever displayed as plain text (confirmed live with a `<script>alert(1)</script>` payload — stored verbatim, never executed); the admin notification email path uses `escapeHtml()` before interpolating any user-supplied string into an HTML email body.
- **Secrets never logged or exposed.** Provider API keys are encrypted at rest (`lib/security/encryption.ts`, AES-256-GCM, random IV per write) and always returned masked (`apiKeyMasked`) from every admin API response — confirmed no route returns a raw stored secret.
- **Audit trail.** `AuditLog` (generalized from the pre-existing `ProviderAuditLog` pattern) records every credit grant/adjustment, coupon redemption, subscription cancellation, user suspend/unsuspend, and broadcast send — `userId`/`resource`/`action`/`detail` JSON, deliberately names/ids only, never secret values.

## Verified — live HTTP testing

- **CSRF / cross-origin mutation**: an `Origin`-header check is composed into `middleware.ts` via `authConfig.callbacks.authorized`. Confirmed live: same-origin POST → 200; POST with `Origin: https://evil.example.com` → `403 ERR_FORBIDDEN_ORIGIN`; POST with no `Origin` header (curl, server-to-server webhooks) → passes through, since there's no cross-site browser context to forge in that case.
- **Rate limiting**: confirmed OTP-send hits its configured per-phone limit and returns `429` on the next attempt within the window, with `retryAfterSeconds` in the response. The same `checkRateLimit()` helper backs video/talking-head creation, asset upload, AI Marketing Assistant actions, and export creation.
- **Session invalidation on suspension**: confirmed that admin-suspending a user (`POST /admin/users/[id]/suspend`) causes that user's very next authenticated request (`GET /api/me`) to return `401` immediately — `requireSession()` does a fresh `accountStatus` DB lookup per request rather than trusting a JWT claim that could go stale for the life of the session. Unsuspending restores access immediately.
- **Upload validation**: a renamed-extension attack (text content with a `.png` extension and `Content-Type: image/png`) is rejected with `400` by magic-byte sniffing (`file-type` package) on the multipart upload path. **Known gap**: the presigned-URL upload path (`/api/assets/upload-url`) does not sniff bytes server-side, since they never transit the Next.js server by design — see `KNOWN_LIMITATIONS.md`.
- **Coupon double-redemption**: confirmed a second redemption attempt of an already-used coupon is rejected with `400`, not silently double-granting credits.
- **Authorization boundaries**: confirmed every `/api/admin/*` route 403s for a non-admin session, and every per-user resource route (videos, assets, invoices) scopes its Prisma query by `session.user.id` rather than trusting a client-supplied id alone.

## Headers (`next.config.ts`)

- `Content-Security-Policy` — restricts script/frame/connect sources to self, Google OAuth (full-page redirect, not a CSP-governed sub-resource), and Razorpay Checkout (the one real third-party script/frame this app loads); `img-src`/`media-src` allow any `https:` origin since Storage is admin-configurable to an arbitrary S3/R2/MinIO endpoint.
- `Strict-Transport-Security` — production-only (no point forcing HTTPS on a local dev `http://localhost`).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` — all pre-existing, re-confirmed still present.

## Explicitly out of scope for this milestone (see `KNOWN_LIMITATIONS.md` for detail)

- Real virus/malware scanning (ClamAV/VirusTotal) on uploaded files — needs external infrastructure this milestone doesn't stand up.
- Magic-byte validation on the presigned-URL upload path.
- Automated penetration testing / third-party security audit — this checklist is a self-review, not a substitute for one before handling real customer payment data at scale.
- ML-based (as opposed to rule-based threshold) abuse detection.
