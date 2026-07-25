# Beta Test Plan — Elevatex AI

A plan for a small (10–25 user) closed beta before public launch, building on Milestone 12's own scripted founder acceptance test (`PROJECT_STATUS.md`, Phase H) — that pass proved every flow works against a real server; this plan is about proving it works for real, less-predictable humans.

## Goals

1. Surface UX friction the scripted HTTP-level acceptance test can't see (it never rendered a single pixel in a real browser for a real user).
2. Exercise real vendor providers (real LLM/Image/Voice/Video/Transcription/SMS/Payment) under real network conditions — Milestone 12's pass ran entirely against Mock providers plus one deliberately-bogus real key.
3. Find concurrency/load issues a single-session scripted test structurally cannot find (two users hitting the same render queue simultaneously, etc.).

## Recruitment

- 10–25 users from the actual target segment (small business owners making marketing videos) — not internal team members who already know the product's shape.
- Mix of phone-OTP signups (the only supported auth path) across at least 2 real carriers to catch SMS-deliverability issues `MSG91_AUTH_KEY` config alone won't surface.

## What to instrument before starting

- `SENTRY_DSN` set, so beta-only errors are captured automatically rather than relying on users to report them.
- `/admin/health` and `/admin/render` (queue depth, dead-letter) checked daily during the beta window — a stuck queue or a spike in `FAILED` render jobs is the single most likely beta-breaking failure mode, given it's the newest-changed subsystem this milestone touched least directly.
- At least one real provider enabled per category (see `LAUNCH_CHECKLIST.md`) — a beta run entirely on Mock providers tests the orchestration, not the product.

## Test scenarios (assign across the cohort, not all to everyone)

1. **Cold start**: sign up, complete onboarding, create a GENERATED-flow video from a brief, render, export, download — with zero hints from the team.
2. **Talking head upload**: upload a real (not synthetic) talking-head clip of varying length (30s, 2min, 10min) — Milestone 12's own test used a 27-byte fake file; real video files will exercise the presigned-upload path's actual size/duration handling for the first time.
3. **Referral loop**: user A invites user B via the real `/credits` "Invite & Earn" flow (not a direct API call) — confirm both ends see the credit grant land in the UI, not just in the database.
4. **Purchase flow**: at least 3 users complete a real (not Mock) credit-package purchase via Razorpay, including one intentionally-failed/cancelled payment, to confirm the failure path doesn't leave a stuck `PENDING` `PaymentIntent`.
5. **Subscription lifecycle**: subscribe, use some monthly credits, cancel — confirm the UI correctly communicates "active until period end" rather than implying immediate loss of access.
6. **Abuse-adjacent behavior**: ask one or two users to intentionally hammer video creation in a short window — confirm rate limiting kicks in with a clear, non-cryptic error message, not a raw 429 with no explanation.
7. **Notifications**: confirm the bell UI's 30-second polling feels acceptably responsive for a render-complete notification in practice, not just that the API returns the row correctly.

## Bug triage during the beta

Same standard as Phase H: log every bug found, fix it, retest the fix, don't batch fixes for a "later pass." A `Notification`-style broadcast to the beta cohort when a significant fix ships keeps the group engaged rather than silently testing on a moving target.

## Exit criteria

- Zero P0 (data loss, payment double-charge, security) bugs open.
- Every P1 (a flow is broken, not just rough) bug found during the beta fixed and retested.
- At least 70% of the cohort completes at least one full create→render→download cycle without asking for help.
- `/admin/health` shows no sustained queue backlog or elevated `failedLast24h` count for the final 48 hours of the window.
