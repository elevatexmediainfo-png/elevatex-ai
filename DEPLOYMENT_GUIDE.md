# Deployment Guide

Getting Elevatex AI running — locally for development, and in production. There is no app-level Dockerfile yet (only PostgreSQL is containerized via `docker-compose.yml`) — the Next.js app itself runs via `npm run build && npm start` on whatever host you choose (Vercel, a VM, a container you build yourself).

## Local development

1. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and `AUTH_SECRET` (generate one with `openssl rand -base64 32`). Everything else can stay blank for local dev — every AI/storage/payment category falls back to its Mock adapter.
2. Start Postgres: `docker compose up -d`.
3. Apply migrations: `npx prisma migrate deploy` (or `npx prisma migrate dev` if you're actively changing the schema).
4. `npm install`
5. `npm run dev`
6. Visit `http://localhost:3000` — since this is a fresh database, you'll land on the **Installation Wizard** (`/install`) automatically. Walk through its 7 steps (see `INSTALLATION_GUIDE.md`) to create your admin account and seed starter content.

After that, sign in as the admin you just created and everything else — providers, pricing, rules — is managed from `/admin/*`.

## Production deployment

### What's required before first boot

Only two environment variables are hard-required (the app fails fast at startup with a clear error if either is missing — `src/lib/env.ts`):

- `DATABASE_URL` — your production Postgres connection string.
- `AUTH_SECRET` — a stable secret for NextAuth session/JWT signing. Generate once and keep it stable across deploys/restarts (rotating it invalidates every existing session).

Everything else (AI provider keys, storage, payment, SMS, even the credential-encryption key) is either optional at boot or configured later through the Installation Wizard and Admin Panel. See `ENVIRONMENT_GUIDE.md` for the full list.

### Steps

1. **Provision Postgres.** Any standard Postgres works — Neon, Supabase, Railway, RDS, or your own. Set `DATABASE_URL` to point at it.
2. **Apply migrations** against that database: `npx prisma migrate deploy`. Do this as part of your deploy pipeline, before the new app version starts serving traffic.
3. **Set `DATABASE_URL` and `AUTH_SECRET`** in your hosting platform's environment variable settings.
4. **(Recommended) Set `CREDENTIAL_ENCRYPTION_KEY`** explicitly (`openssl rand -hex 32`) rather than relying on the auto-generated `.encryption-key` file — see the warning in `ENVIRONMENT_GUIDE.md` about why this matters more in production than in dev.
5. **Build and start**: `npm run build` then `npm start` (or your platform's equivalent — e.g. Vercel does this automatically on push).
6. **Visit your production URL once, signed in as nobody.** You'll be redirected to `/install`. Complete the wizard — this creates your real admin account and configures your real AI providers, storage, and payment vendor. Do this immediately after first deploy, before announcing the URL to anyone, since the wizard is reachable to anyone who visits the site until you finish it.
7. **Schedule the two cron-style internal routes** (see below) — without these, render jobs and credit-lot expiry won't process.

### Scheduling the internal cron routes

Two routes exist for background work that needs to run on a schedule, gated by a bearer-token secret rather than session auth:

| Route | Purpose | Suggested interval |
|---|---|---|
| `POST /api/internal/queue/process` | Drains the render queue (also runs automatically via an in-process worker in dev — set this up for production where you may run multiple stateless instances) | Every 1-2 minutes |
| `POST /api/internal/credits/expire` | Expires stale credit lots past their `expiresAt` | Once daily |

Set `QUEUE_PROCESS_SECRET` / `CREDIT_EXPIRY_SECRET` and point your scheduler (Vercel Cron, a cron job on a VM, GitHub Actions scheduled workflow, etc.) at each route with `Authorization: Bearer <the matching secret>`.

### Platform notes

- **Vercel**: works out of the box for the Next.js app itself. Note that `.encryption-key`'s auto-generated-file fallback does **not** survive across serverless invocations/redeploys on Vercel (no persistent disk) — set `CREDENTIAL_ENCRYPTION_KEY` explicitly, or every provider credential will need re-entering after every deploy. Use Vercel Cron for the two internal routes above.
- **Self-hosted (VM/container you build)**: a persistent disk means the auto-generated `.encryption-key` file works fine across restarts, but still set `CREDENTIAL_ENCRYPTION_KEY` explicitly if you ever run more than one instance (each instance needs the *same* key to decrypt what another instance encrypted). Run `npm start` under a process manager (PM2, systemd) and use a real cron daemon for the two internal routes.
- **Database migrations on every deploy**: always run `npx prisma migrate deploy` before starting the new app version, as part of your CI/CD pipeline — never run `prisma migrate dev` against production.

### Post-deploy checklist

- [ ] `DATABASE_URL` and `AUTH_SECRET` set, app boots without the env-validation error
- [ ] Migrations applied (`npx prisma migrate deploy`), zero drift (`npx prisma migrate diff` against the live DB is empty)
- [ ] Installation Wizard completed — admin account created, at least one real AI provider configured and Test-Connection-verified, storage/payment chosen (real or intentionally Mock for a soft launch)
- [ ] `CREDENTIAL_ENCRYPTION_KEY` set explicitly (strongly recommended for anything beyond a single persistent-disk instance)
- [ ] Both internal cron routes scheduled with their secrets set
- [ ] `npm run build` / `npx tsc --noEmit` / `npx eslint .` / `npm test` all green (CI should enforce this on every PR)

## Multi-instance considerations

A few things are documented as currently in-process-only, fine for a single instance, worth revisiting before scaling horizontally:

- `lib/admin/config.ts`'s settings cache (30s TTL, in-process) — a second instance can read stale config for up to 30s after an admin change. Not currently an issue with Vercel-style stateless functions (no long-lived cache to go stale), more relevant for a long-running VM process.
- The SSE scene-progress stream polls the DB server-side every 1.5s per connected client rather than a real pub/sub push — fine at current scale.
- `checkProviderBudget()` (per-provider budget/rate-limit enforcement) queries `GenerationLog` fresh on every request rather than caching, so it's already safe under multiple instances — just worth knowing it's a real query, not free.

None of these block a production deployment; they're candidates for a Redis-backed upgrade if/when traffic justifies it.
