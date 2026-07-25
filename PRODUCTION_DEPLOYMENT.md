# Production Deployment — Elevatex AI

Target: a generic self-hosted VPS (Ubuntu 22.04+ recommended) via Docker Compose. No platform-specific lock-in (not Vercel-only) — this works on any VPS with Docker installed (DigitalOcean, Hetzner, AWS EC2, etc.).

## 1. Prerequisites on the VPS

- Docker Engine + Docker Compose plugin installed.
- A domain pointed at the VPS's IP, with a reverse proxy (e.g. Caddy, Nginx, or Traefik) terminating TLS in front of port 3000. This repo doesn't include a reverse-proxy config — pick whichever your team already operates, since the requirement is just "HTTPS in front of port 3000."
- An object storage bucket (AWS S3, Cloudflare R2, or self-hosted MinIO) for media assets.

## 2. Clone and configure

```bash
git clone <your-repo-url> elevatex-ai
cd elevatex-ai
cp .env.example .env.local
```

Fill in `.env.local`. At minimum for a working production deployment:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Overridden to the in-network `postgres` service by `docker-compose.yml` — only matters if you point at an external managed Postgres instead. |
| `AUTH_SECRET` | Yes | Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Yes | Your real public URL, e.g. `https://app.example.com`. |
| `MSG91_AUTH_KEY` | Recommended | Without it, OTP send falls back to dev mode (logs the code instead of sending an SMS) — **do not ship to real users without this set**. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Recommended | Without these, Payment falls back to Mock (instant fake confirmation, no real charge). |
| `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_BASE_URL` | Recommended | Without these, Storage falls back to Mock (local-only, not durable). |
| `REDIS_URL` | Optional | Overridden to the in-network `redis` service by `docker-compose.yml`. Without Redis at all, cache/rate-limiting fall back to in-process/DB — fine for a single instance, not for multiple. |
| `SENTRY_DSN` | Optional | Error tracking — silently disabled when unset. |
| `RESEND_API_KEY` | Optional | Without it, Email falls back to Mock (logs only, no real email sent) — set this before relying on render-complete/broadcast emails. |
| `QUEUE_PROCESS_SECRET` / `CREDIT_EXPIRY_SECRET` / `SUBSCRIPTION_RENEWAL_SWEEP_SECRET` | Optional | Only needed if you run the queue/credit-expiry/subscription-renewal-sweep via an external cron hitting `/api/internal/*` instead of the in-process worker (see §5). The renewal sweep (`POST /api/internal/subscriptions/renew-sweep`) has no in-process equivalent — point a daily cron at it in production, same as credit-expiry. |

Every other AI provider credential (LLM/Image/Voice/Video/Transcription) is configured **after first boot**, from the Admin Panel (`/admin/ai-providers`) — not env vars. This is intentional: it's how an admin rotates/adds providers without a redeploy.

## 3. Build and start

```bash
docker compose up -d --build
```

This starts three containers:
- `postgres` — the primary database.
- `redis` — the cache/rate-limit layer.
- `app` — the Next.js app, built from the repo's `Dockerfile`. On every start it runs `prisma migrate deploy` (safe to repeat — a no-op when nothing's pending) before starting the server.

Check it came up healthy:

```bash
docker compose ps
docker compose logs -f app
curl http://localhost:3000/api/health   # if you've added a lightweight liveness route, or:
curl -I http://localhost:3000/
```

## 4. First-run installation

Visit `https://your-domain/install` and walk through the Installation Wizard: OTP verification, promote yourself to Super Admin, test the database connection, optionally configure Storage/Payment, optionally seed demo data. This is the **same wizard every environment uses** — there's no separate "production setup script."

After install, go to `/admin/ai-providers` and enable the real AI providers (LLM/Image/Voice/Video/Transcription/Email) you want active — every category defaults to Mock until an admin explicitly enables a real one.

## 5. Worker scaling

The render queue (`lib/queue/queue.ts`) uses an atomic, conditional `UPDATE ... WHERE status = 'PENDING'` claim — **safe to run multiple `app` instances/processes against the same database with zero additional coordination**. To scale horizontally:

```bash
docker compose up -d --scale app=3
```

(You'll need a load balancer in front of the 3 instances if you do this — the compose file as written maps `app`'s port directly to the host, which only works for a single instance. A reverse proxy with multiple upstream targets, or a Swarm/Kubernetes setup, is the next step beyond this Compose file's scope.)

Structured logs (`lib/observability/logger.ts`) tag every line with `instance: process.pid` so multi-instance logs stay distinguishable in your log aggregator.

## 6. Backups

**Backup** (run from the VPS, or any host with `pg_dump` and network access to the `postgres` container):

```bash
docker compose exec postgres pg_dump -U elevatex -d elevatex_ai -Fc -f /tmp/backup.dump
docker compose cp postgres:/tmp/backup.dump ./backups/elevatex-ai-$(date +%Y%m%d-%H%M%S).dump
```

Automate this with a daily cron job, and copy the resulting `.dump` file off-box (e.g. to S3) — a backup that only lives on the same disk as the database isn't a real backup.

**Restore**:

```bash
docker compose cp ./backups/elevatex-ai-YYYYMMDD-HHMMSS.dump postgres:/tmp/restore.dump
docker compose exec postgres pg_restore -U elevatex -d elevatex_ai --clean --if-exists /tmp/restore.dump
docker compose restart app
```

Object storage (S3/R2) is durable by the provider's own design — back it up per your provider's own bucket-replication/versioning features if you need point-in-time recovery for media assets too.

## 7. Zero-downtime deploys

For a single-instance VPS deployment, a deploy is necessarily a brief restart:

```bash
git pull
docker compose up -d --build app
```

`docker compose up -d --build` rebuilds only the `app` image and replaces the container — Postgres/Redis are untouched, so no data is at risk. The brief gap (image build + container restart, typically under a minute) is the honest tradeoff of a single-instance Compose deployment; true zero-downtime needs the multi-instance + load-balancer setup from §5 (rolling one instance at a time while the others serve traffic).

## 8. Known limitations of this deployment path

See `KNOWN_LIMITATIONS.md` for the full list. The most relevant ones here:
- No managed auto-scaling — scaling is manual (`--scale app=N` + your own load balancer).
- No built-in CDN — static assets are served by Next.js directly; put a CDN in front of your reverse proxy if you need one.
- No automated off-box backup scheduling — §6's commands are provided, but wiring them into a cron job is left to your ops setup.
