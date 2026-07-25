// Phase 8 — Design Director.
//
// Thinks like an Art Director. Never writes stories.
// Only decides visual balance, weight distribution, whitespace strategy,
// and editorial feel. Pure deterministic function — no LLM, no I/O.
//
// Input signals consumed:
//   strategy.business.industry.value       → industry category
//   strategy.visual.luxuryLevel.value      → luxury tier (1–5)
//   strategy.visual.minimalismLevel.value  → design density
//   strategy.marketing.campaignGoal.value  → hero vs CTA emphasis
//   gptDirection.visualHierarchy.*         → reading flow derivation
//   gptDirection.negativeSpace.*           → space zone derivation

import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { CreativeStrategy } from "../creative-brain/types";
import type {
  DesignDirectorOutput,
  DesignBalance,
  DesignDensity,
  LuxuryLevel,
  NegativeSpacePlan,
  IndustryCategory,
} from "./types";

// ─── Industry detection ───────────────────────────────────────────────────────

export function detectIndustryCategory(industry: string): IndustryCategory {
  const i = (industry ?? "").toLowerCase();

  if (/restaurant|food|cafe|bakery|catering|dining|hotel|hospitality|bar|bistro|eatery|cuisine|kitchen|chef/.test(i))
    return "food_hospitality";

  if (/jewel|jewellery|diamond|gold|silver|watch|couture|fashion|luxury brand|designer|haute/.test(i))
    return "jewelry_fashion_luxury";

  if (/health|dental|dentist|clinic|hospital|doctor|medical|physician|therapy|pharma|ayurved|cosmetic surgeon/.test(i))
    return "healthcare_medical";

  if (/real estate|property|housing|apartment|villa|plot|construction|architect|interior design|builder|home/.test(i))
    return "real_estate";

  if (/school|education|coaching|academy|tuition|college|university|course|learning|training|institute|tutorial/.test(i))
    return "education";

  if (/\btech\b|software|app\b|startup|saas|\bit\b|platform|digital agency|web dev|cloud|ai startup|ml\b/.test(i))
    return "tech_software";

  if (/fitness|gym|yoga|pilates|sport|workout|health club|personal train|wellness center|meditation/.test(i))
    return "fitness_wellness";

  if (/beauty|salon|spa|skincare|cosmetic|makeup|hair|nails|aesthetic clinic|grooming/.test(i))
    return "beauty_cosmetics";

  if (/bank|finance|insurance|invest|mutual fund|loan|credit|mortgage|wealth|tax|audit|\bca\b|chartered/.test(i))
    return "financial_services";

  if (/retail|shop|store|ecommerce|market|product brand|merchandise|boutique|online store/.test(i))
    return "retail_ecommerce";

  if (/event|wedding|party|festival|concert|entertainment|show|celebration|venue|banquet/.test(i))
    return "events_entertainment";

  if (/auto|car|vehicle|\bbike\b|motorcycle|dealer|garage|service center|automobile/.test(i))
    return "automotive";

  return "general";
}

// ─── Luxury level mapping ─────────────────────────────────────────────────────

function toLuxuryLevel(raw: string): LuxuryLevel {
  switch (raw) {
    case "ultra_luxury": return 5;
    case "high":         return 4;
    case "medium":       return 3;
    case "low":          return 2;
    default:             return 1;
  }
}

// ─── Base weight tables ───────────────────────────────────────────────────────

interface WeightSet { hero: number; headline: number; cta: number; logo: number; decorative: number }

const BASE_WEIGHTS: Record<IndustryCategory, WeightSet> = {
  food_hospitality:       { hero: 42, headline: 28, cta: 18, logo: 7, decorative: 5 },
  jewelry_fashion_luxury: { hero: 50, headline: 25, cta: 15, logo: 7, decorative: 3 },
  healthcare_medical:     { hero: 38, headline: 32, cta: 20, logo: 7, decorative: 3 },
  real_estate:            { hero: 45, headline: 25, cta: 20, logo: 7, decorative: 3 },
  education:              { hero: 35, headline: 35, cta: 20, logo: 7, decorative: 3 },
  tech_software:          { hero: 42, headline: 28, cta: 20, logo: 7, decorative: 3 },
  fitness_wellness:       { hero: 48, headline: 25, cta: 17, logo: 7, decorative: 3 },
  beauty_cosmetics:       { hero: 45, headline: 28, cta: 17, logo: 7, decorative: 3 },
  financial_services:     { hero: 35, headline: 35, cta: 20, logo: 7, decorative: 3 },
  retail_ecommerce:       { hero: 40, headline: 28, cta: 22, logo: 7, decorative: 3 },
  events_entertainment:   { hero: 45, headline: 25, cta: 20, logo: 7, decorative: 3 },
  automotive:             { hero: 50, headline: 25, cta: 15, logo: 7, decorative: 3 },
  general:                { hero: 40, headline: 28, cta: 20, logo: 8, decorative: 4 },
};

// ─── Base negative space tables ───────────────────────────────────────────────

interface SpaceSet { top: number; bottom: number; left: number; right: number }

const BASE_SPACE: Record<IndustryCategory, SpaceSet> = {
  food_hospitality:       { top: 28, bottom: 16, left: 12, right: 8 },
  jewelry_fashion_luxury: { top: 30, bottom: 18, left: 14, right: 10 },
  healthcare_medical:     { top: 22, bottom: 14, left: 10, right: 8 },
  real_estate:            { top: 25, bottom: 15, left: 10, right: 8 },
  education:              { top: 20, bottom: 14, left: 8,  right: 6 },
  tech_software:          { top: 28, bottom: 16, left: 12, right: 8 },
  fitness_wellness:       { top: 22, bottom: 14, left: 8,  right: 8 },
  beauty_cosmetics:       { top: 28, bottom: 16, left: 10, right: 8 },
  financial_services:     { top: 20, bottom: 14, left: 8,  right: 6 },
  retail_ecommerce:       { top: 18, bottom: 14, left: 8,  right: 6 },
  events_entertainment:   { top: 24, bottom: 15, left: 10, right: 8 },
  automotive:             { top: 26, bottom: 14, left: 10, right: 8 },
  general:                { top: 24, bottom: 15, left: 10, right: 8 },
};

// Additive percentage points by luxury level (applied to all four sides)
const LUXURY_SPACE_DELTA: Record<LuxuryLevel, number> = { 5: 20, 4: 12, 3: 0, 2: -5, 1: -10 };

// ─── Reading flow derivation ──────────────────────────────────────────────────

function extractLabel(text: string | undefined): string {
  if (!text?.trim()) return "";
  const cleaned = text
    .trim()
    .replace(/^(a|an|the|some|very)\s+/i, "")
    .split(/[,—\-\n]/)[0]
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 3).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function buildReadingFlow(dir: GPTCampaignDirection): string[] {
  const flow: string[] = ["Headline"];
  const seen = new Set(["Headline"]);

  const push = (label: string) => {
    const l = extractLabel(label);
    if (l && !seen.has(l)) { flow.push(l); seen.add(l); }
  };

  // Primary visual element (what the eye lands on first)
  if (dir.visualHierarchy?.primary) push(dir.visualHierarchy.primary);
  // Hero subject (may overlap with primary — deduped)
  if (dir.heroSubject)              push(dir.heroSubject);
  // Secondary subjects
  if (dir.secondarySubjects)        push(dir.secondarySubjects);
  // Supporting objects (first only)
  if (dir.supportingObjects) {
    const firstObj = dir.supportingObjects.split(/,|;/)[0];
    if (firstObj) push(firstObj);
  }
  // Background environment
  if (dir.visualHierarchy?.background) push(dir.visualHierarchy.background);

  flow.push("CTA", "Logo");

  return flow.slice(0, 9);
}

// ─── Grid and balance derivation ─────────────────────────────────────────────

function deriveGrid(luxury: LuxuryLevel, density: DesignDensity): string {
  if (luxury >= 4) return "12-column editorial";
  if (density === "minimal") return "8-column clean";
  if (density === "rich") return "6-column structured";
  return "10-column balanced";
}

function deriveBalance(
  industry: IndustryCategory,
  campaignGoal: string,
): DesignBalance {
  if (["healthcare_medical", "financial_services", "education"].includes(industry)) return "left-heavy";
  if (["jewelry_fashion_luxury", "automotive", "fitness_wellness"].includes(industry)) return "centered";
  if (campaignGoal === "sales" || campaignGoal === "lead_generation") return "bottom-heavy";
  return "left-heavy";
}

function deriveDensity(minimalism: string, luxury: LuxuryLevel): DesignDensity {
  if (luxury >= 4 || minimalism === "high" || minimalism === "extreme") return "minimal";
  if (minimalism === "none" || minimalism === "low") return "rich";
  return "balanced";
}

// ─── Premium and editorial feel strings ──────────────────────────────────────

const PREMIUM_FEEL: Record<IndustryCategory, string[]> = {
  food_hospitality:       ["Luxury editorial", "Premium hospitality", "Michelin-tier presentation"],
  jewelry_fashion_luxury: ["Ultra-luxury editorial", "Couture grade", "Prestige lifestyle"],
  healthcare_medical:     ["Premium clinical", "Trust-driven editorial", "Professional authority"],
  real_estate:            ["Premium architectural", "Aspirational lifestyle", "Developer-grade"],
  education:              ["Aspirational academic", "Premium institutional", "Authority editorial"],
  tech_software:          ["Premium product", "Editorial tech", "Modern minimal"],
  fitness_wellness:       ["Premium performance", "Aspirational editorial", "Dynamic lifestyle"],
  beauty_cosmetics:       ["Luxury beauty editorial", "Premium lifestyle", "Aspirational aesthetic"],
  financial_services:     ["Authority editorial", "Premium trust", "Institutional gravitas"],
  retail_ecommerce:       ["Premium product editorial", "Lifestyle commercial", "Brand editorial"],
  events_entertainment:   ["Premium experiential", "Aspirational lifestyle", "Editorial event"],
  automotive:             ["Premium automotive", "Aspirational motion", "Performance editorial"],
  general:                ["Premium editorial", "Commercial grade", "Brand authority"],
};

const EDITORIAL_FEEL: Record<IndustryCategory, string[]> = {
  food_hospitality:       ["Restaurant editorial — think Condé Nast Traveller food", "Fine dining magazine cover"],
  jewelry_fashion_luxury: ["Vogue India — jewelry editorial", "Harper's Bazaar luxury spread"],
  healthcare_medical:     ["Harley Street brochure", "Premium medical journal"],
  real_estate:            ["Architectural Digest India", "Premium property brochure"],
  education:              ["Ivy League admissions brochure", "Premium academic catalogue"],
  tech_software:          ["Apple product page", "Wired magazine feature"],
  fitness_wellness:       ["Nike campaign", "Premium gym editorial"],
  beauty_cosmetics:       ["Elle India beauty editorial", "Luxury skincare campaign"],
  financial_services:     ["Private banking brochure", "Wealth management catalogue"],
  retail_ecommerce:       ["Tanishq campaign quality", "Brand flagship editorial"],
  events_entertainment:   ["Premium event brochure", "Aspirational social editorial"],
  automotive:             ["Auto luxury magazine", "Premium dealer editorial"],
  general:                ["Premium brand campaign", "Category editorial"],
};

function pickItem<T>(arr: T[], index: number = 0): T {
  return arr[index % arr.length];
}

// ─── Main function ────────────────────────────────────────────────────────────

export function buildDesignDirectorOutput(
  dir: GPTCampaignDirection,
  strategy: CreativeStrategy,
): DesignDirectorOutput {
  const industry = detectIndustryCategory(strategy.business.industry.value ?? "");
  const luxury   = toLuxuryLevel(strategy.visual.luxuryLevel.value);
  const density  = deriveDensity(strategy.visual.minimalismLevel.value, luxury);
  const goal     = strategy.marketing.campaignGoal.value ?? "";

  // Visual weights
  const w = { ...BASE_WEIGHTS[industry] };
  // Luxury campaigns shift weight away from CTA and decorative, toward hero
  if (luxury >= 4) {
    w.hero        = Math.min(w.hero + 5, 55);
    w.decorative  = Math.max(w.decorative - 3, 2);
    w.cta         = Math.max(w.cta - 2, 12);
  }
  // Lead gen / sales campaigns shift emphasis toward CTA
  if (goal === "lead_generation" || goal === "sales") {
    w.cta      = Math.min(w.cta + 4, 25);
    w.headline = Math.max(w.headline - 2, 20);
  }
  // Normalize to 100
  const total = w.hero + w.headline + w.cta + w.logo + w.decorative;
  const scale = 100 / total;
  const heroWeight       = Math.round(w.hero       * scale);
  const headlineWeight   = Math.round(w.headline   * scale);
  const ctaWeight        = Math.round(w.cta        * scale);
  const logoWeight       = Math.round(w.logo       * scale);
  const decorativeWeight = 100 - heroWeight - headlineWeight - ctaWeight - logoWeight;

  // Negative space
  const s     = { ...BASE_SPACE[industry] };
  const delta = LUXURY_SPACE_DELTA[luxury];
  const clamp = (v: number, min = 4, max = 48) => Math.min(max, Math.max(min, v + delta));
  const negativeSpace: NegativeSpacePlan = {
    top:    `${clamp(s.top)}%`,
    bottom: `${clamp(s.bottom)}%`,
    left:   `${clamp(s.left, 3, 20)}%`,
    right:  `${clamp(s.right, 3, 16)}%`,
  };

  // Whitespace strategy prose
  const topPct    = clamp(s.top);
  const bottomPct = clamp(s.bottom);
  const whitespaceStrategy =
    `Reserve ${topPct}% at the top as undisturbed premium whitespace for the dominant headline. ` +
    `Maintain ${bottomPct}% at the bottom, clean and uncompeted, for the CTA. ` +
    `The visual hero commands the center without compromise. ` +
    `Every empty zone is a deliberate design decision, not an omission.`;

  const balance       = deriveBalance(industry, goal);
  const grid          = deriveGrid(luxury, density);
  const premiumFeel   = pickItem(PREMIUM_FEEL[industry]);
  const editorialFeel = pickItem(EDITORIAL_FEEL[industry]);
  const readingFlow   = buildReadingFlow(dir);

  return {
    heroWeight,
    headlineWeight,
    ctaWeight,
    logoWeight,
    decorativeWeight,
    negativeSpace,
    readingFlow,
    grid,
    balance,
    premiumFeel,
    whitespaceStrategy,
    designDensity: density,
    luxuryLevel:   luxury,
    editorialFeel,
  };
}
