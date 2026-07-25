# Launch Checklist — Elevatex AI

A founder-facing go/no-go list for taking this from a verified dev environment to real paying customers. Each item links back to where it's implemented or documented — this is a checklist, not a tutorial; see `PRODUCTION_DEPLOYMENT.md` for the actual deploy steps.

## Infrastructure

- [ ] VPS provisioned, Docker Engine + Compose plugin installed (`PRODUCTION_DEPLOYMENT.md` §1).
- [ ] Domain DNS pointed at the VPS; reverse proxy (Caddy/Nginx/Traefik) terminating TLS in front of port 3000.
- [ ] `.env.local` filled in for production — at minimum `DATABASE_URL`, `AUTH_SECRET` (fresh, never reused from dev), `NEXTAUTH_URL` (real public HTTPS URL).
- [ ] Object storage configured (`S3_BUCKET`/`S3_REGION`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_PUBLIC_BASE_URL`) — without this, Storage silently falls back to Mock (non-durable, local disk only).
- [ ] `docker compose up -d --build` run; `GET /api/admin/health` (once installed) shows database/storage/queue all OK.
- [ ] Re-verify upload/normalization reliability on the real production box specifically (upload a genuinely large real video, ~1GB+, confirm it reaches READY without hitting `JOB_TIMEOUT_MS`/the stale-job reaper). Two real "upload hung/failed" incidents during dev traced entirely to the LOCAL dev machine's own residential-ISP network instability, not app code (see `PROJECT_STATUS.md`'s "Known environment quirk" entry, 2026-07-22/23) — this should NOT recur on stable datacenter networking, but that's an assumption to confirm, not assume.
- [ ] Postgres backup cron configured per `PRODUCTION_DEPLOYMENT.md`'s `pg_dump` procedure — confirm a real backup file is produced before going live, not just that the script exists.

## SMS & Payments (real money/real users)

- [ ] `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` (a DLT-approved SMS template registered in your MSG91 account — required for Indian numbers, `MSG91_AUTH_KEY` alone is not enough) set, with `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` as a real, working failover (`lib/sms/send-otp-sms.ts`, 2026-07-24 — previously a stub with a literal TODO comment and a silent-failure bug where "code sent" was shown even when nothing was ever actually implemented). **Without at least one fully configured, OTP login falls back to dev mode** (logs the code instead of texting it) in non-production only — production now returns a real, loud error instead of a fake success. Note: MSG91's own send-time response only confirms the request was *accepted*, not delivered — a registered-but-wrong `MSG91_AUTH_KEY` would not trigger Twilio failover (see that file's own doc comment); Twilio's response is a genuine synchronous credential check.
- [ ] `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` set and the webhook URL registered with Razorpay. Without these, Payment falls back to Mock — as of 2026-07-23 this fallback is hard-blocked in real production (`getPaymentProvider()` throws, `POST /api/billing/mock/confirm` returns `403` unconditionally when `NODE_ENV=production`) rather than silently granting free credits/subscriptions, but a real provider is still required for checkout to actually work at all — confirm `paymentsAvailable: true` on `GET /api/billing/plans` once configured.
- [ ] `BUSINESS_TAX_DETAILS` admin config filled in (legal name, GSTIN, address, state code) before the first real invoice is issued — otherwise invoices render "GSTIN: not provided," which is fine for testing but not for a real customer's books.
- [ ] A real Resend API key + a verified "From" address configured via `/admin/ai-providers` → Email → Resend (the `fromAddress` extra-config field). **As of 2026-07-23, zero `ProviderConfig` rows exist for EMAIL at all** — every transactional email (render-complete notices, receipts, admin broadcasts) is silently swallowed by `MockEmailProvider` (`console.log` only, reports fake `sent: true` to every caller). The real adapter (`src/lib/providers/email/resend.provider.ts`) and its Admin Panel catalog entry both already exist and are ready — this is purely a missing real Resend account/API key/verified sending domain, a founder decision deliberately left unconfigured rather than faked (see `PROJECT_STATUS.md`'s 2026-07-23 EMAIL entry).

## AI Providers

- [ ] At least one real provider enabled per category you intend to offer (LLM/Image/Voice/Video/Transcription) via `/admin/ai-providers` — done post-install, not via env vars, so an admin can rotate keys without a redeploy.
- [ ] Test Connection run for each enabled provider from the Admin Panel and confirmed green.
- [ ] Budget/rate-limit caps (`monthlyBudgetUsd`/`dailyBudgetUsd`/`rateLimitPerMinute`) set to sane values — the defaults are unlimited, which is fine for testing but risky for a real vendor bill.

## Security

- [ ] Fresh `AUTH_SECRET` generated for production (`openssl rand -base64 32`) — never the dev value.
- [ ] `NODE_ENV=production` so `Strict-Transport-Security` is actually sent (it's production-gated).
- [ ] Reviewed `SECURITY_CHECKLIST.md` in full and confirmed every item.

## Legal & Content

- [ ] `/privacy`, `/terms`, `/cookies` reviewed by an actual lawyer before relying on them commercially — the shipped content is real and product-tailored but AI-drafted (see `KNOWN_LIMITATIONS.md`).
- [ ] `/contact` form's destination email confirmed reachable (admin email config) — test by submitting a real message and confirming it arrives.

## Final Go/No-Go

- [ ] `tsc --noEmit`, `eslint .`, `vitest run`, `next build` all green on the exact commit being deployed.
- [ ] Founder acceptance test (Phase H, `PROJECT_STATUS.md` Milestone 12 section) re-run against the production-config build at least once before the first real customer signs up.
- [ ] `KNOWN_LIMITATIONS.md` read and accepted — every gap there is a deliberate, documented scope cut for this launch, not an unknown risk.
