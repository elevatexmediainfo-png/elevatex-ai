# Known Limitations — Elevatex AI

Every gap in this list is a deliberate, documented scope decision made during Milestone 12 (or inherited from an earlier milestone and re-confirmed still true) — not an unknown risk discovered too late to fix. Where a gap has a clear future fix, it's noted.

## Infrastructure & Deployment

- **Single-instance Docker Compose deploy.** `docker-compose.yml` runs one `app` container. A deploy (`docker compose up -d --build`) has a brief restart window — there's no rolling/zero-downtime deploy orchestration (that needs a load balancer + multiple app instances, out of scope for a single-VPS launch). The render queue itself is safe to scale horizontally today (atomic-claim, confirmed multi-process-safe) — only the deploy *mechanism* is single-instance.
- **No managed autoscaling.** Resource limits and instance count are fixed in `docker-compose.yml`; there's no Kubernetes HPA or equivalent. Appropriate for a self-hosted VPS launch; revisit if traffic outgrows one VPS's vertical scaling headroom.
- **No CDN.** Static assets are served directly by Next.js / the reverse proxy in front of it. Fine at beta/early-launch scale; a CDN (Cloudflare in front of the reverse proxy is the lowest-effort option) becomes worth it once there's real geographic traffic spread.
- **No automated off-box backup scheduling.** `PRODUCTION_DEPLOYMENT.md` documents the `pg_dump` command and restore procedure, but running it on a schedule and shipping the dump off the VPS (S3, etc.) is left to the operator's own cron — not wired up as part of this repo's tooling.
- **Config cache is per-instance, not pushed.** `lib/cache/cache.ts` uses Redis when configured, but there's no pub/sub invalidation — an admin config change is picked up by each running instance independently, on that instance's own TTL, rather than instantly everywhere. Only matters once you're running more than one app instance.

## Security

- **Presigned-upload path skips magic-byte validation.** `/api/assets/upload-url` bytes go straight from the browser to storage, never transiting the Next.js server — so the `file-type` magic-byte check (Phase D) can't run on them. The multipart `/api/assets/upload` path is fully validated. A renamed-extension attack via the presigned path would currently only be caught by the MIME-allowlist on `contentType` (client-supplied, spoofable), not byte content.
- **No real malware/virus scanning.** ClamAV or a VirusTotal-style API integration would need external infrastructure this milestone didn't stand up. Both upload paths accept files based on type/size validation only.
- **Abuse detection is rule-based, not ML.** Two fixed thresholds (excessive rate-limit hits, fast credit burn) — effective against simple abuse, not adversarial/slow-and-low patterns.
- **No third-party security audit performed.** `SECURITY_CHECKLIST.md` is a self-review against this codebase's own code, not a penetration test.

## Observability

- **No separate distributed-tracing collector.** Sentry's own tracing (OTel-based under the hood) is wired in, env-gated; a standalone Jaeger/Tempo collector was deliberately not stood up since it assumes infrastructure beyond a single VPS.
- **Health and Error visibility consolidated into one admin page** (`/admin/health`) rather than separate dashboards — a pragmatic choice for this scale, not a structural limit (the underlying functions are already separable if a future milestone wants to split them).

## Payments & Billing

- **No refunds/proration.** Subscription cancellation is cancel-at-period-end only (inherited from Milestone 5) — no partial refund or immediate-cancel-with-proration path.
- **`GENERATION_COST_RATES` are illustrative, not vendor-pinned.** Admin-editable $/unit figures don't auto-sync with each AI vendor's live pricing page and will drift over time — treat `costUsd` reporting as directionally useful, not invoice-accurate, until an admin tunes them against current vendor rates.
- **Mock payment confirmation route exists in all environments**, gated to be a no-op once any real PAYMENT provider is enabled (`POST /api/billing/mock/confirm`, fixed during Phase H to correctly detect "nothing configured = Mock" vs. "a real provider is configured"). Confirm this gate before launch as part of `LAUNCH_CHECKLIST.md`.

## AI / Generation

- **No real-vendor failover has been observed against an actual live-API outage.** Verified live only against a missing-credential failure mode (a real, common case) and via unit tests with fakes — a genuine network-timeout/5xx from e.g. real OpenAI/Gemini hasn't been exercised in this environment (no live vendor credentials configured here).
- **Real ffmpeg-based scene merge exists only for the Mock video provider.** A real deployment using a vendor without native multi-clip concatenation (e.g. Replicate) would need a dedicated video-editing/concat adapter behind the same `VideoProvider` interface — `ReplicateVideoProvider.mergeScenes()` honestly throws today rather than faking success.
- **Scene decomposition (GENERATED flow) is deterministic, not LLM-planned** — splits on `[HOOK]/[BODY]/[CTA]` markers, falling back to paragraphs then a single scene. This is a scope choice, not an architectural limit; `lib/scenes/engine.ts`'s `splitScriptIntoSceneTexts()` is the one function an LLM-based planner would replace.
- **Talking-head AI video generation is feature-flagged off by default** (`TALKING_HEAD_AI_VIDEO_GENERATION_ENABLED`) — without it, AI_VIDEO asset-selector decisions downgrade to AI_IMAGE.

## Legal & Content

- **`/privacy`, `/terms`, `/cookies` are AI-drafted, product-tailored boilerplate** — real and complete enough to ship a beta with, but pending an actual lawyer's review before relying on them commercially. This note is intentionally *not* on the public pages themselves (that would undermine user trust); it lives here instead.

## Testing

- **No browser-automation tool was available in this environment.** All Milestone 12 verification (Phase H) is a scripted HTTP-level pass against real routes through minted session cookies, plus SSR-HTML spot-checks — not full visual/interaction QA in an actual browser. `BETA_TEST_PLAN.md` exists specifically to close this gap with real human testers in real browsers before public launch.
- **`npm audit` reports 5 moderate advisories**, all confined to build-time-only transitive dependencies (`@prisma/dev`'s nested `@hono/node-server`, Next.js's bundled `postcss`) — neither package ships in or is reachable from the running production app. Not force-upgraded this late in the milestone to avoid an unplanned Prisma/Next major-version bump; worth revisiting in a future dependency-maintenance pass.
