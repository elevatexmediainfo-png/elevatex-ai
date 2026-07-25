// Phase 8.5 — Mandatory rule engine.
//
// Per-industry MUST/NEVER rules injected into GPT context.
// Rules are applied automatically by the CDE — they do not need to be
// written into the system prompt manually.

import type { IndustryRuleSet } from "./types";

export const INDUSTRY_RULES: IndustryRuleSet[] = [

  {
    industryId: "food_hospitality",
    rules: [
      { type: "MUST",  rule: "Hero must show food or chef at a decisive, unrepeatable moment — appetite trigger active" },
      { type: "NEVER", rule: "Empty restaurant, empty tables, or unoccupied dining room as primary environmental element" },
      { type: "NEVER", rule: "White studio background or neutral backdrop for food" },
      { type: "MUST",  rule: "Warm lighting (2800–3200K equivalent) — flat bright light destroys appetite perception" },
      { type: "MUST",  rule: "Tactile food detail visible — texture, steam, colour, condensation, or plating precision" },
      { type: "MUST",  rule: "Premium surface or setting — wood, marble, dark stone, or linen — never formica or plastic" },
      { type: "NEVER", rule: "Generic smiling diner photography — if human is present, show the decisive culinary moment" },
    ],
  },

  {
    industryId: "healthcare_dental",
    rules: [
      { type: "NEVER", rule: "Visible dental tools, syringes, or clinical instruments in the hero frame" },
      { type: "NEVER", rule: "Any blood, wounds, or clinical procedure imagery" },
      { type: "NEVER", rule: "White-coat-and-clipboard doctor pose" },
      { type: "MUST",  rule: "Natural, unforced smile — patient relaxed, not performing" },
      { type: "MUST",  rule: "Clean, warm clinical environment — not sterile hospital, not living room" },
      { type: "MUST",  rule: "At least one verifiable trust signal — certification, patient count, or specific outcome" },
      { type: "MUST",  rule: "Doctor (if shown) positioned as listener, not authority — leaning forward, not standing over" },
    ],
  },

  {
    industryId: "real_estate",
    rules: [
      { type: "MUST",  rule: "Hero human must be experiencing the property — not standing in front of it" },
      { type: "MUST",  rule: "One specific emotional ownership moment — not 'happy family on balcony' generic" },
      { type: "MUST",  rule: "RERA number visible and prominent if regulatory environment requires it" },
      { type: "NEVER", rule: "Aerial drone shot of property as primary hero — communicates real estate listing, not aspiration" },
      { type: "NEVER", rule: "Invisible or unclear location context — Indian buyers need to understand the city and area" },
      { type: "MUST",  rule: "Pricing or EMI information present if shown — hidden pricing reduces trust in Indian market" },
      { type: "NEVER", rule: "International or non-Indian lifestyle imagery — aspirational distance kills identification" },
    ],
  },

  {
    industryId: "jewelry_luxury",
    rules: [
      { type: "MUST",  rule: "Private, intimate moment — the jewellery is being experienced personally, not displayed" },
      { type: "NEVER", rule: "Product floating on white background for luxury jewellery campaign advertising" },
      { type: "NEVER", rule: "Group celebration photo — jewellery moments are singular and private" },
      { type: "MUST",  rule: "Warm window light or candle-quality light — cold studio light destroys warmth and intimacy" },
      { type: "MUST",  rule: "Hero person is Indian — no aspiration distance for bridal and occasion jewellery" },
      { type: "NEVER", rule: "Price in the primary campaign advertisement for luxury jewellery" },
      { type: "MUST",  rule: "Negative space premium — generous breathing room communicates luxury positioning" },
    ],
  },

  {
    industryId: "financial_services",
    rules: [
      { type: "NEVER", rule: "Happy family photo as primary hero — this has been used so many times it triggers instant dismissal" },
      { type: "NEVER", rule: "Celebrity endorsement for insurance — communicates marketing budget, not product trust" },
      { type: "NEVER", rule: "'Guaranteed' language — legally problematic and commercially dismissed in Indian insurance" },
      { type: "MUST",  rule: "Specific numbers — cover amount, premium, claim settlement ratio — never approximate or vague" },
      { type: "MUST",  rule: "The responsible act being performed — not the outcome of the act" },
      { type: "MUST",  rule: "Claim settlement credential — this is the single most conversion-critical financial trust signal" },
      { type: "NEVER", rule: "Slow-motion child running or lifestyle aspiration imagery for protection products" },
    ],
  },

  {
    industryId: "fitness_wellness",
    rules: [
      { type: "NEVER", rule: "Before/after body transformation as the primary campaign visual" },
      { type: "NEVER", rule: "Impossible physique or 'six-pack in six weeks' promise" },
      { type: "MUST",  rule: "Mid-effort moment — the hardest point of the exercise, not the achievement of completing it" },
      { type: "MUST",  rule: "Real Indian person at realistic fitness level — not a fitness model" },
      { type: "MUST",  rule: "Month-to-month or commitment-free membership clearly communicated" },
      { type: "NEVER", rule: "Intimidating equipment display or advanced-athlete environment as primary visual" },
      { type: "MUST",  rule: "Identity trigger — the advertisement speaks to who the person is becoming, not what they will look like" },
    ],
  },

  {
    industryId: "automotive",
    rules: [
      { type: "NEVER", rule: "Car exterior three-quarter beauty shot as the primary campaign hero" },
      { type: "NEVER", rule: "Race track, mountain road, or aspirational driving fantasy context" },
      { type: "NEVER", rule: "EMI or starting price as the dominant typographic element in brand campaign" },
      { type: "MUST",  rule: "Owner in driver's seat — interior perspective communicates ownership, not product" },
      { type: "MUST",  rule: "Indian city or showroom context — the ownership moment must be grounded in Indian reality" },
      { type: "MUST",  rule: "Experience drive CTA — not 'test drive' (clinical) — 'book your experience drive'" },
      { type: "NEVER", rule: "Celebrity endorsement without genuine driving context" },
    ],
  },

  {
    industryId: "education",
    rules: [
      { type: "NEVER", rule: "Campus building or aerial campus shot as primary advertisement hero" },
      { type: "NEVER", rule: "Graduation photography for admissions advertising — communicates endpoint, not beginning" },
      { type: "NEVER", rule: "'Guaranteed placement' or '100% placement' claims" },
      { type: "MUST",  rule: "Domestic achievement moment — the kitchen table, the study corner, the real environment" },
      { type: "MUST",  rule: "Individual student — not group campus photography" },
      { type: "MUST",  rule: "One specific, verifiable credential — one NIRF ranking is trusted; multiple rankings are not" },
      { type: "NEVER", rule: "Foreign setting or international graduation context for Indian admissions" },
    ],
  },

  {
    industryId: "beauty_cosmetics",
    rules: [
      { type: "NEVER", rule: "Before/after split in primary campaign advertisement" },
      { type: "NEVER", rule: "Generic model with studio-perfect hair — use real stylist with real client" },
      { type: "NEVER", rule: "Discount language or price-based offer in premium salon campaign" },
      { type: "MUST",  rule: "Stylist-client relationship visible — the professional investment, not just the result" },
      { type: "MUST",  rule: "WhatsApp as the primary booking CTA — Indian premium service customers book via WhatsApp" },
      { type: "MUST",  rule: "One specific professional credential — a named training institution converts over generic 'qualified'" },
      { type: "NEVER", rule: "'Affordable luxury' language — oxymoron that communicates neither quality nor accessibility" },
    ],
  },

  {
    industryId: "retail_fashion",
    rules: [
      { type: "NEVER", rule: "White background catalogue photography in campaign advertising" },
      { type: "NEVER", rule: "International model for Indian ethnic wear" },
      { type: "NEVER", rule: "Launch discount offer or festival sale banner in brand campaign" },
      { type: "MUST",  rule: "Indian woman in Indian occasion context — not a photoshoot environment" },
      { type: "MUST",  rule: "Golden hour or real occasion light — not studio lighting" },
      { type: "NEVER", rule: "Multiple garment grid in campaign advertisement — one occasion, one garment" },
      { type: "NEVER", rule: "Price in primary campaign creative — belongs on e-commerce category page" },
    ],
  },

  {
    industryId: "events_entertainment",
    rules: [
      { type: "NEVER", rule: "Generic crowd stock photography — must use real event photography" },
      { type: "NEVER", rule: "Artist standing with arms crossed looking at camera for event promotion" },
      { type: "NEVER", rule: "Manufactured urgency — 'LIMITED TICKETS' red box, countdown timer, or discount codes" },
      { type: "MUST",  rule: "Peak performance moment — the moment audiences remember and talk about" },
      { type: "MUST",  rule: "Crowd visible as active participants — communicates demand and collective experience" },
      { type: "NEVER", rule: "Multiple booking platform CTAs of equal size — one primary CTA only" },
      { type: "NEVER", rule: "Sponsor logo grid in primary campaign advertisement" },
    ],
  },

  {
    industryId: "tech_software",
    rules: [
      { type: "NEVER", rule: "Dashboard screenshot or complex UI as the primary campaign hero" },
      { type: "NEVER", rule: "International diverse team high-fiving or celebrating over screens" },
      { type: "NEVER", rule: "'10X productivity', '5X output', or abstract multiplier claims" },
      { type: "MUST",  rule: "Specific task named + specific time saving quantified — never vague 'saves time'" },
      { type: "MUST",  rule: "Real Indian SMB environment — not VC-funded coworking or startup aesthetic" },
      { type: "MUST",  rule: "Free trial with no card required as the primary CTA" },
      { type: "MUST",  rule: "WhatsApp support mentioned — Indian SMBs specifically value WhatsApp over tickets" },
    ],
  },

  {
    industryId: "general",
    rules: [
      { type: "MUST",  rule: "Hero must be a customer experiencing value — not the founder, logo, or product display" },
      { type: "NEVER", rule: "Generic quality claims — 'best', 'trusted', 'quality guaranteed' without specifics" },
      { type: "MUST",  rule: "One specific benefit headline — a specific outcome, not a category description" },
      { type: "NEVER", rule: "Multiple CTAs — one action path only" },
      { type: "MUST",  rule: "At least one detail grounded in Indian context — city, cultural moment, or specific habit" },
      { type: "NEVER", rule: "International or aspirationally distant imagery for a local Indian business launch" },
    ],
  },

];

/** Returns the rule set for an industry. Falls back to general rules. */
export function getRulesForIndustry(industryId: string, campaignType?: string): IndustryRuleSet {
  // First try exact industry + campaign type match
  if (campaignType) {
    const specific = INDUSTRY_RULES.find(
      r => r.industryId === industryId && r.campaignType === campaignType
    );
    if (specific) return specific;
  }

  // Then industry-level (no campaignType restriction)
  const industry = INDUSTRY_RULES.find(
    r => r.industryId === industryId && !r.campaignType
  );
  if (industry) return industry;

  // Final fallback
  return INDUSTRY_RULES.find(r => r.industryId === "general")!;
}
