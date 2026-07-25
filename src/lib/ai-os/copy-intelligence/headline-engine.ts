// Phase 8.8A — Headline Engine.
// Generates 3-5 headline candidates, returns the best one and alternates.
// Template-based, deterministic — no LLM.

import type { CopyInput, HeadlineCandidate, HeadlineResult, HeadlineTemplate, ToneProfile } from "./types";
import { TONE_ADJECTIVES } from "./tone-engine";
import { INDUSTRY_NOUNS, INDUSTRY_AUDIENCE_NOUN } from "./industry-rules";

// ─────────────────────────────────────────────────────────────────────────────
// Headline template bank
// ─────────────────────────────────────────────────────────────────────────────

const HEADLINE_TEMPLATES: HeadlineTemplate[] = [
  // ── General × luxury / premium ──────────────────────────────────────────────
  { pattern: "Experience {adjective} {noun}",           tones: ["luxury","premium"],         objectives: ["brand_awareness","product_launch"],                             baseScore: 88 },
  { pattern: "Discover {adjective} {noun}",             tones: ["luxury","premium"],         objectives: ["brand_awareness","product_launch"],                             baseScore: 84 },
  { pattern: "The Art of {noun}",                       tones: ["luxury","minimal"],         objectives: ["brand_awareness"],                                              baseScore: 80 },
  { pattern: "{adjective} {noun}, Elevated",            tones: ["luxury","premium"],         objectives: ["brand_awareness","product_launch"],                             baseScore: 78 },
  { pattern: "The Finest {noun} in Town",               tones: ["premium","professional"],   objectives: ["brand_awareness","trust_building"],                             baseScore: 76 },

  // ── General × professional / authoritative ────────────────────────────────
  { pattern: "Expert {noun} Solutions",                 tones: ["professional","authoritative"], objectives: ["brand_awareness","trust_building","product_launch"],        baseScore: 82 },
  { pattern: "Trusted {noun} Specialists",              tones: ["professional","authoritative"], objectives: ["trust_building","brand_awareness"],                         baseScore: 84 },
  { pattern: "Award-Winning {noun}",                    tones: ["authoritative","professional"], objectives: ["trust_building","brand_awareness"],                         baseScore: 82 },
  { pattern: "Trusted by {number}+ {audience}",         tones: ["authoritative","professional"], objectives: ["trust_building"],                                           baseScore: 86 },
  { pattern: "Your Premier {noun} Partner",             tones: ["professional"],            objectives: ["brand_awareness","trust_building"],                              baseScore: 76 },

  // ── General × lead generation ─────────────────────────────────────────────
  { pattern: "Get Free {service} Today",                tones: ["professional","friendly"], objectives: ["lead_generation"],                                               baseScore: 88 },
  { pattern: "Book Your Free {service}",                tones: ["professional","friendly"], objectives: ["lead_generation","appointment_booking"],                         baseScore: 84 },
  { pattern: "Claim Your Free {service} Now",           tones: ["friendly","professional"], objectives: ["lead_generation"],                                               baseScore: 82 },

  // ── General × direct sale ─────────────────────────────────────────────────
  { pattern: "Save Big on {noun} Today",                tones: ["friendly","professional"], objectives: ["direct_sale"],                                                   baseScore: 80 },
  { pattern: "{adjective} {noun} at Unbeatable Value",  tones: ["professional","friendly"], objectives: ["direct_sale"],                                                   baseScore: 78 },
  { pattern: "Exclusive {noun} Deals — Book Now",       tones: ["professional","authoritative"], objectives: ["direct_sale","appointment_booking"],                        baseScore: 80 },

  // ── General × friendly ────────────────────────────────────────────────────
  { pattern: "Your {adjective} {noun} Awaits",          tones: ["friendly","premium"],      objectives: ["brand_awareness","lead_generation","product_launch"],            baseScore: 82 },
  { pattern: "{adjective} {noun} for Everyone",         tones: ["friendly"],                objectives: ["brand_awareness","direct_sale"],                                 baseScore: 74 },

  // ── General × minimal ────────────────────────────────────────────────────
  { pattern: "Simply {adjective}.",                     tones: ["minimal"],                 objectives: ["brand_awareness","product_launch"],                              baseScore: 72 },
  { pattern: "Better {noun}. Starts Here.",             tones: ["minimal"],                 objectives: ["brand_awareness","product_launch"],                              baseScore: 74 },

  // ── Restaurant ────────────────────────────────────────────────────────────
  { pattern: "Taste the Difference",                    tones: ["professional","friendly"], objectives: ["brand_awareness","footfall"],        industries: ["restaurant"], baseScore: 82 },
  { pattern: "Where Every Meal is Memorable",           tones: ["premium","friendly"],      objectives: ["brand_awareness"],                   industries: ["restaurant"], baseScore: 84 },
  { pattern: "Savor {adjective} Culinary Creations",    tones: ["luxury","premium"],        objectives: ["brand_awareness","product_launch"],  industries: ["restaurant"], baseScore: 90 },
  { pattern: "Fine Dining Redefined",                   tones: ["luxury","premium"],        objectives: ["brand_awareness","product_launch"],  industries: ["restaurant"], baseScore: 86 },
  { pattern: "Book a Table, Create a Memory",           tones: ["friendly","professional"], objectives: ["footfall","event_attendance"],       industries: ["restaurant"], baseScore: 82 },

  // ── Dental ───────────────────────────────────────────────────────────────
  { pattern: "Your Perfect Smile Starts Here",          tones: ["professional","friendly"], objectives: ["brand_awareness","lead_generation"], industries: ["dental"],     baseScore: 92 },
  { pattern: "Transform Your Smile Today",              tones: ["professional","friendly"], objectives: ["lead_generation","appointment_booking"], industries: ["dental"], baseScore: 90 },
  { pattern: "Expert Dental Care You Can Trust",        tones: ["authoritative","professional"], objectives: ["trust_building"],                industries: ["dental"],     baseScore: 88 },
  { pattern: "Smile Brighter with Expert Care",         tones: ["friendly","professional"], objectives: ["brand_awareness","lead_generation"], industries: ["dental"],     baseScore: 86 },

  // ── Real estate ──────────────────────────────────────────────────────────
  { pattern: "Your Dream Home Awaits",                  tones: ["professional","friendly"], objectives: ["brand_awareness","lead_generation"], industries: ["real_estate"], baseScore: 90 },
  { pattern: "Homes Designed for Your Lifestyle",       tones: ["premium","professional"],  objectives: ["brand_awareness","product_launch"],  industries: ["real_estate"], baseScore: 86 },
  { pattern: "Invest in Your Future Today",             tones: ["professional","authoritative"], objectives: ["lead_generation","direct_sale"], industries: ["real_estate"], baseScore: 84 },
  { pattern: "Premium Living. Prime Location.",         tones: ["luxury","premium"],        objectives: ["brand_awareness","product_launch"],  industries: ["real_estate"], baseScore: 90 },

  // ── Healthcare ───────────────────────────────────────────────────────────
  { pattern: "Your Health, Our Priority",               tones: ["professional","authoritative"], objectives: ["trust_building","brand_awareness"], industries: ["healthcare"], baseScore: 90 },
  { pattern: "Expert Care When You Need It",            tones: ["professional","authoritative"], objectives: ["trust_building","lead_generation"], industries: ["healthcare"], baseScore: 88 },
  { pattern: "Compassionate Care, Proven Results",      tones: ["professional","authoritative"], objectives: ["trust_building"],                   industries: ["healthcare"], baseScore: 86 },

  // ── Jewelry ──────────────────────────────────────────────────────────────
  { pattern: "Crafted for the Extraordinary",           tones: ["luxury","premium"],        objectives: ["brand_awareness","product_launch"],  industries: ["jewelry"],    baseScore: 94 },
  { pattern: "Where Every Jewel Tells a Story",         tones: ["luxury","premium"],        objectives: ["brand_awareness"],                   industries: ["jewelry"],    baseScore: 90 },
  { pattern: "Timeless Beauty, Exquisite Craftsmanship",tones: ["luxury"],                  objectives: ["brand_awareness","product_launch"],  industries: ["jewelry"],    baseScore: 92 },

  // ── Finance ──────────────────────────────────────────────────────────────
  { pattern: "Grow Your Wealth Confidently",            tones: ["professional","authoritative"], objectives: ["brand_awareness","trust_building"], industries: ["finance"], baseScore: 88 },
  { pattern: "Smart Investments Start Here",            tones: ["professional","minimal"],   objectives: ["lead_generation","direct_sale"],     industries: ["finance"],    baseScore: 84 },
  { pattern: "Your Financial Goals, Our Expertise",     tones: ["professional"],             objectives: ["trust_building"],                   industries: ["finance"],    baseScore: 86 },

  // ── Tech ─────────────────────────────────────────────────────────────────
  { pattern: "Built for the Modern Business",           tones: ["minimal","professional"],   objectives: ["brand_awareness","product_launch"],  industries: ["tech"],       baseScore: 86 },
  { pattern: "Start Free. Scale Fast.",                 tones: ["minimal","professional"],   objectives: ["lead_generation","product_launch"],  industries: ["tech"],       baseScore: 90 },
  { pattern: "Simple. Powerful. Reliable.",             tones: ["minimal"],                  objectives: ["brand_awareness","trust_building"],  industries: ["tech"],       baseScore: 84 },

  // ── Fashion ──────────────────────────────────────────────────────────────
  { pattern: "Style That Speaks for Itself",            tones: ["premium","professional"],   objectives: ["brand_awareness"],                   industries: ["fashion"],    baseScore: 86 },
  { pattern: "Wear Your Confidence",                    tones: ["friendly","premium"],       objectives: ["brand_awareness","product_launch"],  industries: ["fashion"],    baseScore: 84 },
  { pattern: "New Season, New You",                     tones: ["friendly","premium"],       objectives: ["product_launch","brand_awareness"],  industries: ["fashion"],    baseScore: 82 },

  // ── Salon ────────────────────────────────────────────────────────────────
  { pattern: "Transform Your Look Today",               tones: ["professional","friendly"],  objectives: ["brand_awareness","lead_generation"], industries: ["salon"],      baseScore: 88 },
  { pattern: "Beauty That Inspires Confidence",         tones: ["premium","friendly"],       objectives: ["brand_awareness"],                   industries: ["salon"],      baseScore: 84 },

  // ── Education ────────────────────────────────────────────────────────────
  { pattern: "Shape Your Future Today",                 tones: ["professional","friendly"],  objectives: ["brand_awareness","lead_generation"], industries: ["education"],  baseScore: 86 },
  { pattern: "Learn From the Best",                     tones: ["professional","authoritative"], objectives: ["brand_awareness","trust_building"], industries: ["education"], baseScore: 82 },
  { pattern: "Your Career Starts Here",                 tones: ["professional","friendly"],  objectives: ["lead_generation","product_launch"],  industries: ["education"],  baseScore: 88 },

  // ── Automotive ───────────────────────────────────────────────────────────
  { pattern: "Drive Your Dreams Home",                  tones: ["friendly","premium"],       objectives: ["brand_awareness","direct_sale"],     industries: ["automotive"], baseScore: 86 },
  { pattern: "Performance Meets Comfort",               tones: ["premium","professional"],   objectives: ["brand_awareness","product_launch"],  industries: ["automotive"], baseScore: 84 },

  // ── Events ───────────────────────────────────────────────────────────────
  { pattern: "Be Part of Something Special",            tones: ["friendly","professional"],  objectives: ["event_attendance","brand_awareness"], industries: ["events"],    baseScore: 84 },
  { pattern: "Don't Miss This Exclusive Event",         tones: ["professional"],             objectives: ["event_attendance"],                  industries: ["events"],     baseScore: 86 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Keyword extraction from raw idea
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","can",
  "this","that","these","those","i","we","you","they","he","she","it",
  "my","our","your","their","his","her","its","get","make","need","want",
  "ad","campaign","poster","flyer","banner","design","creative","create",
  "generate","advertisement","marketing","brand","about","new","best","top",
  "great","good","free","now","today","just","also","more","like","use",
]);

function extractKeywords(rawIdea: string): string[] {
  return rawIdea
    .split(/[\s,\.!?;:'"()\[\]\/\\]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9%&-]/g, "").toLowerCase())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot building
// ─────────────────────────────────────────────────────────────────────────────

function buildSlots(input: CopyInput, tone: ToneProfile): Record<string, string> {
  const keywords = extractKeywords(input.rawIdea);

  // {adjective} — from tone adjective list
  const adjective = TONE_ADJECTIVES[tone.primary]?.[0] ?? "Expert";

  // {noun} — industry noun phrase
  const noun = INDUSTRY_NOUNS[input.industry]?.[0] ?? "Excellence";

  // {audience} — from input or industry default
  const audience =
    input.audience !== "general" && input.audience !== "unknown"
      ? titleCase(input.audience)
      : (INDUSTRY_AUDIENCE_NOUN[input.industry] ?? "Customers");

  // {service} — best content keyword from rawIdea, or noun
  const contentKeyword = keywords.find(
    (w) => w.length >= 4 && !["dental","health","estate","finance","restaurant","tech"].includes(w),
  );
  const service = contentKeyword ? titleCase(contentKeyword) : noun;

  // {number} — extract from rawIdea or default
  const numberMatch = input.rawIdea.match(/\b\d[\d,]*\+?\b/);
  const number = numberMatch ? numberMatch[0] : "1,000";

  // {timeframe} — detect time words in rawIdea
  const lower = input.rawIdea.toLowerCase();
  const timeframe =
    lower.includes("weekend")  ? "This Weekend" :
    lower.includes("today")    ? "Today"         :
    lower.includes("month")    ? "This Month"    :
    lower.includes("season")   ? "This Season"   :
    "Today";

  return { adjective, noun, audience, service, number, timeframe };
}

function titleCase(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Template slot filling
// ─────────────────────────────────────────────────────────────────────────────

function fillTemplate(pattern: string, slots: Record<string, string>): string {
  return pattern.replace(/\{(\w+)\}/g, (_, key: string) => slots[key] ?? titleCase(key));
}

// ─────────────────────────────────────────────────────────────────────────────
// Template scoring
// ─────────────────────────────────────────────────────────────────────────────

function scoreTemplate(
  t: HeadlineTemplate,
  tone: ToneProfile,
  input: CopyInput,
): number {
  let score = t.baseScore;

  // Industry match — strongest positive signal
  if (t.industries) {
    if (t.industries.includes(input.industry)) score += 20;
    else score -= 40; // heavily penalise wrong-industry templates
  }

  // Tone match
  if (t.tones.includes(tone.primary)) score += 12;
  else if (tone.secondary && t.tones.includes(tone.secondary)) score += 6;
  else score -= 8;

  // Objective match
  if (t.objectives.includes(input.commercialObjective)) score += 10;
  else score -= 4;

  return Math.max(0, Math.min(100, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function generateHeadline(input: CopyInput, tone: ToneProfile): HeadlineResult {
  const slots = buildSlots(input, tone);

  // Score all templates and sort descending
  const scored = HEADLINE_TEMPLATES
    .map((t) => ({ t, score: scoreTemplate(t, tone, input) }))
    .sort((a, b) => b.score - a.score);

  // Pick up to 5 unique headline texts
  const seen = new Set<string>();
  const candidates: HeadlineCandidate[] = [];

  for (const { t, score } of scored) {
    if (candidates.length >= 5) break;
    const text = fillTemplate(t.pattern, slots);
    if (!seen.has(text)) {
      seen.add(text);
      candidates.push({
        text,
        score,
        rationale: `${t.tones[0]} tone, ${t.objectives[0]} objective${t.industries ? `, ${t.industries[0]} industry` : ""}`,
      });
    }
  }

  // Guarantee at least 3 candidates by adding from remainder if needed
  if (candidates.length < 3) {
    for (const { t } of scored) {
      if (candidates.length >= 3) break;
      const text = fillTemplate(t.pattern, slots);
      if (!seen.has(text)) {
        seen.add(text);
        candidates.push({ text, score: 40, rationale: "fallback template" });
      }
    }
  }

  return {
    best:       candidates[0]!.text,
    alternates: candidates.slice(1).map((c) => c.text),
    candidates,
  };
}

export { extractKeywords };
