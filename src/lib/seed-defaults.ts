import type { PrismaClient } from "@/generated/prisma/client";

// Shared by prisma/seed.ts (CLI, its own connection) AND the Installation
// Wizard's Seed step (src/app/api/install/seed/route.ts, the app's own
// `prisma` singleton) — one data source for "default plans/credits/
// templates," not two copies that could drift apart.

export const TEMPLATES: Array<{
  name: string;
  description: string;
  vertical:
    | "RESTAURANT"
    | "CAFE_BAKERY"
    | "SALON_SPA"
    | "DENTAL_DIAGNOSTIC"
    | "REAL_ESTATE"
    | "RETAIL"
    | "GYM_FITNESS"
    | "HOSPITAL"
    | "COACHING_EDTECH"
    | "HOTEL"
    | "FINANCE"
    | "OTHER";
  platform: "INSTAGRAM_REEL";
  aspectRatio: "RATIO_9_16";
  durationSeconds: number;
  creditCost: number;
  promptTemplate: string;
  // AI Video reconciliation Step 1 — every one of these is short ad-style
  // promotional content, the exact fit scene-split was built for. On for
  // all 11 by deliberate decision (not the schema default of false), now
  // that the "pick a template" UI step is gone and this is the only place
  // useSceneSplit is still tunable per-vertical (via the Admin templates
  // manager) if one ever needs to opt back out.
  useSceneSplit: boolean;
  // Milestone 14 — back the Dashboard's "Trending Templates" row with real
  // data instead of a fabricated ranking.
  isFeatured?: boolean;
  defaultObjective?:
    | "PROMOTION"
    | "NEW_LAUNCH"
    | "FESTIVAL_GREETING"
    | "TESTIMONIAL"
    | "ANNOUNCEMENT"
    | "OFFER_DISCOUNT"
    | "BRAND_AWARENESS";
}> = [
  {
    name: "Restaurant — Dish Spotlight",
    description: "Showcase a signature dish or menu item for Reels/Shorts.",
    vertical: "RESTAURANT",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write a punchy 30-second vertical video script for a restaurant promoting a dish. Open with a mouth-watering hook, describe taste and freshness, end with a clear call to visit or order.",
    isFeatured: true,
  },
  {
    name: "Cafe & Bakery — Fresh Drop",
    description: "Announce a new bake or seasonal drink.",
    vertical: "CAFE_BAKERY",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write a warm, inviting 30-second video script for a cafe/bakery announcing a new item. Emphasize freshness and craft, end with an inviting call to action.",
  },
  {
    name: "Salon & Spa — Service Highlight",
    description: "Promote a signature treatment or seasonal offer.",
    vertical: "SALON_SPA",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write a calm, premium-feeling 30-second video script for a salon/spa promoting a service. Focus on the transformation/relaxation benefit and a booking call to action.",
  },
  {
    name: "Dental & Diagnostic — Trust Builder",
    description: "Build confidence in a clinic's care quality and hygiene.",
    vertical: "DENTAL_DIAGNOSTIC",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write a reassuring, professional 30-second video script for a dental/diagnostic clinic. Emphasize expertise, hygiene, and patient comfort, ending with a booking call to action.",
  },
  {
    name: "Real Estate — Property Walkthrough Teaser",
    description: "Tease a property listing or new launch.",
    vertical: "REAL_ESTATE",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write an aspirational 30-second video script teasing a property listing. Highlight key amenities and location appeal, end with a call to enquire.",
    isFeatured: true,
  },
  {
    name: "Retail — New Arrival / Offer",
    description: "Drive footfall or online orders for a retail offer.",
    vertical: "RETAIL",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write an energetic 30-second retail video script promoting a new arrival or offer. Create urgency, end with a clear shop-now call to action.",
    isFeatured: true,
  },
  {
    name: "Gym & Fitness — Motivation + Offer",
    description: "Drive membership sign-ups with a motivational hook.",
    vertical: "GYM_FITNESS",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write a high-energy, motivational 30-second gym/fitness video script. Promote a membership offer or class, end with a strong call to join.",
  },
  {
    name: "Hospital — Department Awareness",
    description: "Build awareness for a specific department or health camp.",
    vertical: "HOSPITAL",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write a clear, trustworthy 30-second hospital video script raising awareness for a department or health camp. End with a call to book a consultation.",
    isFeatured: true,
  },
  {
    name: "Coaching & EdTech — Enrollment Push",
    description: "Promote a course or batch with an enrollment deadline.",
    vertical: "COACHING_EDTECH",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write an encouraging, results-focused 30-second coaching/edtech video script promoting a course or batch. End with a clear enrollment call to action.",
    isFeatured: true,
  },
  {
    name: "Hotel — Stay Experience Teaser",
    description: "Tease the guest experience to drive bookings.",
    vertical: "HOTEL",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write an inviting 30-second hotel video script teasing the guest experience. Highlight comfort/amenities, end with a call to book a stay.",
  },
  {
    name: "Finance — Product Explainer",
    description: "Explain a financial product or service with trust and clarity.",
    vertical: "FINANCE",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write a clear, trustworthy 30-second video script explaining a financial product or service (loan, insurance, investment). Avoid jargon, build confidence, end with a call to learn more.",
    isFeatured: true,
  },
  {
    name: "Festival Greetings",
    description: "Warm festive wishes for any business, any festival.",
    vertical: "OTHER",
    platform: "INSTAGRAM_REEL",
    aspectRatio: "RATIO_9_16",
    durationSeconds: 30,
    creditCost: 1,
    useSceneSplit: true,
    promptTemplate:
      "Write a warm 30-second festival greeting video script for a business wishing customers well. Mention the festival's spirit, thank customers for their support, end with a friendly call to visit/order.",
    isFeatured: true,
    defaultObjective: "FESTIVAL_GREETING",
  },
];

export const CREDIT_PACKAGES: Array<{
  name: string;
  creditAmount: number;
  priceInPaise: number;
  sortOrder: number;
}> = [
  { name: "Starter Pack — 10 credits", creditAmount: 10, priceInPaise: 9_900, sortOrder: 0 },
  { name: "Growth Pack — 50 credits", creditAmount: 50, priceInPaise: 39_900, sortOrder: 1 },
  { name: "Pro Pack — 150 credits", creditAmount: 150, priceInPaise: 99_900, sortOrder: 2 },
];

export const PRICING_PLANS: Array<{
  name: string;
  slug: string;
  billingModel: "PAY_PER_DOWNLOAD" | "SUBSCRIPTION";
  priceInPaise: number;
  billingInterval: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY" | null;
  monthlyCredits: number;
  maxDownloadsPerMonth: number | null;
  // AI Video Phase 1 — null for the non-tiered Pay Per Download plan; every
  // gated video action requires an active subscription at or above its
  // minimumTier (lib/credits/video-actions.ts). See the AI Video credit
  // system plan for the worked profit math behind these tiers/amounts.
  tierLevel: "BASIC" | "PRO" | "PREMIUM" | null;
  sortOrder: number;
}> = [
  {
    name: "Pay Per Download",
    slug: "pay-per-download",
    billingModel: "PAY_PER_DOWNLOAD",
    priceInPaise: 0,
    billingInterval: null,
    monthlyCredits: 0,
    maxDownloadsPerMonth: null,
    tierLevel: null,
    sortOrder: 0,
  },
  {
    name: "Creator Monthly",
    slug: "creator-monthly",
    billingModel: "SUBSCRIPTION",
    priceInPaise: 49_900,
    billingInterval: "MONTHLY",
    monthlyCredits: 40,
    maxDownloadsPerMonth: 30,
    tierLevel: "BASIC",
    sortOrder: 1,
  },
  {
    name: "Studio Monthly",
    slug: "studio-monthly",
    billingModel: "SUBSCRIPTION",
    priceInPaise: 1_49_900,
    billingInterval: "MONTHLY",
    monthlyCredits: 150,
    maxDownloadsPerMonth: null,
    tierLevel: "PRO",
    sortOrder: 2,
  },
  {
    name: "Premium Monthly",
    slug: "premium-monthly",
    billingModel: "SUBSCRIPTION",
    priceInPaise: 2_99_900,
    billingInterval: "MONTHLY",
    monthlyCredits: 350,
    maxDownloadsPerMonth: null,
    tierLevel: "PREMIUM",
    sortOrder: 3,
  },
];

// Milestone 14 — the single source of truth for every Dashboard creation
// card, quick action, and "coming soon" stub (see prisma/schema.prisma's
// CreativeTool model doc comment). Seeded once; every field is then
// admin-editable from /admin/creative-tools with zero code changes.
export const CREATIVE_TOOLS: Array<{
  key: string;
  label: string;
  description: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  category: "MAIN_CARD" | "QUICK_ACTION" | "COMING_SOON";
  pipeline: "VIDEO" | "IMAGE" | "SOCIAL_MEDIA" | "MARKETING_CREATIVE" | "TALKING_HEAD" | "BRAND_ASSET" | "EXTERNAL";
  presetKey?: string;
  routeOverride?: string;
  creditCostEstimate: number;
  estimatedSeconds: number;
  enabled: boolean;
  sortOrder: number;
}> = [
  // Main cards — exactly 3. AI Video Editor (the talking-head/editing-
  // workspace pipeline) is the flagship product (see GradientToolCard's
  // `flagship` prop, wired in QuickCreateGrid via pipeline ===
  // "TALKING_HEAD") — a professional editing workspace (Timeline,
  // Multi-layer Editing, Captions, Voice, B-Roll, Scene Replace, Auto Zoom,
  // Music, Transitions, Export Studio; AI Talking Head is one capability of
  // it, not a peer module). AI Video is the plain generation pipeline.
  //
  // routeOverride fix (2026-07-20) — a real, confirmed bug: this card's own
  // label/description already describe the NEW Cloud Video Editor (Phase
  // 12's real Timeline/captions/B-roll/AI Auto-Edit workspace), but with no
  // routeOverride set, tool-routing.ts's PIPELINE_DEFAULT_HREF["TALKING_HEAD"]
  // sent it to /create/talking-head — the separate, OLDER upload-and-
  // transcribe Scene flow — instead. This is the flagship, first (sortOrder
  // 0) card a user sees on the Dashboard, so the mismatch between promised
  // and actual destination repeatedly sent the founder to the wrong feature
  // (confirmed live twice). routeOverride now points at the real editor
  // entry point, same target as the already-fixed /create hub's "Upload
  // Your Video" tile (see that tile's own 2026-07-18 fix comment) — kept
  // pipeline: "TALKING_HEAD" unchanged since routeOverride always wins
  // (tool-routing.ts) and other pipeline-derived behavior (icon, etc.)
  // still applies correctly.
  // Marketing Creative and Social Media are NOT separate cards — they're
  // output types of the same Universal Creative Engine that powers AI
  // Image (CreativeStudio already serves all three `kind`s through one
  // wizard); reachable as Quick Action chips below, same demotion pattern
  // already used for Brand Assets.
  { key: "talking_head", label: "AI Video Editor", description: "A professional AI editing workspace — timeline, captions, voice, B-roll, scene replace, and more.", icon: "Clapperboard", gradientFrom: "#8b5cf6", gradientTo: "#6366f1", category: "MAIN_CARD", pipeline: "TALKING_HEAD", routeOverride: "/create/ai-auto-edit", creditCostEstimate: 0, estimatedSeconds: 60, enabled: true, sortOrder: 0 },
  { key: "ai_video", label: "AI Video", description: "Generate AI videos from prompts using the AI generation pipeline.", icon: "Film", gradientFrom: "#6366f1", gradientTo: "#a855f7", category: "MAIN_CARD", pipeline: "VIDEO", creditCostEstimate: 1, estimatedSeconds: 90, enabled: true, sortOrder: 1 },
  { key: "ai_image", label: "AI Image", description: "Generate images, posters, banners, ads, and social posts — one engine, every format.", icon: "Image", gradientFrom: "#06b6d4", gradientTo: "#3b82f6", category: "MAIN_CARD", pipeline: "IMAGE", creditCostEstimate: 1, estimatedSeconds: 20, enabled: true, sortOrder: 2 },

  // Quick actions
  { key: "instagram_reel", label: "Instagram Reel", description: "Quick-launch a Reel-ready video.", icon: "Film", gradientFrom: "#ec4899", gradientTo: "#8b5cf6", category: "QUICK_ACTION", pipeline: "VIDEO", routeOverride: "/create/video/script-ad?platform=INSTAGRAM_REEL", creditCostEstimate: 1, estimatedSeconds: 90, enabled: true, sortOrder: 0 },
  { key: "youtube_shorts", label: "YouTube Shorts", description: "Quick-launch a Shorts-ready video.", icon: "PlaySquare", gradientFrom: "#ef4444", gradientTo: "#f97316", category: "QUICK_ACTION", pipeline: "VIDEO", routeOverride: "/create/video/script-ad?platform=YOUTUBE_SHORTS", creditCostEstimate: 1, estimatedSeconds: 90, enabled: true, sortOrder: 1 },
  // Disabled 2026-07-11 (founder decision): Festival Greeting was removed
  // from the create-video wizard's Objective dropdown (UI-only — the
  // FESTIVAL_GREETING enum value and its Template's objective-override
  // resolution path are both untouched, still safe if ever reached
  // directly). enabled: false removes this row from
  // getDashboardData()'s `where: { enabled: true }` query entirely — same
  // convention as the disabled brand_* rows below — rather than routing to
  // a flow it no longer supports. Row kept, not deleted, so it's a trivial
  // one-line revert if this ever comes back.
  { key: "festival_post", label: "Festival Post", description: "A festive greeting, ready in seconds.", icon: "PartyPopper", gradientFrom: "#f59e0b", gradientTo: "#ec4899", category: "QUICK_ACTION", pipeline: "VIDEO", routeOverride: "/create/video/script-ad?objective=FESTIVAL_GREETING", creditCostEstimate: 1, estimatedSeconds: 90, enabled: false, sortOrder: 2 },
  { key: "product_ad", label: "Product Advertisement", description: "A conversion-focused product ad video.", icon: "Tag", gradientFrom: "#6366f1", gradientTo: "#06b6d4", category: "QUICK_ACTION", pipeline: "VIDEO", routeOverride: "/create/video/script-ad?objective=PROMOTION", creditCostEstimate: 1, estimatedSeconds: 90, enabled: true, sortOrder: 3 },
  { key: "restaurant_promo", label: "Restaurant Promo", description: "Showcase a dish or offer.", icon: "UtensilsCrossed", gradientFrom: "#f97316", gradientTo: "#ef4444", category: "QUICK_ACTION", pipeline: "VIDEO", routeOverride: "/create/video/script-ad?objective=PROMOTION", creditCostEstimate: 1, estimatedSeconds: 90, enabled: true, sortOrder: 4 },
  { key: "real_estate_video", label: "Real Estate Video", description: "Tease a property listing.", icon: "Home", gradientFrom: "#10b981", gradientTo: "#3b82f6", category: "QUICK_ACTION", pipeline: "VIDEO", routeOverride: "/create/video/script-ad?objective=NEW_LAUNCH", creditCostEstimate: 1, estimatedSeconds: 90, enabled: true, sortOrder: 5 },
  { key: "thumbnail", label: "Thumbnail", description: "An attention-grabbing YouTube thumbnail image.", icon: "Image", gradientFrom: "#a855f7", gradientTo: "#ec4899", category: "QUICK_ACTION", pipeline: "IMAGE", presetKey: "youtube_thumbnail", creditCostEstimate: 1, estimatedSeconds: 20, enabled: true, sortOrder: 6 },
  { key: "blog_to_video", label: "Blog To Video", description: "Paste a blog's key points, get a video script.", icon: "FileText", gradientFrom: "#3b82f6", gradientTo: "#6366f1", category: "QUICK_ACTION", pipeline: "VIDEO", routeOverride: "/create/video/script-ad?mode=blog", creditCostEstimate: 1, estimatedSeconds: 90, enabled: true, sortOrder: 7 },
  // Demoted from main cards — output types of the Universal Creative Engine
  // (AI Image's CreativeStudio), not standalone products. Routes unchanged.
  { key: "marketing_creative", label: "Marketing Creative", description: "Posters, flyers, banners, and ads.", icon: "Megaphone", gradientFrom: "#f59e0b", gradientTo: "#ef4444", category: "QUICK_ACTION", pipeline: "MARKETING_CREATIVE", creditCostEstimate: 2, estimatedSeconds: 25, enabled: true, sortOrder: 8 },
  { key: "social_media", label: "Social Media", description: "Posts, Stories, Carousels sized for every platform.", icon: "Share2", gradientFrom: "#ec4899", gradientTo: "#f97316", category: "QUICK_ACTION", pipeline: "SOCIAL_MEDIA", creditCostEstimate: 1, estimatedSeconds: 20, enabled: true, sortOrder: 9 },
  { key: "brand_assets", label: "Brand Assets", description: "Logo, palette, typography, and brand guidelines.", icon: "Building2", gradientFrom: "#10b981", gradientTo: "#06b6d4", category: "QUICK_ACTION", pipeline: "BRAND_ASSET", routeOverride: "/brand-kit", creditCostEstimate: 1, estimatedSeconds: 20, enabled: true, sortOrder: 10 },

  // Brand Assets generation actions (folded into /brand-kit, not own cards —
  // these rows exist purely so identity-engine.ts has a real, admin-editable
  // cost/prompt-template/provider source, same as every other tool).
  { key: "brand_logo", label: "Generate Logo", description: "AI-generated logo for your brand.", icon: "Building2", gradientFrom: "#10b981", gradientTo: "#06b6d4", category: "QUICK_ACTION", pipeline: "BRAND_ASSET", creditCostEstimate: 1, estimatedSeconds: 20, enabled: false, sortOrder: 100 },
  { key: "brand_palette", label: "Suggest Palette & Typography", description: "AI-suggested brand colors and fonts.", icon: "Palette", gradientFrom: "#10b981", gradientTo: "#06b6d4", category: "QUICK_ACTION", pipeline: "BRAND_ASSET", creditCostEstimate: 0, estimatedSeconds: 10, enabled: false, sortOrder: 101 },
  { key: "brand_guidelines", label: "Generate Guidelines", description: "AI-written brand guidelines document.", icon: "FileText", gradientFrom: "#10b981", gradientTo: "#06b6d4", category: "QUICK_ACTION", pipeline: "BRAND_ASSET", creditCostEstimate: 0, estimatedSeconds: 10, enabled: false, sortOrder: 102 },

  // Coming soon — inert stubs, no backend, per the brief. `enabled: true`
  // here means "show the teaser card" (visibility), NOT "has a working
  // pipeline" — unlike every other category, a COMING_SOON tool's `enabled`
  // never gates an actual generation call, so it defaults on.
  { key: "avatar_studio", label: "AI Avatar Studio", description: "Create a digital AI presenter avatar.", icon: "UserCircle", gradientFrom: "#64748b", gradientTo: "#94a3b8", category: "COMING_SOON", pipeline: "EXTERNAL", creditCostEstimate: 0, estimatedSeconds: 0, enabled: true, sortOrder: 0 },
  { key: "music_studio", label: "AI Music Studio", description: "Generate royalty-free background music.", icon: "Music", gradientFrom: "#64748b", gradientTo: "#94a3b8", category: "COMING_SOON", pipeline: "EXTERNAL", creditCostEstimate: 0, estimatedSeconds: 0, enabled: true, sortOrder: 1 },
  { key: "website_builder", label: "AI Website Builder", description: "Build a website with AI.", icon: "Globe", gradientFrom: "#64748b", gradientTo: "#94a3b8", category: "COMING_SOON", pipeline: "EXTERNAL", creditCostEstimate: 0, estimatedSeconds: 0, enabled: true, sortOrder: 2 },
  { key: "app_builder", label: "AI App Builder", description: "Build an app with AI.", icon: "Smartphone", gradientFrom: "#64748b", gradientTo: "#94a3b8", category: "COMING_SOON", pipeline: "EXTERNAL", creditCostEstimate: 0, estimatedSeconds: 0, enabled: true, sortOrder: 3 },
  { key: "voice_cloning", label: "Voice Cloning", description: "Clone a voice for narration.", icon: "AudioLines", gradientFrom: "#64748b", gradientTo: "#94a3b8", category: "COMING_SOON", pipeline: "EXTERNAL", creditCostEstimate: 0, estimatedSeconds: 0, enabled: true, sortOrder: 4 },
];

export interface SeedSummary {
  templates: number;
  creditPackages: number;
  pricingPlans: number;
  creativeTools: number;
}

export async function seedDefaults(prisma: PrismaClient): Promise<SeedSummary> {
  for (const t of TEMPLATES) {
    const existing = await prisma.template.findFirst({
      where: { vertical: t.vertical, platform: t.platform, aspectRatio: t.aspectRatio },
    });
    if (existing) {
      await prisma.template.update({ where: { id: existing.id }, data: t });
    } else {
      await prisma.template.create({ data: t });
    }
  }

  for (const pkg of CREDIT_PACKAGES) {
    const existing = await prisma.creditPackage.findFirst({ where: { name: pkg.name } });
    if (existing) {
      await prisma.creditPackage.update({ where: { id: existing.id }, data: pkg });
    } else {
      await prisma.creditPackage.create({ data: pkg });
    }
  }

  for (const plan of PRICING_PLANS) {
    await prisma.pricingPlan.upsert({ where: { slug: plan.slug }, create: plan, update: plan });
  }

  for (const tool of CREATIVE_TOOLS) {
    await prisma.creativeTool.upsert({ where: { key: tool.key }, create: tool, update: tool });
  }

  return {
    templates: TEMPLATES.length,
    creditPackages: CREDIT_PACKAGES.length,
    pricingPlans: PRICING_PLANS.length,
    creativeTools: CREATIVE_TOOLS.length,
  };
}
