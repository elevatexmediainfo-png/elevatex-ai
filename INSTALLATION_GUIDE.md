# Installation Guide

How to take a freshly-deployed Elevatex AI from "empty database" to "ready to use" — entirely through your browser, no code, no `.env` editing beyond the database connection string itself.

## When the wizard appears

On first load of any page, the app checks a one-way flag (`SystemConfig.INSTALLATION_COMPLETED`). If it's not set:

- Visiting `/install` shows the wizard.
- Visiting **anything else** (`/`, `/login`, `/admin`, `/dashboard`, etc.) **redirects you to `/install`** automatically.

Once you finish the wizard, that flag flips permanently to `true`:

- `/install` becomes **permanently inaccessible** (redirects away) — it cannot be re-run by visiting the URL again.
- Every other page works normally.

There is no way to "uninstall" from the UI by design — if you genuinely need to re-run the wizard (e.g. wiping a dev database), clear the `SystemConfig` row with key `INSTALLATION_COMPLETED` directly in the database.

## Before you start

You need exactly one thing already set: a working `DATABASE_URL` pointing at a reachable PostgreSQL database (local Docker, Neon, Supabase, Railway, or any standard Postgres). Run your pending Prisma migrations (`npx prisma migrate deploy`) before first load — the wizard configures the *application*, not the database schema itself.

Everything else — storage, payments, AI providers, even who the admin is — is configured *inside* the wizard.

## The 7 steps

### 1. Super Admin
Enter your phone number, request an OTP (in dev mode without `MSG91_AUTH_KEY` set, the OTP is shown directly on screen and logged — no SMS needed), enter the code to sign in, then the wizard promotes that freshly-created account to `ADMIN` and refreshes your session immediately — no second sign-in required. There is no separate "set a password" step; this app authenticates by Phone OTP (and Google OAuth for regular users), not passwords, so the admin account works the same way.

### 2. Database
Confirms the database connection the app is already running against is reachable. (This step validates the connection you already configured via `DATABASE_URL` — it isn't a generic "test any connection string" tool. If this step fails, the app couldn't have started in the first place.)

### 3. Storage
Choose Cloudflare R2, AWS S3, or stick with local/mock storage for now. If you choose a real provider, paste its access key/secret/bucket/region and click **Test Connection** (a real `HeadBucketCommand` against your bucket) before moving on. You can leave this on Mock storage for an initial test run and switch to a real provider later from Admin → AI Providers — nothing here is a one-way decision.

### 4. Payments
Choose Razorpay or stick with Mock payments (instant-confirm, no real money — fine for testing the product end-to-end before going live). If you choose Razorpay, paste your Key ID/Secret/Webhook Secret and Test Connection. Same as Storage: this can be changed later from the Admin Panel.

### 5. AI Providers
Paste API keys for whichever LLM/Image/Voice/Video vendors you want to start with (OpenAI, Gemini, ElevenLabs, Replicate/Flux, etc. — see `PROVIDER_SETUP.md` for the full list and where to get each key) and Test Connection each one. You don't have to configure every category here — anything left blank simply falls back to the Mock adapter for that category until you configure it later, and every field here is editable again afterward from Admin → AI Providers.

### 6. Seed Data
One click seeds the starter content every fresh install needs: 10 vertical-specific video templates, 3 credit packages, and 3 pricing plans (Free trial / Pay Per Download / Monthly Subscription). This is the same seed data `npx prisma seed` would produce via the CLI — both paths share one source (`lib/seed-defaults.ts`), so they can never drift apart.

### 7. Finish
Flips `INSTALLATION_COMPLETED` to `true` and redirects you to the Dashboard, signed in as your new admin account. From here, everything is managed from **Admin → AI Providers**, **Admin → Cost Management**, **Admin → Pricing & Credits**, etc. — no further `.env` edits or redeploys for day-to-day operation.

## What you can change later vs. what's locked in

| Decision | Changeable after install? |
|---|---|
| Storage provider | Yes — Admin → AI Providers |
| Payment provider | Yes — Admin → AI Providers |
| AI provider keys/models/budgets | Yes — Admin → AI Providers |
| Pricing plans/credit packages | Yes — Admin → Pricing & Credits |
| Who the admin is | Not via the wizard — promote additional admins by editing `User.role` directly, or build an in-app "invite admin" flow as a future enhancement |
| The database itself | No — `DATABASE_URL` is an env var, set before the app starts |

## Troubleshooting

- **"/install" keeps appearing even after I finished it** — check that `SystemConfig.INSTALLATION_COMPLETED` actually got written; if the Finish step's network call failed silently, retry it from the wizard (it's idempotent — finishing twice is harmless).
- **A step's Test Connection fails** — the error message shown is the real vendor error (e.g. an actual 401 from OpenAI), not a generic failure. Fix the credential and retry; nothing about the wizard's state is lost between attempts.
- **I want to change something I set during install** — every wizard step (other than Super Admin/Database) just calls the same Admin Panel routes you'd use afterward. There's nothing wizard-exclusive to "undo" — just go to the relevant Admin page and change it.
