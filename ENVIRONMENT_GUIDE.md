# Environment Variables Guide

Every environment variable Elevatex AI reads, grouped by whether it's required at boot, optional infrastructure config, or a legacy provider-credential fallback that Admin → AI Providers has superseded. See `.env.example` for the copy-pasteable template.

## Required — the app won't start without these

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. The app fails fast at startup with a clear error if this is missing (`src/lib/env.ts`) rather than surfacing a cryptic Prisma error later. |
| `AUTH_SECRET` | NextAuth (Auth.js) session/JWT signing secret. Generate with `openssl rand -base64 32`. Keep it stable — rotating it invalidates every existing session. |

## Strongly recommended for production

| Variable | What it's for |
|---|---|
| `CREDENTIAL_ENCRYPTION_KEY` | 64 hex characters (`openssl rand -hex 32`). Encrypts every provider API key/secret saved via Admin → AI Providers. **If unset**, a key is auto-generated on first use and persisted to a gitignored `.encryption-key` file at the project root — fine for a single, persistent-disk dev/demo instance, **not safe** for serverless/multi-instance deployments (no shared disk, see `DEPLOYMENT_GUIDE.md`). Losing this key means every saved provider credential must be re-entered in the Admin Panel — nothing else is affected. |
| `NEXTAUTH_URL` | Your app's public URL (e.g. `https://yourdomain.com`). Required for NextAuth's redirect/callback handling to work correctly in production. |

## Optional — auth & OAuth

| Variable | What it's for |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in. Leave blank to offer Phone OTP only. Redirect URI to register: `<your-url>/api/auth/callback/google`. |

## Optional — SMS delivery (OTP)

| Variable | What it's for |
|---|---|
| `MSG91_AUTH_KEY` | Real SMS delivery for phone OTP. **Left blank in dev/today**: `/api/auth/otp/send` falls back to dev mode — the OTP is returned directly in the API response and logged server-side, no real SMS sent. This is documented as not-yet-implemented (see `PROJECT_STATUS.md` Known Issues) — setting this alone does not currently send a real SMS; full MSG91 wiring is a near-term roadmap item. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Reserved for a Twilio failover path — not yet wired up. |

## Optional — background job scheduling

| Variable | What it's for |
|---|---|
| `QUEUE_PROCESS_SECRET` | Bearer-token secret for `POST /api/internal/queue/process` (drains the render queue). Leave blank in dev — an in-process worker runs automatically. Set this in production and point a real scheduler at the route — see `DEPLOYMENT_GUIDE.md`. |
| `CREDIT_EXPIRY_SECRET` | Same pattern, for `POST /api/internal/credits/expire` (expires stale credit lots). |

## Legacy provider-credential fallbacks (superseded by Admin → AI Providers)

**As of Milestone 10, none of these are required.** They exist purely as a fallback for whatever a provider's `ProviderConfig` database row leaves unset — once you save a provider's key in Admin → AI Providers, that value wins and the matching env var below is ignored for that field. Useful if you prefer pure env-var-based config (e.g. injected by your platform's secret manager) over the Admin Panel, or as a stopgap before you've opened the Admin Panel at all.

| Variable | Provider | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `openai` (LLM), `openai_images` (Image) | Shared between both — one OpenAI account, two adapters. |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | `gemini` (LLM) | Model defaults to `gemini-1.5-flash` if unset. |
| `SELF_HOSTED_LLM_URL` / `SELF_HOSTED_LLM_API_KEY` | `self_hosted` (LLM) | **Not** in the Admin Panel by design — this is a URL, not a vendor API key, for pointing at your own model server (Ollama/vLLM/etc.). Env-var-only, permanently. |
| `ELEVENLABS_API_KEY` | `elevenlabs` (Voice) | |
| `REPLICATE_API_TOKEN` / `REPLICATE_MODEL_VERSION` | `replicate` (Video) | Token is shared with Flux below. |
| `FLUX_MODEL_VERSION` | `flux` (Image) | Runs as a Replicate prediction — shares `REPLICATE_API_TOKEN`. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_PUBLIC_BASE_URL` | `s3` (Storage) | Also covers Cloudflare R2/MinIO via `S3_ENDPOINT`. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | `razorpay` (Payment) | |

**No env-var fallback exists** for the 4 best-effort video adapters added in Milestone 10 (Veo, Kling, Hailuo, Runway) — they didn't exist before the Admin Panel did, so they're DB-only. Configure them exclusively through Admin → AI Providers.

## A note on `PROVIDER_*_PRIORITY` (pre-Milestone-10 SystemConfig keys)

Before Milestone 10, provider *selection/priority* lived in `SystemConfig` (edited via the old `/admin/providers` page) as ordered-array keys like `PROVIDER_LLM_PRIORITY`. These still work as a fallback **only** for a category that has zero `ProviderConfig` rows at all — the moment you save anything for a category in Admin → AI Providers, that table becomes authoritative for priority/selection in that category and the old SystemConfig key is no longer consulted for it. You don't need to touch these directly; the old `/admin/providers` page now redirects to `/admin/ai-providers`.

## Quick reference: what's safe to leave blank

Everything in this document is safe to leave blank for local development — the app boots with just `DATABASE_URL` and `AUTH_SECRET`, every AI/storage/payment category falls back to its Mock adapter, and the Installation Wizard walks you through configuring real vendors afterward. Nothing here needs to be "right" before you start the app; it only needs to be right before you rely on the matching feature in production.
