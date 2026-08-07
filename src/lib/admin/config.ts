import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getOrSetCache, invalidateCache } from "@/lib/cache/cache";
import { LLM_PROVIDER_IDS } from "@/lib/providers/llm";
import { IMAGE_PROVIDER_IDS } from "@/lib/providers/image";
import { VOICE_PROVIDER_IDS } from "@/lib/providers/voice";
import { VIDEO_PROVIDER_IDS } from "@/lib/providers/video";

// ============================================================================
// Admin-editable system configuration. Every key here is a row in
// SystemConfig (DB), not an env var — changing one is a write from the admin
// panel (/admin/*), takes effect within CONFIG_CACHE_TTL_MS, and needs no
// redeploy. This is the single place "configurable without changing code"
// actually means something concrete: provider selection, pricing rules,
// credit rules, and download rules all read through here.
// ============================================================================

// Priority-ordered provider lists for the 4 Generation Engine categories
// (src/lib/generation/). The engine tries index 0 first; on exhausted
// retries (GENERATION_RETRY_MAX_ATTEMPTS) or a health-cooldown skip, it
// fails over to the next id in the array. A single-element array behaves
// exactly like the old single-select PROVIDER_LLM-style config it replaces.
export const CONFIG_REGISTRY = {
  PROVIDER_LLM_PRIORITY: {
    // Enum values sourced from LLM_PROVIDER_IDS (lib/providers/llm/index.ts)
    // — the same constant the factory's switch statement is keyed on, so a
    // new adapter only ever needs updating in one place.
    schema: z.array(z.enum(LLM_PROVIDER_IDS)).min(1),
    default: ["mock"] as const,
    label: "LLM Provider priority",
    description:
      "Generates video scripts from the prompt engine's output. Tried in order; falls over to the next on failure.",
    category: "providers",
  },
  PROVIDER_IMAGE_PRIORITY: {
    schema: z.array(z.enum(IMAGE_PROVIDER_IDS)).min(1),
    default: ["mock"] as const,
    label: "Image Generation Provider priority",
    description: "Generates video thumbnails. Tried in order; falls over to the next on failure.",
    category: "providers",
  },
  PROVIDER_VOICE_PRIORITY: {
    schema: z.array(z.enum(VOICE_PROVIDER_IDS)).min(1),
    default: ["mock"] as const,
    label: "Voice Generation Provider priority",
    description:
      "Generates voiceover audio for templates with includeVoiceover enabled. Tried in order; falls over to the next on failure.",
    category: "providers",
  },
  PROVIDER_VIDEO_PRIORITY: {
    schema: z.array(z.enum(VIDEO_PROVIDER_IDS)).min(1),
    default: ["mock"] as const,
    label: "Video Generation Provider priority",
    description: "Renders the master video asset. Tried in order; falls over to the next on failure.",
    category: "providers",
  },
  PROVIDER_STORAGE: {
    schema: z.enum(["mock", "s3"]),
    default: "mock" as const,
    label: "Storage Provider",
    description: "Hosts rendered assets and mints signed download URLs.",
    category: "providers",
  },
  PROVIDER_PAYMENT: {
    schema: z.enum(["mock", "razorpay"]),
    default: "mock" as const,
    label: "Payment Provider",
    description: "Processes credit package purchases and subscriptions.",
    category: "providers",
  },
  // Milestone 13 — global allow-list, not per-plan/per-package (a deliberate
  // scope cut; per-plan overrides could reuse this same z.record() pattern
  // later with zero architecture change if ever needed). Default preserves
  // today's behavior exactly: Razorpay's hosted checkout shows every method
  // it supports when nothing restricts it.
  PAYMENT_METHODS_ENABLED: {
    schema: z.array(z.enum(["card", "upi", "netbanking", "wallet", "emi"])).min(1),
    default: ["card", "upi", "netbanking", "wallet", "emi"] as const,
    label: "Enabled payment methods",
    description: "Which payment methods Razorpay Checkout offers at checkout.",
    category: "payment_settings",
  },

  GENERATION_RETRY_MAX_ATTEMPTS: {
    schema: z.number().int().min(1).max(5),
    default: 2,
    label: "Max attempts per provider",
    description: "How many times the Generation Engine retries a single provider before failing over to the next one.",
    category: "generation_policy",
  },
  // Temporary debug override (2026-08-04) — IMAGE-only, so a 30s (now 120s)
  // per-attempt timeout can't compound into a 2x wait while investigating
  // the real provider-response latency. GENERATION_RETRY_MAX_ATTEMPTS above
  // stays untouched and still governs LLM/VOICE/VIDEO exactly as before —
  // see loadPolicy() in lib/generation/engine.ts, which only reads this key
  // for category === "IMAGE".
  GENERATION_RETRY_MAX_ATTEMPTS_IMAGE: {
    schema: z.number().int().min(1).max(5),
    default: 1,
    label: "Max attempts per provider (IMAGE only, temporary debug override)",
    description: "Temporary: how many times the Generation Engine retries a single IMAGE provider before failing over to the next one. Does not affect LLM/VOICE/VIDEO, which still use 'Max attempts per provider' above.",
    category: "generation_policy",
  },
  GENERATION_RETRY_BACKOFF_MS: {
    schema: z.number().int().min(0).max(10_000),
    default: 500,
    label: "Retry backoff (ms)",
    description: "Base delay between retries against the same provider; multiplied by the attempt number.",
    category: "generation_policy",
  },
  GENERATION_TIMEOUT_MS_LLM: {
    schema: z.number().int().min(1000).max(600_000),
    // Real bug, confirmed live (2026-08-03) — the Universal Prompt pipeline's
    // structured-JSON LLM calls (creative_direction/prompt_engineering) hit
    // this exact 20s ceiling on BOTH configured providers (gemini AND
    // openai, 2 attempts each) on real, non-outage attempts, throwing
    // AllProvidersFailedError and surfacing as "Couldn't complete this AI
    // request right now" on /create/image's Enhance step — the same class
    // of "coded default too short for this app's real-world latency" issue
    // GENERATION_TIMEOUT_MS_IMAGE below was already raised for (30s default,
    // admin-overridden to 90s). Raised 3x, matching that precedent; still
    // fully admin-adjustable via /admin/generation.
    default: 60_000,
    label: "LLM timeout (ms)",
    description: "How long the engine waits for a script-generation call before treating it as failed.",
    category: "generation_policy",
  },
  GENERATION_TIMEOUT_MS_IMAGE: {
    schema: z.number().int().min(1000).max(600_000),
    // Real, first-party evidence (2026-08-03) — live gemini_images calls run
    // earlier this same investigation completed successfully in 47s/52s/79s,
    // all well past 30s under completely normal (non-error) conditions.
    // Raised to leave real margin above the slowest of those.
    default: 120_000,
    label: "Image timeout (ms)",
    description: "How long the engine waits for an image-generation call before treating it as failed.",
    category: "generation_policy",
  },
  GENERATION_TIMEOUT_MS_VOICE: {
    schema: z.number().int().min(1000).max(600_000),
    default: 30_000,
    label: "Voice timeout (ms)",
    description: "How long the engine waits for a voiceover-generation call before treating it as failed.",
    category: "generation_policy",
  },
  GENERATION_TIMEOUT_MS_VIDEO: {
    schema: z.number().int().min(1000).max(600_000),
    default: 180_000,
    label: "Video timeout (ms)",
    description: "How long the engine waits for a video-render call before treating it as failed.",
    category: "generation_policy",
  },
  GENERATION_TIMEOUT_MS_TRANSCRIPTION: {
    schema: z.number().int().min(1000).max(600_000),
    default: 300_000,
    label: "Transcription timeout (ms)",
    description: "How long the engine waits for a speech-to-text call before treating it as failed — long videos take a while.",
    category: "generation_policy",
  },
  GENERATION_TIMEOUT_MS_VIDEO_UNDERSTANDING: {
    schema: z.number().int().min(1000).max(600_000),
    default: 300_000,
    label: "Video understanding timeout (ms)",
    description: "How long the engine waits for a Gemini video-understanding call (file upload + processing + analysis) before treating it as failed. Phase 12 Module 3.",
    category: "generation_policy",
  },
  GENERATION_TIMEOUT_MS_REASONING: {
    schema: z.number().int().min(1000).max(600_000),
    default: 60_000,
    label: "Reasoning (timeline planning) timeout (ms)",
    description: "How long the engine waits for a single GPT-5.x captions/zoom planning call before treating it as failed — text-only, no large upload, so a much shorter ceiling than transcription/video understanding. Phase 12 Module 4.",
    category: "generation_policy",
  },
  GENERATION_HEALTH_FAILURE_THRESHOLD: {
    schema: z.number().int().min(1).max(20),
    default: 3,
    label: "Health failure threshold",
    description: "Consecutive failures (after retries) before a provider is marked DOWN and skipped.",
    category: "generation_policy",
  },
  GENERATION_HEALTH_COOLDOWN_MS: {
    schema: z.number().int().min(1000).max(3_600_000),
    default: 300_000,
    label: "Health cooldown (ms)",
    description: "How long a DOWN provider is skipped before the engine gives it one more chance.",
    category: "generation_policy",
  },
  GENERATION_COST_RATES: {
    schema: z.record(
      z.string(),
      z.object({
        unit: z.enum(["PER_CALL", "PER_1K_TOKENS", "PER_1K_CHARS", "PER_SECOND", "PER_IMAGE"]),
        rate: z.number().min(0),
      })
    ),
    default: {
      mock: { unit: "PER_CALL", rate: 0 },
      openai: { unit: "PER_1K_TOKENS", rate: 0.15 },
      gemini: { unit: "PER_1K_TOKENS", rate: 0.075 },
      self_hosted: { unit: "PER_CALL", rate: 0 },
      openai_images: { unit: "PER_IMAGE", rate: 0.04 },
      flux: { unit: "PER_IMAGE", rate: 0.03 },
      ideogram: { unit: "PER_IMAGE", rate: 0.08 },
      elevenlabs: { unit: "PER_1K_CHARS", rate: 0.18 },
      replicate: { unit: "PER_SECOND", rate: 0.05 },
      veo: { unit: "PER_SECOND", rate: 0.35 },
      kling: { unit: "PER_SECOND", rate: 0.25 },
      hailuo: { unit: "PER_SECOND", rate: 0.2 },
      runway: { unit: "PER_SECOND", rate: 0.3 },
      openai_whisper: { unit: "PER_SECOND", rate: 0.0001 },
      // Phase 12 Module 10 — filled in for the AI Auto-Editor cost preview.
      // These two providers (TRANSCRIPTION's "assemblyai", REASONING's
      // "gpt5") predate this table and were never added, so every
      // transcription/reasoning call has been silently costing $0 in every
      // cost-tracking view since they shipped — not because no cost
      // occurred, but because computeCost() has nothing to look up for an
      // unmapped provider id. Rates below are estimates in the same
      // per-vendor ballpark as their nearest neighbor above (assemblyai
      // vs. openai_whisper for transcription; gpt5 vs. openai for
      // premium-tier reasoning) — admin-adjustable like every other row,
      // not a claim of exact vendor-invoice precision.
      assemblyai: { unit: "PER_SECOND", rate: 0.00025 },
      gpt5: { unit: "PER_1K_TOKENS", rate: 0.2 },
      // Fixed 2026-07-23 — third occurrence of this exact bug class (see
      // assemblyai/gpt5 above, Module 10): "gemini_images" was missing
      // here, so every real gemini-3-pro-image ("Nano Banana Pro") call
      // was silently tracked as $0 cost. Confirmed live via the B1
      // relevance-fallback feature's own verification (2026-07-23) — real
      // generation calls fired, computeCost() had nothing to look up.
      // $0.134/image is Google's own published rate for 1K/2K output
      // (ai.google.dev/gemini-api/docs/pricing, standard non-batch tier —
      // 1120 output tokens at $120/1M) — this app's own adapter
      // (gemini-images.provider.ts) always requests image_size: "1K", so
      // this is the correct tier, not an estimate like assemblyai/gpt5
      // above.
      gemini_images: { unit: "PER_IMAGE", rate: 0.134 },
    } as const,
    label: "Generation cost rates (USD)",
    description:
      "Per-provider vendor cost used for cost tracking/analytics — not user-facing pricing. Keyed by provider id.",
    category: "generation_policy",
  },

  // Milestone 11 — Talking Head pipeline. Independent of subscription plan
  // type per the user's explicit choice: a single global switch, not a
  // plan-tier check, gates the asset selector's fallback to AI video
  // generation (the most expensive tier of the Part 5/11 waterfall).
  TALKING_HEAD_AI_VIDEO_GENERATION_ENABLED: {
    schema: z.boolean(),
    default: false,
    label: "Enable AI video generation for Talking Head editor",
    description:
      "Premium gate for the Talking Head pipeline's asset selector — when off, scenes that would otherwise fall back to AI video generation use a stock/image substitute instead.",
    category: "generation_policy",
  },

  // Phase 7 — GPT Creative Director main pipeline wiring.
  // When enabled, the enhance-prompt route runs the GPT-powered Creative
  // Director (one extra LLM call) and passes its GPTCampaignDirection into
  // buildPromptSpecification() so the Phase 13 translator uses the Phase 5.5
  // optimized narrative (buildNarrativePrompt) as the final provider prompt.
  // Off by default — turn on after validating output quality in the Prompt Lab.
  GPT_CREATIVE_DIRECTOR_ENABLED: {
    schema: z.boolean(),
    default: false,
    label: "GPT Creative Director",
    description:
      "When enabled, the GPT Creative Director runs on every image generation request and its optimised narrative (Phase 5.5 buildNarrativePrompt, ~840 tokens) replaces the section-based Phase 13 provider prompt. Adds one LLM call per request. Validate quality in /admin/prompt-lab before enabling.",
    category: "generation_policy",
  },

  // Phase 10.4F — Single Pipeline Architecture.
  // When this flag is on, ONLY the modern AI OS path runs (Phases 7–13):
  //   - No legacy LLM calls (Creative Brief + Universal Prompt) are made.
  //   - The Phase 13 translated prompt is used as the final enhancedPrompt.
  // When this flag is off, ONLY the legacy path runs (2 LLM calls, Expander,
  // Adapter): Phases 11–13 are skipped entirely.
  // Before Phase 10.4F both paths always ran in parallel and the flag only
  // selected which result to use — that design wasted one full LLM round-trip
  // on every request. Enable this flag ONLY after validating Phase 13 output
  // quality in /admin/prompt-lab.
  PROVIDER_PROMPT_ENABLED: {
    schema: z.boolean(),
    default: false,
    label: "Phase 13 Provider Prompt (AI-OS pipeline)",
    description:
      "Switches to the modern single-pipeline path: Phases 7–13 run exclusively, no legacy LLM calls. When off, only the legacy path runs (Creative Brief + Universal Prompt LLMs). Enable after validating Phase 13 output quality in /admin/prompt-lab.",
    category: "generation_policy",
  },

  // Phase 10.6F — Translator Bypass Experiment (temporary, for A/B measurement
  // only). Only takes effect when PROVIDER_PROMPT_ENABLED is also true — it
  // gates the one step immediately before the provider API call, nothing
  // upstream. Default true preserves today's behaviour exactly (Provider
  // Translator runs, same as before this flag existed) on every environment
  // that hasn't explicitly touched this config. When set false, the route
  // uses prompt-builder-minimal's buildMinimalPrompt() instead — a
  // non-editorial formatter over the same OptimizedPromptSpecification, with
  // no section labels, reordering, quality sentence, or negative-prompt list
  // added. Intended to be reverted to true (or removed) once the comparison
  // this flag exists for is complete.
  ENABLE_PROVIDER_TRANSLATOR: {
    schema: z.boolean(),
    default: true,
    label: "Provider Prompt Translator (Phase 13)",
    description:
      "When on (default), the Phase 13 Provider Translator formats the final prompt as today. When off, a minimal, non-rewriting formatter is used instead — for the Phase 10.6F translator-bypass comparison only. Has no effect unless the Phase 13 Provider Prompt pipeline itself is also enabled.",
    category: "generation_policy",
  },

  // Milestone 15 — Universal Creative Workflow's automatic brand-logo
  // compositing (lib/image/composite-logo.ts). Admin-tunable defaults
  // rather than a hardcoded corner/size — same posture as every other
  // generation-policy knob in this category.
  CREATIVE_LOGO_POSITION: {
    schema: z.enum(["bottom-right", "bottom-left", "top-right", "top-left", "bottom-center"]),
    default: "bottom-right" as const,
    label: "Brand logo placement",
    description: "Default corner a generated creative's uploaded brand logo is composited onto.",
    category: "generation_policy",
  },
  CREATIVE_LOGO_SCALE_PERCENT: {
    schema: z.number().min(5).max(25),
    default: 14,
    label: "Brand logo size (% of canvas width)",
    description: "How large the composited brand logo is, as a percentage of the generated image's width.",
    category: "generation_policy",
  },

  WATERMARK_TEXT: {
    schema: z.string().min(1).max(40),
    default: "Elevatex AI",
    label: "Preview watermark text",
    description: "Burned into every preview stream (free, unlimited tier).",
    category: "download_rules",
  },
  PREVIEW_QUALITY: {
    schema: z.enum(["480p", "720p"]),
    default: "720p" as const,
    label: "Preview quality",
    description: "Resolution cap for the free, watermarked, streaming-only preview.",
    category: "download_rules",
  },
  FINAL_QUALITY: {
    schema: z.enum(["1080p", "4K"]),
    default: "1080p" as const,
    label: "Final download quality",
    description: "Resolution for the paid, watermark-free, downloadable master.",
    category: "download_rules",
  },
  DOWNLOAD_RATE_LIMIT_PER_DAY: {
    schema: z.number().int().min(1).max(10000),
    default: 50,
    label: "Max downloads per user per day",
    description: "Applies regardless of entitlement method (credit/subscription/purchase).",
    category: "download_rules",
  },

  RENDER_QUEUE_CONCURRENCY: {
    schema: z.number().int().min(1).max(20),
    default: 3,
    label: "Render queue concurrency",
    description: "Max scene/merge render jobs the worker processes in parallel at once.",
    category: "render_policy",
  },

  // AI Film bulk-approve (2026-07-23) — "Approve storyboard & generate all
  // scenes" fires one real Veo call per scene; unlike RENDER_QUEUE_CONCURRENCY
  // above (a persistent background worker with its own retry/backoff),
  // this runs as one interactive, in-request bounded-concurrency batch
  // (scenes/generate-all/route.ts), so it gets its own, more conservative
  // default — each Veo call is a genuinely long-running vendor operation
  // (predictLongRunning + poll), and firing all of a film's scenes at once
  // risks real per-account rate limits/cost bursts.
  FILM_BULK_GENERATE_CONCURRENCY: {
    schema: z.number().int().min(1).max(10),
    default: 2,
    label: "Film bulk-generate concurrency",
    description: "Max scenes generated in parallel when a founder clicks \"Approve storyboard & generate all scenes\" on an AI Film project.",
    category: "render_policy",
  },
  RENDER_MAX_ATTEMPTS: {
    schema: z.number().int().min(1).max(10),
    default: 3,
    label: "Max render attempts per scene/merge job",
    description: "How many times a failed scene render or merge job retries before being marked FAILED.",
    category: "render_policy",
  },
  DEFAULT_NEGATIVE_PROMPT: {
    schema: z.string().max(500),
    default: "blurry, low quality, distorted, extra limbs, watermark, text artifacts",
    label: "Default negative prompt",
    description: "Applied to every new scene's image/video generation unless overridden. Some providers ignore it.",
    category: "render_policy",
  },
  DEFAULT_BACKGROUND_MUSIC_URL: {
    schema: z.string().max(500),
    default: "",
    label: "Default background music URL",
    description: "Static track applied to every new scene. A static asset reference, not AI-generated. Empty = none.",
    category: "render_policy",
  },

  // Milestone 8 — Scene Editor's voice/background-music pickers read these
  // lists; both are plain content libraries (not pricing/business rules), so
  // a `json` array is the right shape rather than a per-entry config key.
  AVAILABLE_VOICES: {
    schema: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        gender: z.enum(["MALE", "FEMALE", "NEUTRAL"]),
      })
    ),
    default: [
      { id: "default", label: "Provider default", gender: "NEUTRAL" },
      { id: "warm_female", label: "Warm — Female", gender: "FEMALE" },
      { id: "confident_male", label: "Confident — Male", gender: "MALE" },
    ] as const,
    label: "Available voices",
    description:
      "Voice options offered in the Scene Editor's voice picker. `id` is threaded into VoiceGenerateRequest.voiceId — real adapters (e.g. ElevenLabs) map it to an actual vendor voice id; Mock ignores it.",
    category: "studio_content",
  },
  BACKGROUND_MUSIC_LIBRARY: {
    schema: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        url: z.string().min(1),
      })
    ),
    default: [] as const,
    label: "Background music library",
    description:
      "Tracks offered in the Scene Editor's background-music picker — static asset URLs, not AI-generated.",
    category: "studio_content",
  },
  // Milestone 9 — Media Library's "Stock assets" tab and the Video Editor's
  // Sticker layer both read this same curated list (filtered by `kind`).
  STOCK_ASSET_LIBRARY: {
    schema: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        kind: z.enum(["IMAGE", "VIDEO", "STICKER"]),
        url: z.string().min(1),
      })
    ),
    default: [] as const,
    label: "Stock asset library",
    description: "Stock images/videos/stickers offered in the Media Library and Sticker layer — static URLs, not AI-generated.",
    category: "studio_content",
  },
  // Video Editor's Text Editor font picker.
  AVAILABLE_FONTS: {
    schema: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        family: z.string().min(1),
      })
    ),
    default: [
      { id: "inter", label: "Inter", family: "Inter, sans-serif" },
      { id: "poppins", label: "Poppins", family: "Poppins, sans-serif" },
      { id: "playfair", label: "Playfair Display", family: "'Playfair Display', serif" },
    ] as const,
    label: "Available fonts",
    description: "Fonts offered in the Video Editor's Text Editor font picker.",
    category: "studio_content",
  },
  // Video Editor's Text Editor "Templates" — curated style presets, not a
  // user-authoring UI (matches the AVAILABLE_VOICES/BACKGROUND_MUSIC_LIBRARY
  // pattern: an admin-curated content list, not business/pricing config).
  TEXT_STYLE_PRESETS: {
    schema: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        style: z.record(z.string(), z.any()),
      })
    ),
    default: [
      {
        id: "bold_white",
        label: "Bold White",
        style: { fontFamily: "inter", fontSize: 48, color: "#FFFFFF", strokeColor: "#000000", strokeWidth: 2, animation: "POP" },
      },
      {
        id: "subtle_caption",
        label: "Subtle Caption",
        style: { fontFamily: "inter", fontSize: 28, color: "#FFFFFF", shadowColor: "#000000", shadowBlur: 4, animation: "FADE_IN" },
      },
    ] as const,
    label: "Text style templates",
    description: "Pre-built text style templates (font/color/stroke/shadow/animation) offered in the Text Editor.",
    category: "studio_content",
  },
  // Caption Editor's "Style presets".
  CAPTION_STYLE_PRESETS: {
    schema: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        style: z.record(z.string(), z.any()),
      })
    ),
    default: [
      {
        id: "karaoke_yellow",
        label: "Karaoke Yellow",
        style: { fontFamily: "inter", fontSize: 32, color: "#FFFFFF", highlightColor: "#FFD60A" },
      },
      {
        id: "minimal_white",
        label: "Minimal White",
        style: { fontFamily: "inter", fontSize: 28, color: "#FFFFFF" },
      },
    ] as const,
    label: "Caption style presets",
    description: "Pre-built caption styles offered in the Caption Editor.",
    category: "studio_content",
  },
  // Dashboard redesign — the "Inspiration" section (hooks/winning ads/
  // layouts/best-performing creatives) has no real performance-tracking
  // data anywhere in the system, so unlike Trending (which uses real usage
  // counts), this is admin-curated content, same pattern as
  // BACKGROUND_MUSIC_LIBRARY/STOCK_ASSET_LIBRARY above. `href` is optional
  // and typically deep-links into a create flow with a pre-filled idea.
  INSPIRATION_LIBRARY: {
    schema: z.array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        description: z.string().optional(),
        imageUrl: z.string().min(1),
        category: z.enum(["HOOK", "WINNING_AD", "LAYOUT", "CREATIVE", "TRENDING_COLOR", "TOP_TYPOGRAPHY"]),
        href: z.string().optional(),
      })
    ),
    default: [] as const,
    label: "Inspiration library",
    description:
      "Curated hooks, winning ads, layouts, creatives, trending colors, and typography shown in the Dashboard's Inspiration section.",
    category: "dashboard_content",
  },

  SIGNUP_BONUS_CREDITS: {
    schema: z.number().int().min(0).max(1000),
    default: 5,
    label: "Signup bonus credits",
    description: "Granted once per new account via the Credit Engine (type SIGNUP_BONUS).",
    category: "credit_rules",
  },
  CREDIT_CONSUMPTION_ORDER: {
    schema: z.enum(["EXPIRING_FIRST", "FREE_FIRST", "PURCHASED_FIRST"]),
    default: "EXPIRING_FIRST" as const,
    label: "Credit consumption order",
    description:
      "Which credit lots the Credit Engine draws down first when a download is paid for with credits.",
    category: "credit_rules",
  },
  PROMOTIONAL_CREDIT_EXPIRY_DAYS: {
    schema: z.number().int().min(1).max(3650),
    default: 30,
    label: "Promotional credit expiry (days)",
    description: "Default lifetime of credits granted with type PROMOTIONAL.",
    category: "credit_rules",
  },
  REFERRAL_CREDIT_EXPIRY_DAYS: {
    schema: z.number().int().min(1).max(3650),
    default: 90,
    label: "Referral credit expiry (days)",
    description: "Default lifetime of credits granted with type REFERRAL.",
    category: "credit_rules",
  },
  // Milestone 11 Part 12 — Talking Head pipeline. Upload/transcription/
  // context analysis/visual planning are free (the confirmed boundary);
  // these are the only credit-bearing actions, charged atomically at the
  // moment each one actually runs — never upfront, and never for a scene
  // that ends up reusing an existing/stock/brand asset instead.
  TALKING_HEAD_CREDIT_COSTS: {
    schema: z.object({
      aiImageCredits: z.number().min(0),
      aiVideoCreditsPerSecond: z.number().min(0),
      exportCredits: z.number().min(0),
    }),
    default: { aiImageCredits: 1, aiVideoCreditsPerSecond: 2, exportCredits: 2 } as const,
    label: "Talking Head credit costs",
    description:
      "Credits charged for the Talking Head pipeline's actual AI generation (per AI overlay image / per second of AI overlay video) and for exporting the final video. Reusing an existing/brand/uploaded/stock asset is always free.",
    category: "credit_rules",
  },
  // AI Video Phase 1 — one row per gated video action, extensible for Phase
  // 2/3/4 (Veo Lite/Fast/Pro, Kling, Seedance, UGC Ad Mode) without a schema
  // migration, same "admin-editable record, no fixed key set" pattern
  // GENERATION_COST_RATES already uses. Each action's credits/minimumTier
  // are priced against real vendor cost with margin — see the AI Video
  // architecture plan for the worked math. minimumTier is checked by
  // lib/credits/video-actions.ts's checkVideoActionAccess() against the
  // user's active PricingPlan.tierLevel before generation starts.
  VIDEO_ACTION_CREDIT_COSTS: {
    schema: z.record(
      z.string(),
      z.object({
        credits: z.number().int().min(0),
        // NO_PLAN (2026-08-04) — a real, admin-selectable rank-0 tier
        // (see PRICING_TIER_RANK in lib/credits/video-actions.ts): an
        // action set to NO_PLAN is usable by every signed-in user
        // regardless of subscription status, with credits still charged
        // normally if `credits` above is nonzero. Existing actions' own
        // default minimumTier values below are untouched.
        minimumTier: z.enum(["NO_PLAN", "BASIC", "PRO", "PREMIUM"]),
      })
    ),
    default: {
      animated_poster: { credits: 2, minimumTier: "BASIC" },
      // AI Video Phase 2 — 8s Veo 3.1 LITE clip (veo.provider.ts's
      // DEFAULT_MODEL, restored as the default 2026-07-11 after a real cost
      // comparison against standard Veo — see veo_standard below), confirmed
      // real cost ~₹53 (1080p, $0.08/sec incl. audio) x 2.5 margin against
      // the ₹6.66/credit floor: 53 x 2.5 / 6.66 ≈ 20. Lite is the cheap
      // tier by design, fitting the ₹300-500 target user budget — this is
      // the one every Basic-tier user actually gets charged.
      veo_lite: { credits: 20, minimumTier: "BASIC" },
      // Standard Veo 3.1 (5-8x Lite's real per-second cost, confirmed live
      // 2026-07-11 — the founder's own Google Cloud prepaid balance drained
      // fast running verification calls against it) — a Premium-only option
      // by deliberate decision, NOT the default, because at Lite's ₹300-500
      // target budget a multi-scene ad on standard Veo loses money. Same
      // 2.5x margin math: ~₹266 real cost x 2.5 / 6.66 ≈ 100. No caller
      // requests this model yet (DEFAULT_MODEL is Lite; standard is only
      // reachable via an explicit provider model override) — this entry
      // exists so the pricing is ready the day a Premium quality-selector
      // actually calls it, not a currently-reachable action.
      veo_standard: { credits: 100, minimumTier: "PREMIUM" },
      // AI Video Phase 3 — a Pro+ gate on the multi-scene feature ITSELF,
      // checked once before the scene loop starts. Deliberately 0 credits:
      // real charging is 4x veo_lite's own 20-credit charge-after-success,
      // one per scene as it succeeds — this entry only stops a Basic-tier
      // user from reaching the premium feature by calling veo_lite in a
      // loop themselves. See lib/creative/veo-multiscene-video.ts.
      veo_multiscene_ad: { credits: 0, minimumTier: "PRO" },
      // AI Film — a structural placeholder, not real pricing. Premium-tier
      // gate matches the roadmap doc's own framing ("₹1,000-3,000+, Film
      // tier"). Shared by 3 real but comparatively cheap LLM/image calls —
      // storyboard generation, AI character variations, and character
      // sheets (film/[id]/storyboard, .../characters/[characterId]/
      // {variations,sheet} routes) — real per-call cost isn't known until a
      // real method/pricing pass is chosen for these specifically. Update
      // this once that pricing pass happens; do NOT reuse this key for
      // per-scene video generation (see film_scene below — split out
      // 2026-07-19 specifically because sharing one key here would have
      // made a cheap text/image call cost the same as a real $4.20 video
      // render the moment film_scene's real cost was priced).
      film: { credits: 0, minimumTier: "PREMIUM" },
      // AI Film — per-scene VIDEO render, split out from the generic `film`
      // key above (2026-07-19) specifically so pricing this doesn't also
      // silently reprice storyboard/variations/sheet generation, which
      // share `film` and are real but much cheaper LLM/image calls, not
      // real Veo renders. Real cost confirmed live: 5/5 successful
      // scene_render calls on a real Film project all cost exactly $4.20
      // (12s clip, veo-3.1-lite-generate-preview) — DB-verified via
      // GenerationLog, not assumed. Same 2.5x margin / ₹6.66-per-credit-
      // floor math as veo_lite/veo_standard above: $4.20 x ₹83/USD =
      // ₹348.60; x 2.5 = ₹871.50; / 6.66 ≈ 130.86 → 131.
      film_scene: { credits: 131, minimumTier: "PREMIUM" },
      // Phase 12 AI Auto-Editor (2026-07-19) — real multi-vendor spend
      // (transcription + video understanding + reasoning + b-roll
      // generation) with zero credit gating: the job pipeline computes and
      // shows the user real per-run USD cost (AICostSummary) but never
      // charged for it. Unlike the fixed-price actions above, real total
      // cost genuinely varies per job (video length, which providers ran),
      // so `credits` here is NOT the real charge — it's only a precheck
      // floor (an obviously-empty balance is rejected before the job even
      // queues, i.e. before any vendor call fires), grounded in real
      // observed job costs (21 real completed jobs sampled: totalUsd
      // $0.48-$0.71, none exercised video-understanding/broll-generation
      // yet). The REAL charge is computed dynamically after the job
      // completes, from its own actual cost.totalUsd, via
      // convertUsdToCredits() (lib/credits/video-actions.ts) — same 2.5x/
      // ₹6.66 formula, applied to a real number instead of a fixed guess.
      // minimumTier deliberately left at BASIC (the least restrictive real
      // tier) rather than inventing a new tier requirement that was never
      // part of this feature's design — this exists to gate credits, not
      // to newly paywall the feature by subscription tier.
      ai_auto_edit: { credits: 10, minimumTier: "BASIC" },
      // FILM storyboard preview images (2026-07-24) — one cheap real image
      // per scene (1-2 scenes at the current 10/20s cap), generated at
      // storyboard-review time so the user can see roughly what each scene
      // will look like before committing to expensive video generation.
      // Priced against gemini_images' real $0.134/image rate (the more
      // expensive of the 2 real IMAGE providers, priced conservatively
      // rather than assuming the cheaper one is always used) — same 2.5x
      // margin / ₹6.66-per-credit-floor formula as every other fixed-price
      // action here: $0.134 × ₹83/USD × 2.5 / 6.66 ≈ 4.17 → 5. Same
      // PREMIUM gate as every other FILM action (film, film_scene).
      film_storyboard_preview: { credits: 5, minimumTier: "PREMIUM" },
    } as const,
    label: "Video action credit costs",
    description:
      "Credits charged per AI video action (Animated Poster, and future Veo/Kling/Seedance/UGC actions), plus the minimum subscription tier required to access each one. Priced with margin against real vendor cost — see the AI Video plan.",
    category: "credit_rules",
  },

  // User-facing video-provider selector (2026-07-24) — optional PER-
  // PROVIDER credit cost override, keyed by ProviderConfig.providerId (e.g.
  // "veo", "seedance2"), layered on top of VIDEO_ACTION_CREDIT_COSTS above.
  // Empty by default: every provider charges its flow's normal fixed action
  // cost (veo_lite/film_scene/a template's own creditCost) until an admin
  // explicitly sets a different number here for a specific provider — this
  // never changes existing pricing on its own. Only consulted when a user
  // explicitly picks a provider (resolveVideoActionCredits(), lib/credits/
  // video-actions.ts) — the system's own default auto-selection always uses
  // the flat action cost, unaffected by this table.
  VIDEO_PROVIDER_CREDIT_COSTS: {
    schema: z.record(z.string(), z.number().int().min(0)),
    default: {} as const,
    label: "Video provider credit cost overrides",
    description:
      "Optional per-provider credit cost override for the user-facing video provider selector (e.g. charge Seedance differently from Veo). A provider not listed here charges its flow's normal cost from Video actions above.",
    category: "credit_rules",
  },

  // Milestone 12 — generalizes the OTP route's existing per-phone/per-IP
  // rate-limit pattern (src/app/api/auth/otp/send) to every other
  // user-triggered, potentially-costly action. lib/security/rate-limit.ts
  // reads this; keyed by a short action name rather than a route path so
  // one entry can cover several routes that share a limit (e.g. all AI
  // Marketing Assistant actions).
  RATE_LIMITS: {
    schema: z.record(
      z.string(),
      z.object({
        limit: z.number().int().min(1),
        windowSeconds: z.number().int().min(1),
      })
    ),
    default: {
      video_create: { limit: 20, windowSeconds: 3600 },
      creative_create: { limit: 20, windowSeconds: 3600 },
      asset_upload: { limit: 40, windowSeconds: 3600 },
      editor_asset_upload: { limit: 40, windowSeconds: 3600 },
      ai_assistant: { limit: 60, windowSeconds: 3600 },
      export_create: { limit: 20, windowSeconds: 3600 },
      contact_form: { limit: 5, windowSeconds: 3600 },
    } as const,
    label: "Rate limits",
    description:
      "Per-user request limits for costly or abusable actions, keyed by action name. Applies on top of (not instead of) credit charges.",
    category: "security",
  },

  // Milestone 12 — sequential GST-ready invoice numbering + the business
  // details printed on every generated invoice. Deliberately optional: an
  // invoice still generates with empty fields shown as "Not provided"
  // rather than blocking the payment flow on an admin filling this in.
  BUSINESS_TAX_DETAILS: {
    schema: z.object({
      legalName: z.string().max(200),
      gstin: z.string().max(20),
      address: z.string().max(500),
      stateCode: z.string().max(10),
    }),
    default: { legalName: "", gstin: "", address: "", stateCode: "" } as const,
    label: "Business tax details",
    description: "Printed on every generated invoice. Leave blank fields empty if not yet registered — invoices render gracefully either way.",
    category: "billing",
  },
  GST_RATE_PERCENT: {
    schema: z.number().min(0).max(50),
    default: 18,
    label: "GST rate (%)",
    description: "Applied to every generated invoice's subtotal. India's standard digital-services GST rate is 18% — change if your registration differs.",
    category: "billing",
  },

  // Milestone 13 — Founder Dashboard's "Estimated Profit"/"Editor Cost
  // Saved"/"Time Saved" cards combine INR revenue with USD AI vendor cost and
  // make a founder-defined assumption about outsourcing cost — both are
  // explicitly approximate (documented as such in the dashboard UI), but the
  // assumption itself must be admin-editable rather than hardcoded so the
  // founder can correct it without a code change.
  USD_TO_INR_RATE: {
    schema: z.number().positive(),
    default: 83,
    label: "USD → INR conversion rate",
    description: "Used only to combine AI vendor cost (billed in USD) with INR revenue on the Founder Dashboard's profit estimate. Update if the real rate has moved meaningfully.",
    category: "billing",
  },
  EDITOR_COST_SAVED_PER_VIDEO_INR: {
    schema: z.number().min(0),
    default: 500,
    label: "Estimated editor cost saved per video (INR)",
    description: "Founder Dashboard heuristic: what a freelance editor/agency would have charged per video, used to estimate 'cost saved' by generating it with AI instead. An assumption, not measured spend.",
    category: "billing",
  },
  TIME_SAVED_PER_VIDEO_MINUTES: {
    schema: z.number().min(0),
    default: 45,
    label: "Estimated time saved per video (minutes)",
    description: "Founder Dashboard heuristic: how long manual editing would have taken per video, used to estimate total time saved. An assumption, not measured.",
    category: "billing",
  },
  SUBSCRIPTION_GRACE_PERIOD_DAYS: {
    schema: z.number().int().min(0),
    default: 3,
    label: "Subscription grace period (days)",
    description: "How many days a subscription stays PAST_DUE (still usable) after a renewal charge fails, before it's expired by the renewal sweep.",
    category: "billing",
  },
  SUBSCRIPTION_RENEWAL_RETRY_ATTEMPTS: {
    schema: z.number().int().min(0),
    default: 3,
    label: "Subscription renewal retry attempts",
    description: "How many times the renewal sweep retries a failed charge (one attempt per sweep run) before expiring the subscription, within the grace period.",
    category: "billing",
  },

  // Milestone 13 — Founder Command Center thresholds. Each defaults to 0
  // ("disabled, never alert") rather than a guessed number — a fabricated
  // default threshold would either nag immediately on a fresh install or
  // silently never fire; an explicit founder-set value is the only honest
  // option here.
  DAILY_API_COST_ALERT_USD: {
    schema: z.number().min(0),
    default: 0,
    label: "Daily API cost alert threshold (USD)",
    description: "Command Center flags 'High API Cost' once today's AI vendor spend crosses this. 0 disables the alert.",
    category: "ops_alerts",
  },
  STORAGE_BUDGET_GB: {
    schema: z.number().min(0),
    default: 0,
    label: "Storage budget (GB)",
    description: "Command Center flags 'Storage Almost Full' once known asset storage crosses 90% of this. 0 disables the alert (no real bucket-quota API exists to check against automatically).",
    category: "ops_alerts",
  },
  LOW_CREDIT_BALANCE_ALERT_THRESHOLD: {
    schema: z.number().int().min(0),
    default: 0,
    label: "Low credit balance alert threshold",
    description: "Command Center flags 'Credits Running Low' for any user whose credit balance falls below this. 0 disables the alert.",
    category: "ops_alerts",
  },

  // Milestone 12 — referral bonus amounts, granted via the existing
  // grantCredits() with type REFERRAL (an enum value that existed since the
  // Credit Engine's first milestone but had no trigger point until now).
  REFERRAL_BONUS_CREDITS: {
    schema: z.object({
      referrerCredits: z.number().min(0),
      refereeCredits: z.number().min(0),
    }),
    default: { referrerCredits: 5, refereeCredits: 5 } as const,
    label: "Referral bonus credits",
    description: "Credits granted to the referrer and the new signee when a referral code is applied at signup.",
    category: "credit_rules",
  },

  // Milestone 24 — Cloud Video Editor (non-AI) policy knobs. Business-rule
  // limits, not hardcoded — everything else about this module (track kinds,
  // aspect ratios) is a fixed creative/structural enum, same precedent as
  // TEXT_ANIMATIONS above.
  EDITOR_MAX_TRACKS_PER_PROJECT: {
    schema: z.number().int().min(1).max(100),
    default: 20,
    label: "Max tracks per editor project",
    description: "Upper bound on how many tracks (of any kind combined) a single Cloud Video Editor project may have.",
    category: "video_editor_policy",
  },
  EDITOR_MAX_UPLOAD_SIZE_BYTES: {
    schema: z.number().int().min(1),
    default: 2 * 1024 * 1024 * 1024,
    label: "Max editor upload size (bytes)",
    description: "Largest single media file a user may upload into the Cloud Video Editor's Media Library.",
    category: "video_editor_policy",
  },
  EDITOR_ALLOWED_UPLOAD_MIME_TYPES: {
    schema: z.object({
      VIDEO: z.array(z.string()).min(1),
      AUDIO: z.array(z.string()).min(1),
      IMAGE: z.array(z.string()).min(1),
      FONT: z.array(z.string()).min(1),
    }),
    default: {
      VIDEO: ["video/mp4", "video/quicktime", "video/webm"],
      AUDIO: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg"],
      IMAGE: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      // Module 7 — custom brand font uploads.
      FONT: ["font/woff2", "font/woff", "font/ttf", "font/otf", "application/font-woff2", "application/x-font-ttf"],
    } as const,
    label: "Allowed editor upload MIME types",
    description: "Per-kind allow-list of MIME types accepted by the Cloud Video Editor's asset upload.",
    category: "video_editor_policy",
  },
  EDITOR_AUTOSAVE_INTERVAL_MS: {
    schema: z.number().int().min(1000).max(120000),
    default: 10000,
    label: "Editor autosave interval (ms)",
    description: "Wired in Module 5 (History): every Command already persists to the database immediately, so this drives a lightweight periodic 'still synced' heartbeat rather than a data re-save — the actual restorable snapshots use EDITOR_VERSION_SNAPSHOT_INTERVAL_MS below.",
    category: "video_editor_policy",
  },
  EDITOR_VERSION_SNAPSHOT_INTERVAL_MS: {
    schema: z.number().int().min(30000).max(1800000),
    default: 300000,
    label: "Editor version snapshot interval (ms)",
    description: "How often the Cloud Video Editor takes an automatic, restorable full-project version snapshot for an open project, at minimum — a much coarser cadence than the autosave heartbeat since each snapshot stores the whole tracks/clips/markers state. Wired in Module 5 (History).",
    category: "video_editor_policy",
  },
  EDITOR_VERSION_SNAPSHOT_COMMAND_INTERVAL: {
    schema: z.number().int().min(1).max(200),
    default: 20,
    label: "Editor version snapshot command interval",
    description: "A version snapshot is also taken after this many undo-stack entries since the last snapshot, whichever comes first against the time-based interval above — so a burst of heavy editing gets a restore point without waiting out the full time interval. Wired in Module 5 (History).",
    category: "video_editor_policy",
  },
  EDITOR_SNAP_THRESHOLD_PX: {
    schema: z.number().int().min(0).max(50),
    default: 8,
    label: "Editor timeline snap threshold (px)",
    description: "How close (in pixels, at the current zoom) a dragged clip edge must be to another clip/playhead/marker before it magnetically snaps. Wired starting Module 2.",
    category: "video_editor_policy",
  },
  EDITOR_EXPORT_QUEUE_CONCURRENCY: {
    schema: z.number().int().min(1).max(8),
    default: 1,
    label: "Editor export queue concurrency",
    description: "Max Cloud Video Editor exports rendered in parallel — each spawns its own headless Chromium + FFmpeg process, a much heavier per-job cost than the AI-generation render queue's RENDER_QUEUE_CONCURRENCY, so this defaults low. Wired in Module 10.",
    category: "video_editor_policy",
  },
  EDITOR_EXPORT_MAX_DURATION_MS: {
    schema: z.number().int().min(1000),
    default: 30 * 60 * 1000,
    label: "Editor export max project duration (ms)",
    description: "Upper bound on a project's total duration eligible for export — a frame-by-frame headless-browser render's cost scales with duration × fps × resolution, so this is a real throughput guardrail, not an arbitrary limit. Wired in Module 10.",
    category: "video_editor_policy",
  },
  // Real bug fix (2026-07-24, found live during the codebase health check)
  // — EDITOR_EXPORT_MAX_DURATION_MS alone caps duration, but fps (up to
  // 120) and resolution (up to 4K) were independently uncapped, so a
  // single legitimate-looking request (4K/120fps/30min) could demand
  // ~216,000 individual PNG frame files with no combined guardrail —
  // real disk exhaustion risk, and with EDITOR_EXPORT_QUEUE_CONCURRENCY
  // defaulting to 1, a single such job (or one that simply hangs) occupies
  // the only export worker slot for every user on the instance. This caps
  // the actual cost driver directly — total output pixels (width × height
  // × totalFrames) — rather than any one dimension alone, so a low-res
  // long export and a high-res short one are judged by the same real
  // resource budget. Default permits a full 4K/30fps/30min export
  // (~447.9 billion) with headroom, while rejecting 4K/120fps/30min
  // (~1.79 trillion, 4x over) — tune per your own hardware if needed.
  EDITOR_EXPORT_MAX_PIXEL_FRAMES: {
    schema: z.number().int().min(1_000_000),
    default: 500_000_000_000,
    label: "Editor export max total pixel-frames (width × height × frame count)",
    description: "Rejects an export request whose combined resolution × fps × duration exceeds this budget, before any real work starts — the actual resource driver a duration-only cap misses. See EDITOR_EXPORT_MAX_DURATION_MS for the duration-only guardrail this complements.",
    category: "video_editor_policy",
  },
  EDITOR_NORMALIZE_QUEUE_CONCURRENCY: {
    schema: z.number().int().min(1).max(8),
    default: 1,
    label: "Editor asset normalize queue concurrency",
    description: "Max video uploads transcoded in parallel (H.264/AAC/60fps baseline, only when the source needs it) — FFmpeg-heavy local compute, same reasoning as EDITOR_EXPORT_QUEUE_CONCURRENCY, so it defaults low and gets its own budget rather than sharing the export queue's.",
    category: "video_editor_policy",
  },
  AI_EDIT_QUEUE_CONCURRENCY: {
    schema: z.number().int().min(1).max(8),
    default: 1,
    label: "AI Auto-Editor job queue concurrency",
    description: "Max AiEditJob rows (transcription + scene-removal planning) processed in parallel — network-bound API calls (transcription vendor), same reasoning as RENDER_QUEUE_CONCURRENCY, not the export queue's heavier local-compute one. Wired in Phase 12 Module 2.",
    category: "video_editor_policy",
  },
  AI_EDIT_SILENCE_THRESHOLD_MS: {
    schema: z.number().int().min(100).max(10_000),
    default: 800,
    label: "AI Auto-Editor silence-removal threshold (ms)",
    description: "A pause between words at or above this length is proposed as a \"silence\" scene-removal window. Deliberately admin-tunable separately from the transcript SEGMENTATION module's own 700ms paragraph-break threshold (a different purpose — cutting silence from the final video, not marking a paragraph boundary). Fix (2026-08-06) — this is now the ADAPTIVE detector's pivot value (see detectSilenceGapsAdaptive, lib/transcription/segmentation.ts), scaled per-gap by local speech speed, not a flat cutoff; the three settings below are its hard floor/ceiling/reference rate. Wired in Phase 12 Module 2.",
    category: "video_editor_policy",
  },
  // Fix (2026-08-06, FIX 3 — "gap removal quality is poor") — the three
  // knobs the adaptive silence detector needs beyond the pivot above. See
  // detectSilenceGapsAdaptive's own doc comment (lib/transcription/
  // segmentation.ts) for exactly how each is used.
  AI_EDIT_SILENCE_MIN_THRESHOLD_MS: {
    schema: z.number().int().min(50).max(5_000),
    default: 350,
    label: "AI Auto-Editor silence-removal floor (ms)",
    description: "A pause shorter than this is NEVER proposed for removal, regardless of local speech speed — the natural-breathing safety floor (\"natural breathing pauses should remain\"). Lower this if you deliberately want tighter cuts than the default floor allows.",
    category: "video_editor_policy",
  },
  AI_EDIT_SILENCE_MAX_THRESHOLD_MS: {
    schema: z.number().int().min(500).max(15_000),
    default: 2500,
    label: "AI Auto-Editor silence-removal ceiling (ms)",
    description: "A pause at or above this length is ALWAYS proposed for removal, regardless of local speech speed — no speaker's natural pacing is used to excuse dead air this long (\"long pauses must always be removed\").",
    category: "video_editor_policy",
  },
  AI_EDIT_SILENCE_REFERENCE_WPM: {
    schema: z.number().int().min(50).max(400),
    default: 150,
    label: "AI Auto-Editor silence-removal reference speech rate (WPM)",
    description: "The articulation speed (words per minute of actual speaking time, pauses excluded) the adaptive threshold is centered on. A local passage faster than this lowers the effective threshold for gaps in it (a pause reads as comparatively longer against a quick pace); a slower passage raises it (the same pause may just be that speaker's natural rhythm). 150 WPM is an average conversational pace.",
    category: "video_editor_policy",
  },
  AI_EDIT_REASONING_REPAIR_MAX_ATTEMPTS: {
    schema: z.number().int().min(0).max(3),
    default: 1,
    label: "AI Auto-Editor timeline-planning repair attempts",
    description: "How many times the REASONING (captions/zoom planning) call re-prompts the model with its own validation error after a malformed JSON response, before giving up and surfacing a planning failure. 0 disables repair (fail on the first bad response). Distinct from the generic GENERATION_RETRY_MAX_ATTEMPTS, which retries a failed NETWORK call — this retries a successful call that returned the WRONG SHAPE. Wired in Phase 12 Module 4.",
    category: "video_editor_policy",
  },
  AI_EDIT_BROLL_STOCK_ONLY: {
    schema: z.boolean(),
    default: true,
    label: "AI Auto-Editor: stock-only b-roll (no generation)",
    description: "Founder policy (2026-07-18) — while true, AI Auto-Edit b-roll resolution never spends real generation credits: the resolver always searches stock (Pexels/Pixabay/Openverse/Coverr/Unsplash, whichever are enabled) first regardless of GPT's own stock-vs-generate judgment, and only falls back to a real generateImage()/renderVideo() call as an absolute last resort when literally zero stock providers return a usable result for that slot. The value at job-creation time is captured onto the job itself (AiEditJob.brollStockOnly) so a job's behavior stays consistent even if this default is flipped later — turn it back off here (no prompt-engineering pass needed) once generation is wanted again.",
    category: "video_editor_policy",
  },
  AI_EDIT_BROLL_RELEVANCE_FALLBACK_THRESHOLD: {
    schema: z.number().min(0).max(1),
    default: 0.5,
    label: "AI Auto-Editor: b-roll relevance fallback threshold",
    description: "Founder policy (2026-07-23) — while AI_EDIT_BROLL_STOCK_ONLY is on, the resolver still tries stock first, but if the best real match's relevance score (fraction of the search query's words actually present in the stock candidate's title/tags, 0-1) falls below this, it falls back to real generation for just that one item instead of placing a weak/irrelevant stock match. Calibrated against 39 real production search queries: 0.5 cleanly separated 2 genuinely bad matches from 37 acceptable-to-good ones (a ~5% real-world fallback rate). Same 'captured onto the job at creation time' pattern as AI_EDIT_BROLL_STOCK_ONLY (AiEditJob.brollRelevanceFallbackThreshold) — retune here without a prompt-engineering pass.",
    category: "video_editor_policy",
  },
  // AI Video Director (2026-08-07) — a DISTINCT threshold from the older
  // AI_EDIT_QUALITY_RETRY_THRESHOLD const (still 55, still hardcoded,
  // still governs ONLY the legacy single-call planner's own one-shot
  // bounded retry — deliberately left untouched so that path's behavior
  // stays byte-identical while AI_EDIT_DIRECTOR_PIPELINE_ENABLED is off).
  // This key is the single source of truth for the target the NEW
  // Director pipeline's iterative self-review loop aims for before the
  // Final Director gate finalizes — the two scores aren't interchangeable
  // (this one is a 10-category weighted score, the legacy one a coarser
  // 4-dimension average). Real cost implication — see
  // AI_EDIT_DIRECTOR_PIPELINE_ENABLED's own doc comment; a target this
  // high will realistically trigger 1-2 retry iterations on most real jobs.
  AI_EDIT_QUALITY_TARGET_SCORE: {
    schema: z.number().int().min(0).max(100),
    default: 90,
    label: "AI Director quality target score",
    description: "Overall quality score (0-100, from the Quality Reviewer's 10-category rubric) the AI Video Director's iterative self-review loop targets before finalizing an edit. If AI_EDIT_DIRECTOR_MAX_QUALITY_ITERATIONS is reached first, the best-scoring attempt seen is kept and qualityScores.thresholdMet is stamped false — never silently pretends to have hit this bar. Distinct from the legacy AI_EDIT_QUALITY_RETRY_THRESHOLD const (55, unchanged) which governs only the original single-call planner.",
    category: "video_editor_policy",
  },
  AI_EDIT_DIRECTOR_MAX_QUALITY_ITERATIONS: {
    schema: z.number().int().min(1).max(6),
    default: 3,
    label: "AI Director max quality-review iterations",
    description: "Upper bound on how many extra targeted-regeneration rounds the Quality Reviewer/Final Director loop may run per job, on top of the first full pass. Each iteration only re-invokes the specific agent(s) that map to the review's weak categories (plus whatever is downstream-dependent on them) — never the whole edit. Direct cost/latency multiplier: each extra iteration is up to 5 more GPT-5 reasoning calls (see AI_EDIT_DIRECTOR_PIPELINE_ENABLED).",
    category: "video_editor_policy",
  },
  AI_EDIT_DIRECTOR_PIPELINE_ENABLED: {
    schema: z.boolean(),
    default: false,
    label: "Enable AI Video Director multi-agent pipeline",
    description: "Feature flag for the multi-agent AI Video Director pipeline (separate Story/Hook/Retention, Captions, Visuals, Audio, and Quality Reviewer reasoning calls, with an iterative self-review loop targeting AI_EDIT_QUALITY_TARGET_SCORE). While OFF, AI Auto-Edit uses the original single combined planTimeline() call unchanged — zero behavior change. Default OFF deliberately: the Director pipeline realistically costs 5x today's GPT-5 reasoning spend per job with zero retries, and up to ~11-15x in the worst case (bounded by AI_EDIT_DIRECTOR_MAX_QUALITY_ITERATIONS). Do not enable in production before a deliberate pricing review of the AI Auto-Edit credit cost — the existing per-call cost logging/credit-charging mechanism is correct and needs no code change, but the real dollar cost per job will be materially higher.",
    category: "video_editor_policy",
  },
  AI_EDIT_NO_DEAD_SCREEN_GAP_THRESHOLD_MS: {
    schema: z.number().int().min(500).max(10_000),
    default: 2000,
    label: "No-dead-screen gap threshold (ms)",
    description: "A talking-head stretch with no caption/b-roll/zoom/sticker/motion-graphic visual treatment longer than this is flagged as a dead-screen violation by the Director pipeline's deterministic gap detector (visual-coverage.ts) and auto-fixed with the cheapest fitting insert. Phase 1 fixes are limited to the 5 visual types that already render (b-roll, zoom/camera-punch, sticker, animated caption, motion-graphic-as-asset) — picture-in-picture/split-screen/blur-background/progress-bar/callout/face-punch/screen-recording are a deferred future phase needing new renderer support.",
    category: "video_editor_policy",
  },
  AI_EDIT_QUALITY_CATEGORY_WEIGHTS: {
    schema: z.record(z.string(), z.number().min(0).max(5)),
    default: { hook: 1.5, captions: 1, broll: 1, visualVariety: 0.75, pacing: 1, emotion: 1, retention: 1.5, music: 0.5, sfx: 0.5, storyFlow: 1 } as const,
    label: "AI Director quality-category weights",
    description: "Relative weight of each of the 9 sub-category scores (hook/captions/broll/visualVariety/pacing/emotion/retention/music/sfx/storyFlow) when computing the single overallScore the Final Director gate compares against AI_EDIT_QUALITY_TARGET_SCORE. Hook and Retention weighted higher by default, matching the 'retention-first' principle — every decision should maximize watch time.",
    category: "video_editor_policy",
  },
  AI_EDIT_SFX_MAX_PER_10S: {
    schema: z.number().min(0).max(5),
    default: 1,
    label: "Max SFX events per 10 seconds",
    description: "Anti-spam ceiling used by the Director pipeline's deterministic SFX scoring — more events than this in any rolling 10s window scores sfxScore down, enforcing the brief's 'must feel invisible to professionals, energetic to amateurs, never spam' SFX principle.",
    category: "video_editor_policy",
  },
} as const;

export type ConfigKey = keyof typeof CONFIG_REGISTRY;
export type ConfigValue<K extends ConfigKey> = z.infer<(typeof CONFIG_REGISTRY)[K]["schema"]>;

// Milestone 12 — this used to be a bespoke in-process Map with a comment
// speculating "swap for Redis with pub/sub invalidation" at multi-instance
// scale. That speculation turned out to be more than necessary: Redis IS
// the shared store, so a plain DEL on write already propagates to every
// instance's next read — no pub/sub layer needed. lib/cache/cache.ts is that
// shared primitive (Redis when REDIS_URL is set, the exact same in-process
// Map behavior as before otherwise), reused here and by the rate limiter.
const CONFIG_CACHE_TTL_SECONDS = 30;
const cacheKeyFor = (key: string) => `config:${key}`;

export async function getConfig<K extends ConfigKey>(key: K): Promise<ConfigValue<K>> {
  return getOrSetCache(cacheKeyFor(key), CONFIG_CACHE_TTL_SECONDS, async () => {
    const def = CONFIG_REGISTRY[key];
    const row = await prisma.systemConfig.findUnique({ where: { key } });

    if (row) {
      const parsed = def.schema.safeParse(row.value);
      return (parsed.success ? parsed.data : def.default) as ConfigValue<K>;
    }
    return def.default as ConfigValue<K>;
  });
}

export async function setConfig<K extends ConfigKey>(
  key: K,
  value: ConfigValue<K>,
  updatedBy?: string
): Promise<void> {
  const def = CONFIG_REGISTRY[key];
  const parsed = def.schema.parse(value); // throws on invalid admin input

  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value: parsed, updatedBy },
    update: { value: parsed, updatedBy },
  });

  await invalidateCache(cacheKeyFor(key));
}

export type ConfigInputType = "enum" | "number" | "boolean" | "string" | "string_list" | "json";

// Introspected so the admin panel can render a generic Select/Input per key
// without a second, hand-maintained copy of each field's input type/options
// — the Zod schema in CONFIG_REGISTRY stays the single source of truth.
// "string_list" (an array of enum values, e.g. PROVIDER_LLM_PRIORITY) is
// edited as a comma-separated list, validated against `options` on save.
// "json" (e.g. GENERATION_COST_RATES, a record type with no fixed key set)
// falls back to a raw-JSON textarea, validated by the field's own Zod
// schema on save — same safety guarantee as every other field, just a less
// specialized widget.
function describeInputType(schema: z.ZodTypeAny): { inputType: ConfigInputType; options?: string[] } {
  if (schema instanceof z.ZodEnum) {
    return { inputType: "enum", options: Object.values(schema.enum) as string[] };
  }
  if (schema instanceof z.ZodNumber) {
    return { inputType: "number" };
  }
  if (schema instanceof z.ZodBoolean) {
    return { inputType: "boolean" };
  }
  if (schema instanceof z.ZodArray && schema.element instanceof z.ZodEnum) {
    return { inputType: "string_list", options: Object.values(schema.element.enum) as string[] };
  }
  if (schema instanceof z.ZodRecord || schema instanceof z.ZodObject || schema instanceof z.ZodArray) {
    return { inputType: "json" };
  }
  return { inputType: "string" };
}

export async function getAllConfig(): Promise<
  Record<
    string,
    {
      value: unknown;
      label: string;
      description: string;
      category: string;
      inputType: ConfigInputType;
      options?: string[];
    }
  >
> {
  const keys = Object.keys(CONFIG_REGISTRY) as ConfigKey[];
  const entries = await Promise.all(
    keys.map(async (key) => {
      const def = CONFIG_REGISTRY[key];
      const value = await getConfig(key);
      return [
        key,
        {
          value,
          label: def.label,
          description: def.description,
          category: def.category,
          ...describeInputType(def.schema),
        },
      ] as const;
    })
  );
  return Object.fromEntries(entries);
}
