# Provider Setup Guide

How to configure every AI/storage/payment vendor Elevatex AI talks to — entirely from **Admin → AI Providers**, no code edits, no redeploy.

## How credential resolution works

Since Milestone 10, every provider's credentials are resolved by `src/lib/providers/credentials.ts` in this order:

1. **The `ProviderConfig` database row** (what you save in Admin → AI Providers) — encrypted at rest (AES-256-GCM), checked first.
2. **The legacy environment variable** for that provider — used only as a fallback, and only for whatever field the DB row leaves unset.

Once you save a provider in the Admin Panel, the DB value wins for that field from then on. You never need to touch `.env` or redeploy to change a key, rotate it, or switch providers.

## Configuring a provider (Admin Panel)

1. Sign in as an admin and open **Admin → AI Providers**.
2. Find the provider card for the category you want (LLM, Image, Voice, Video, Storage, Payment).
3. Toggle **Enabled**.
4. Paste the **API Key** (and **API Secret** / extra fields, if that provider needs them — the card tells you which).
5. Optionally set **Model**, **Default Quality**, **Priority** (lower number tried first within a category), **Monthly/Daily Budget (USD)**, **Rate Limit (requests/min)**, **Timeout (ms)**, **Retry Count**, and a **Key expiry date** (you'll get a reminder banner across the whole Admin Panel within 7 days of that date).
6. Click **Test Connection** — this makes a real, cheap, read-only call to the vendor (see "What Test Connection actually checks" below), not a fake check.
7. Click **Save**.

Re-saving a provider's other settings later (priority, budget, etc.) **without** retyping its API key leaves the previously-saved key untouched — you only need to paste a key when you're actually setting or changing it. Pasting an empty value into a secret field clears it.

**Failover order**: when more than one provider is enabled in the same category, the engine tries them in **Priority** order (lowest first) and automatically falls over to the next one if a provider fails or is unhealthy.

## Per-provider reference

### LLM (script generation)

| Provider | Needs | Get a key at | Legacy env var (fallback only) |
|---|---|---|---|
| **OpenAI (GPT)** — `openai` | API Key | platform.openai.com/account/api-keys | `OPENAI_API_KEY` |
| **Google Gemini** — `gemini` | API Key, optional Model (default `gemini-1.5-flash`) | aistudio.google.com/app/apikey | `GEMINI_API_KEY`, `GEMINI_MODEL` |

A **Self-Hosted** LLM option (Ollama/vLLM/custom) also exists but is intentionally **not** in the Admin Panel — it's a URL, not an API key, configured purely via `SELF_HOSTED_LLM_URL` / `SELF_HOSTED_LLM_API_KEY` env vars. Use this if you're pointing at your own model server rather than a hosted vendor.

### Image generation

| Provider | Needs | Get a key at | Legacy env var |
|---|---|---|---|
| **OpenAI (GPT Image)** — `openai_images` | API Key (shared with the LLM OpenAI key) | platform.openai.com/account/api-keys | `OPENAI_API_KEY` |
| **Flux Pro (Replicate)** — `flux` | API Key (your Replicate token) + **Model** (the specific Flux model-version id from Replicate — there's no sensible default) | replicate.com/account/api-tokens | `REPLICATE_API_TOKEN`, `FLUX_MODEL_VERSION` |

### Voice generation

| Provider | Needs | Get a key at | Legacy env var |
|---|---|---|---|
| **ElevenLabs** — `elevenlabs` | API Key | elevenlabs.io → Profile → API Keys | `ELEVENLABS_API_KEY` |

### Video generation

| Provider | Needs | Get a key at | Legacy env var | Default |
|---|---|---|---|---|
| **Replicate** — `replicate` | API Key + **Model** (Replicate model-version id, no default) | replicate.com/account/api-tokens | `REPLICATE_API_TOKEN`, `REPLICATE_MODEL_VERSION` | — |
| **Google Veo** (best-effort) — `veo` | API Key (your Gemini API key — Veo runs through the same Generative Language API), optional Model (default `veo-3.0-generate-001`) | aistudio.google.com/app/apikey | none — DB only | **disabled** |
| **Kling AI** (best-effort) — `kling` | API Key (access key) **+ API Secret** (secret key, used to sign a short-lived JWT per request) | klingai.com developer console | none — DB only | **disabled** |
| **Hailuo / MiniMax** (best-effort) — `hailuo` | API Key | api.minimax.chat console | none — DB only | **disabled** |
| **Runway** (best-effort) — `runway` | API Key | dev.runwayml.com | none — DB only | **disabled** |

> **"Best-effort" means**: built against each vendor's documented REST API shape, but **not verified against a live account** — these vendors' video-generation APIs are in active preview and have changed field names before. They ship with **Enabled = off** by default so you don't accidentally turn on an expensive, unverified provider. Confirm against the vendor's current docs (and your own account's access tier) before relying on one in production — see Test Connection's caveats below for these four specifically.

### Storage

| Provider | Needs | Legacy env vars |
|---|---|---|
| **S3 / Cloudflare R2** — `s3` | API Key (access key id) + API Secret (secret access key) + extra fields: **Bucket**, **Region** (use `auto` for R2), **Endpoint** (R2/MinIO only — leave blank for real AWS S3), **Public base URL** (optional CDN override) | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` |

If Storage is disabled, the app falls back to its Mock storage adapter — fine for local dev/demo, not for production (no durable URLs).

### Payment

| Provider | Needs | Get keys at | Legacy env vars |
|---|---|---|---|
| **Razorpay** — `razorpay` | API Key (Key ID) + API Secret (Key Secret) + Extra Secret (Webhook Secret, used to verify `x-razorpay-signature` on incoming webhooks) | dashboard.razorpay.com → Settings → API Keys | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |

If Payment is disabled, the app uses its Mock payment adapter (instant-confirm, no real money) — `/api/billing/mock/confirm` 403s automatically once a real provider is enabled, so you can't accidentally leave a fake-money path live in production.

## What "Test Connection" actually checks

A real, minimal, read-only call per vendor — never a fake green check:

- **OpenAI** (LLM + Images): `GET /v1/models`
- **Gemini**: `GET /v1beta/models` — for **Veo**, this only confirms the API key itself is valid for the Generative Language API, not specifically that your account has Veo access (Google doesn't expose a cheaper Veo-specific check).
- **ElevenLabs**: `GET /v1/user`
- **Replicate / Flux**: `GET /v1/account`
- **Runway**: `GET /v1/organization`
- **S3**: `HeadBucketCommand` against your configured bucket
- **Razorpay**: `orders.all({count: 1})`
- **Kling / Hailuo**: shape-only check (key/secret present) — these two vendors don't expose a documented cheap verification endpoint, so this is honestly reported as "present, not live-tested" rather than pretending to have verified access.

## Security

- Every API key/secret is encrypted at rest with **AES-256-GCM** before it touches the database (`lib/security/encryption.ts`).
- Saved secrets are **never echoed back in plaintext** — the Admin Panel only ever shows a masked tail (`••••••••1234`).
- Every save and every Test Connection is recorded in the **provider audit log** (field names changed, never values) — visible at the bottom of Admin → AI Providers.
- The one secret that protects all the others — the encryption master key — is either `CREDENTIAL_ENCRYPTION_KEY` (env var, recommended for production) or an auto-generated `.encryption-key` file at the project root (zero-setup default, fine for a single-instance/dev deployment). See `ENVIRONMENT_GUIDE.md`.

## Adding a future provider (for developers)

Per the architecture rules this milestone established, adding provider #13 should require exactly three steps and nothing else:

1. **New adapter** — implement the category's interface (`LLMProvider`/`ImageProvider`/`VoiceProvider`/`VideoProvider`/`StorageProvider`/`PaymentProvider`) in `src/lib/providers/<category>/<name>.provider.ts`, taking a `ProviderRuntimeConfig` in its constructor (never reading `process.env` directly).
2. **Provider registration** — add its id to that category's `*_IDS` constant and factory switch statement in `src/lib/providers/<category>/index.ts`.
3. **Admin configuration** — add one entry to `PROVIDER_CATALOGUE` in `src/lib/admin/ai-providers.ts` (label, whether it needs an API Secret/Extra Secret, any extra non-secret config fields), and a connection-test case in `src/lib/providers/test-connection.ts`.

Nothing else needs to change — no engine code, no admin UI code, no database migration (unless the new provider needs a genuinely new non-secret config field, in which case it's a single nullable column on `ProviderConfig`).
