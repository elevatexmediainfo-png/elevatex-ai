# Admin Panel Guide

A tour of everything manageable from `/admin/*` after installation — for the person running the business, not the person writing the code. Every page here takes effect within seconds, with no redeploy.

## Navigation

| Page | What it's for |
|---|---|
| **Founder Dashboard** (`/admin/founder`) | Today, at a glance: revenue, usage, AI cost, and a rough profit/CLV/ARPU estimate. The densest page in the panel, intentionally. |
| **Command Center** (`/admin/command-center`) | Everything needing attention right now — provider outages, failed queue/webhooks/payments, subscription drop, spend/storage/credit thresholds — plus the installation-readiness checklist. Every alert links straight to its fix. |
| **Health** (`/admin/health`) | Database/Redis/storage reachability, queue depth, per-provider circuit-breaker status. |
| **AI Providers** (`/admin/ai-providers`) | Configure every AI/storage/payment vendor: enable/disable, keys, models, budgets, rate limits, priority/failover order. See `PROVIDER_SETUP.md` for the full per-provider reference. |
| **Payments** (`/admin/payments`) | PaymentIntent list, webhook event log with one-click retry, refunds. Which payment provider is active is still set on AI Providers (category PAYMENT) — this is the payments-specific lens on top of that. |
| **Subscriptions** (`/admin/subscriptions`) | Every subscriber, their status/period/trial flag, and an admin "cancel now" action (distinct from the user's own cancel-at-period-end). |
| **Revenue** (`/admin/revenue`) | Total revenue, MRR/ARR, revenue by day/kind, top-earning plans — derived from settled payments, not AI vendor cost. |
| **Cost Management** (`/admin/cost-management`) | What you're actually spending with vendors, broken down by provider/model/project/user/subscription plan. |
| **Generation Engine** (`/admin/generation`) | Retry/timeout/health/cost-rate policy that applies across every provider; provider health and recent usage/failures. |
| **Render Pipeline** (`/admin/render`) | Live render queue depth, scene-render stats, render history, render policy (concurrency, max attempts, default negative prompt/background music). |
| **Storage** (`/admin/storage`) | Asset counts/sizes by kind/source, bucket reachability. |
| **Pricing & Credits** (`/admin/pricing`) | Subscription plans (price, billing interval, trial days), one-time credit packages, and one-off/promotional credit grants by email or phone. |
| **Coupons** (`/admin/coupons`) | Discount/credit coupon codes. |
| **Notifications** (`/admin/notifications`) | In-app/email broadcast notifications. |
| **Abuse** (`/admin/abuse`) | Rule-based abuse flags (excessive rate-limit hits, fast credit burn) and manual suspend/unsuspend. |
| **Download & Credit Rules** (`/admin/rules`) | Download rate limits, credit consumption order (which type of credit gets spent first), and related rules. |

## AI Providers — day-to-day operations

### Enabling/disabling a provider
Toggle **Enabled** on its card and Save. A disabled provider is removed from its category's failover chain immediately — in-flight requests aren't interrupted, but the next request won't try it.

### Changing failover order
Set **Priority** (lower number = tried first) on each enabled provider in a category. With two providers enabled, e.g. OpenAI at priority 0 and Gemini at priority 1, every LLM call tries OpenAI first and automatically falls over to Gemini if OpenAI fails or is in a health cooldown.

### Setting a budget cap
**Monthly Budget (USD)** / **Daily Budget (USD)** are hard caps, evaluated against your actual recorded spend (Cost Management's same numbers). Once a provider exceeds its cap, the engine stops sending it traffic for the rest of that period — automatically, with no admin action needed — and falls over to the next provider in priority order. If every enabled provider in a category is over budget, requests in that category will fail outright rather than silently exceeding your caps; that's deliberate; raise a budget or enable another provider if you hit this.

### Rate limiting
**Rate Limit (requests/min)** caps how fast a single provider can be called, independent of budget — useful for vendors with hard API rate limits.

### Key expiry reminders
Set **Key expires** to a date and you'll see a warning banner across every Admin page (not just this one) starting 7 days before that date, and a persistent "key has expired" warning after it passes. Rotating a key is just pasting a new one into the same field and saving — there's no separate "rotate" action needed.

### Test Connection
Always click this after pasting a new key — it makes a real, minimal call to the vendor (see `PROVIDER_SETUP.md` for exactly what each vendor's test checks) and tells you immediately if something's wrong, before any real user-facing request would fail.

### Audit log
The bottom of the AI Providers page shows every save and test-connection action, who did it, and when — field names only, never the secret values themselves.

## Cost Management — reading the dashboard

Pick a window (24h / 7d / 30d) and you'll see:

- **Totals**: requests, total cost, tokens, images, voice seconds, video seconds across everything.
- **By provider**: which vendor is actually costing you money, and how much.
- **By model**: same, broken down by the specific model in use (e.g. `gpt-4o-mini` vs. a future GPT-5 swap) — only populates for activity *after* a provider started reporting its model (older log rows predate this and show as unattributed, not a bug).
- **By project** (top 20 by cost): which video projects are the most expensive to produce.
- **By user** (top 20 by cost): which users are driving the most vendor spend.
- **By subscription plan**: spend bucketed by each user's current plan, with a "No active subscription" bucket for the rest — useful for checking whether a plan's price still makes sense against what its users actually cost you.

These are **vendor costs** (what you pay OpenAI/ElevenLabs/etc.), not what you charge your users — that's Pricing & Credits, a completely separate (and currently independent) number.

## Generation Engine

The retry count, per-category timeout, health-check thresholds, and cost-rate table here apply **across every provider** in that category, unless a specific provider has its own override set on the AI Providers page (a provider-level override always wins over this category-wide default). The provider health table shows which providers are currently `HEALTHY`/`DEGRADED`/`DOWN` — a `DOWN` provider is automatically skipped (not removed, just paused) until its cooldown passes.

## Render Pipeline

Shows how deep the render queue currently is and how many jobs are processing right now, plus a history of recent scene/merge jobs and any failures. The render policy here (queue concurrency, max retry attempts per scene, default negative prompt, default background music track) is a separate, render-specific policy from the Generation Engine's category-wide retry/timeout settings above.

## Pricing & Credits

Edit your subscription plans (price, monthly credit allowance, download cap) and one-time credit packages here. Changes are live within ~30 seconds, no deploy needed — a price change here doesn't retroactively affect anyone already on a plan/lot at the old terms.

## Download & Credit Rules

Controls download rate limits (how many free re-downloads/new downloads per day) and which type of credit gets spent first when a user has more than one kind (signup bonus, purchased, subscription, promotional, referral).

## Founder Dashboard

Today's numbers, composed from data every other page already has — nothing here is tracked separately. The estimate cards (Estimated Profit, Gross Margin, Editor Cost Saved, Time Saved, CLV, ARPU) combine INR revenue with USD AI vendor cost via an admin-set conversion rate, and an admin-set assumption for what a video would have cost/taken via a human editor — both editable in **Pricing & Credits → Payment Settings** (`USD_TO_INR_RATE`, `EDITOR_COST_SAVED_PER_VIDEO_INR`, `TIME_SAVED_PER_VIDEO_MINUTES`). Treat these as a gut check, not accounting.

## Command Center

Each alert reads already-existing state (provider health, the dead-letter queue, the webhook/payment log, subscription status changes) and three founder-set thresholds that all default to **disabled** rather than a guessed number: `DAILY_API_COST_ALERT_USD`, `STORAGE_BUDGET_GB`, `LOW_CREDIT_BALANCE_ALERT_THRESHOLD` — set them in the config form to turn each alert on. The Installation Checklist below the alerts answers "is this install actually production-ready" (a real provider enabled with a key for every category, OTP configured, invoice business details set) — every row here is something you already configure elsewhere in the panel; this page just summarizes it in one place.

## Payments

The **Payment provider itself** (Mock vs. Razorpay, which key, priority if you ever add a second) is configured on **AI Providers**, category PAYMENT — same place as every other vendor, deliberately not duplicated here. This page is everything *about* the payments that provider has processed: the PaymentIntent list, the webhook event log (every inbound vendor webhook, signature-valid or not, with a one-click **Retry** that re-runs the exact same dispatch logic against the stored payload — useful if a webhook failed due to a transient bug, now fixed), and refunds (admin-initiated, calls the active provider's real refund API). **Payment Settings** further down this page controls which checkout methods (card/UPI/netbanking/wallet/EMI) Razorpay Checkout offers.

## Subscriptions

Lists every subscriber with their plan, billing interval, current period, trial flag, and cancel-at-period-end state. **Cancel now** ends access immediately — distinct from the user-facing cancel button, which only stops future renewal and lets them keep what they already paid for. Use this for chargebacks/abuse, not routine cancellations.

A subscription whose period lapses without a renewal webhook landing (lost webhook, or the vendor's own retry still in flight) is moved to `PAST_DUE` by an internal sweep (`POST /api/internal/subscriptions/renew-sweep`, point a daily cron at it — same secret-gated pattern as the existing credit-expiry sweep, see `PRODUCTION_DEPLOYMENT.md`) and stays usable through **Subscription grace period (days)**. If the renewal still hasn't landed after the grace period or after **Subscription renewal retry attempts** sweep passes (whichever comes first), it's expired. Both thresholds are in Pricing & Credits → Payment Settings. If the vendor's webhook does arrive late, the subscription heals back to `ACTIVE` automatically — no admin action needed.

## Revenue

Total revenue / MRR / ARR / top plans, computed from settled `PaymentIntent` rows and `ACTIVE` subscriptions — a completely different number from Cost Management's AI vendor spend. MRR normalizes every plan onto a monthly figure regardless of its actual billing interval (a YEARLY plan's price is divided by 12, not counted in full), so it isn't artificially inflated by annual plans.

## Extending the Admin Panel

Every category in this panel was built to take a new entry without touching the surrounding architecture. The recipes below are how Milestone 13 itself added Payments/Subscriptions/Founder Dashboard/Command Center — follow the same shape for the next addition instead of starting a parallel mechanism.

**Adding a new AI/storage/payment/email provider** — add one entry to that category's `PROVIDER_CATALOGUE` array (`lib/admin/ai-providers.ts`) and one `*.provider.ts` implementing that category's interface (`lib/providers/<category>/types.ts`). It appears on `/admin/ai-providers` automatically — enable/disable, key, priority, test-connection, audit log all come for free. No new admin page, no new route.

**Adding a new admin-editable setting** — add one entry to `CONFIG_REGISTRY` (`lib/admin/config.ts`): a Zod schema, a default, a label/description, and a `category`. If that category already has a page rendering it via `<AdminConfigForm category="...">`, it appears there immediately with the right input type (the form introspects the Zod schema — enum becomes a Select, number becomes a number input, etc.). If it's a genuinely new category, render `<AdminConfigForm category="your_new_category" />` on whichever page makes sense. Never add a new environment variable for something an admin should be able to change without a redeploy — that's exactly what this registry is for.

**Adding a new admin dashboard page** — copy the existing four-layer shape: `page.tsx` (thin server wrapper) → `*-dashboard.tsx` (client component, `fetch` on mount) → `app/api/admin/*/route.ts` (`requireAdminSession()` guard, calls a lib function, wraps the result in `apiSuccess`/`apiError`) → `lib/admin/*.ts` (the actual Prisma queries, ideally with the expensive aggregation split into a pure function so it's unit-testable without a database — see `revenue.ts`'s `bucketRevenueByDay()` or `founder-dashboard.ts`'s `bucketSignupsByDay()`). Add one line to `ADMIN_NAV_ITEMS` in `app/admin/layout.tsx`. For anything that re-runs an expensive query on every page view, wrap it in `getOrSetCache()` (`lib/cache/cache.ts`) with a 30–60 second TTL, matching every other dashboard in this panel.

**Adding a new alert to Command Center** — add one entry to the `alerts` array in `lib/admin/command-center.ts`, computing its own `status`/`detail`/`actionHref` from data that already exists (or a new founder-set threshold via the recipe above) — don't invent a new tracking table for something the rest of the panel already records.

## Who can access the Admin Panel

Anyone with `User.role = "ADMIN"`. The Installation Wizard promotes your first admin account automatically; promoting additional admins today requires a direct database update (`UPDATE users SET role = 'ADMIN' WHERE id = '...'`) — there's no in-app "make this user an admin" button yet.
