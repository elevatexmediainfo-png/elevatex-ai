// Phase 8.5 — Creative Pattern Registry.
//
// Named visual formulas for specific industry × campaign type × audience combinations.
// findBestPattern() returns the closest matching pattern.
// GPT adapts the pattern to the specific brief — it does not copy it.

import type { AudienceSegment, CreativePattern } from "./types";

export const PATTERN_REGISTRY: CreativePattern[] = [

  // ── Food & Hospitality ────────────────────────────────────────────────────

  {
    id: 1,
    name: "Luxury Dining — Chef as Auteur",
    industryId: "food_hospitality",
    campaignTypes: ["luxury_dining"],
    audiences: ["luxury", "premium"],
    heroWeightPercent: 55,
    layoutBrief: "Image 65% | Headline upper-right 20% | Brand + CTA lower 15%. No price visible.",
    photographyBrief: "50mm at counter height. Single overhead spotlight on food. Dark walnut or slate surface. 1/125s to capture steam or sauce movement.",
    typographyBrief: "Refined serif at 18–22vw equivalent. Light tracking. Gold or warm cream on dark. Brand name below at 30% visual weight of headline.",
    ctaStyle: "'Reserve your table' — never 'Book Now'. WhatsApp number preferred over online form.",
    emotionalTrigger: "Culinary anticipation — the viewer can smell the food before touching it.",
  },

  {
    id: 2,
    name: "Café — The Morning That Belongs to You",
    industryId: "food_hospitality",
    campaignTypes: ["cafe"],
    audiences: ["general", "premium"],
    heroWeightPercent: 50,
    layoutBrief: "Image 65% | Headline left-aligned upper 20% | Café name + CTA lower 15%. Warm, unhurried layout.",
    photographyBrief: "50mm at seated counter height. Large window natural light from left. Warm ambient fill from café interior. 1/80s — slight softness communicates life.",
    typographyBrief: "Warm humanist sans (similar to Freight Sans or Proxima). Generous tracking on headline. 2:1 headline-to-subhead ratio. No bold weight in headline.",
    ctaStyle: "'Find your table' or 'WhatsApp [number]'. Table reservation should feel like a personal invitation.",
    emotionalTrigger: "Belonging and autonomy — 'this is the morning before the day asks anything of me'.",
  },

  {
    id: 3,
    name: "Food Delivery — The Family Reach",
    industryId: "food_hospitality",
    campaignTypes: ["delivery"],
    audiences: ["mass", "general"],
    heroWeightPercent: 60,
    layoutBrief: "Image 65% | Delivery app name + time promise upper 20% | Order CTA lower 15%. Warm, energetic layout.",
    photographyBrief: "35mm wide at table height. Multiple hands visible in frame. Warm ambient light from overhead. 1/200s to freeze hands mid-reach.",
    typographyBrief: "Bold rounded sans. Large time-promise headline ('30 minutes. Hot when it arrives.'). Warm red or turmeric as accent. Weight contrast 3:1 between promise and detail.",
    ctaStyle: "'Order now' or 'Track your order'. Speed is the CTA subtext — not browsing.",
    emotionalTrigger: "Family hunger satisfied — the relief of everyone getting what they wanted simultaneously.",
  },

  {
    id: 4,
    name: "Restaurant Grand Opening — The Founder's Threshold",
    industryId: "food_hospitality",
    campaignTypes: ["grand_opening"],
    audiences: ["general", "premium"],
    heroWeightPercent: 50,
    layoutBrief: "Image 60% | Opening date + restaurant name upper 25% | Reservation CTA lower 15%. Documentary editorial feel.",
    photographyBrief: "35mm at human height. Founder at doorway, slightly backlit. Interior warm, exterior natural. 1/60s available light only.",
    typographyBrief: "Editorial serif for restaurant name. Clean sans for date and CTA. Generous white space. No announcements, no 'Now Open' in bold.",
    ctaStyle: "'Reserve for opening week'. Limit the opening capacity in CTA language — 'Seatings limited for opening week'.",
    emotionalTrigger: "Being there first — the specific prestige of having been a guest before it became famous.",
  },

  // ── Healthcare / Dental ──────────────────────────────────────────────────

  {
    id: 5,
    name: "Smile Makeover — The Discovery Moment",
    industryId: "healthcare_dental",
    campaignTypes: ["smile_makeover"],
    audiences: ["general", "premium"],
    heroWeightPercent: 55,
    layoutBrief: "Image 65% | Headline upper-right 20% | Clinic name + consultation CTA lower 15%.",
    photographyBrief: "50mm at patient eye level. Warm non-clinical environment. Natural window light from one side. 1/80s. No dental equipment visible.",
    typographyBrief: "Clean modern sans at medium weight. Warm neutral tones. Headline: benefit, not procedure. 'The smile you've been planning.' not 'Dental Implants'.",
    ctaStyle: "'Free consultation — no obligation'. Remove commitment anxiety completely. WhatsApp booking.",
    emotionalTrigger: "Self-recognition — seeing yourself as the person you've been trying to become.",
  },

  {
    id: 6,
    name: "General Healthcare — The Doctor Who Listens",
    industryId: "healthcare_dental",
    campaignTypes: ["general_healthcare"],
    audiences: ["general", "mass"],
    heroWeightPercent: 50,
    layoutBrief: "Image 60% | Clinic name + credential upper 25% | Appointment CTA lower 15%.",
    photographyBrief: "50mm at patient chair height. Doctor leaning forward, hands clasped. Warm incandescent + natural light. 1/80s. Patient is the primary focus, doctor is secondary.",
    typographyBrief: "Trustworthy modern sans. Medium weight headline. One specific credential. WhatsApp number at same visual weight as clinic name.",
    ctaStyle: "'WhatsApp to book' — same-day appointments preferred messaging over 'Book Online'.",
    emotionalTrigger: "Being genuinely heard by a professional — the relief of not being dismissed.",
  },

  // ── Real Estate ──────────────────────────────────────────────────────────

  {
    id: 7,
    name: "Luxury Launch — The Space She Has Been Composing",
    industryId: "real_estate",
    campaignTypes: ["luxury_launch"],
    audiences: ["luxury", "premium"],
    heroWeightPercent: 65,
    layoutBrief: "Image 70% | Headline right-aligned 15% | Project name + inquiry CTA lower 15%. Minimal. No price.",
    photographyBrief: "24mm at standing height. Interior wide angle. Golden hour from balcony or windows. Subject small against the vast, light-filled space. 1/80s.",
    typographyBrief: "Architectural serif. Very light weight. Wide tracking. No bold. 'The home you have been composing in your mind for a decade.' in one colour on a light field.",
    ctaStyle: "'Register your interest' — not 'Book a site visit'. Luxury launches are invitation-only in communication.",
    emotionalTrigger: "A decade of imagining a specific space — and finally standing in it.",
  },

  {
    id: 8,
    name: "Affordable Homes — The Daughter's Room",
    industryId: "real_estate",
    campaignTypes: ["affordable_homes"],
    audiences: ["mass", "affordable"],
    heroWeightPercent: 55,
    layoutBrief: "Image 65% | Headline left-aligned upper 20% | RERA + EMI + CTA lower 15%. RERA number must be prominent.",
    photographyBrief: "35mm at child eye level. Warm ambient. Cardboard moving box visible. Parents watching from doorway. 1/125s. Warm late afternoon light.",
    typographyBrief: "Bold rounded sans for headline. Clear EMI framing. RERA number at readable 10px equivalent. Warm colour palette (not dark luxury tones).",
    ctaStyle: "'Book a visit' or 'EMI starts at ₹X' as the CTA. EMI framing converts mass market buyers; price does not.",
    emotionalTrigger: "Watching your child own their first room — the specific Indian parenting aspiration.",
  },

  // ── Jewelry / Luxury ─────────────────────────────────────────────────────

  {
    id: 9,
    name: "Bridal Jewellery — Before Calling Family",
    industryId: "jewelry_luxury",
    campaignTypes: ["bridal"],
    audiences: ["luxury", "premium"],
    heroWeightPercent: 60,
    layoutBrief: "Image 70% | Headline upper-right 15% | Brand + consultation CTA lower 15%. Generous negative space.",
    photographyBrief: "85mm at mirror height. Indian bride alone. Warm morning window light. f/2.8 — necklace and expression sharp, background soft. 1/200s.",
    typographyBrief: "Refined luxury serif. Headline: intimate and specific. 'The jewellery you will touch first, on a morning only you will remember.' No price. No 'collections available'.",
    ctaStyle: "'Private consultation — by appointment'. Walk-in language destroys luxury positioning.",
    emotionalTrigger: "The private moment of self-recognition before the morning becomes shared.",
  },

  // ── Financial Services ───────────────────────────────────────────────────

  {
    id: 10,
    name: "Term Insurance — The Cover Amount at Midnight",
    industryId: "financial_services",
    campaignTypes: ["insurance"],
    audiences: ["general", "mass"],
    heroWeightPercent: 50,
    layoutBrief: "Image 60% | Arithmetic headline upper 20% | Brand + calculation CTA lower 20%.",
    photographyBrief: "35mm at desk level. Father at laptop, late night. Only light source: laptop screen (warm white). 1/80s. ISO 1600. Slight grain communicates authenticity.",
    typographyBrief: "Clean modern sans. Headline: the honest arithmetic. '₹1 crore for your family. ₹X per month while you're here.' No lifestyle language. Specific numbers only.",
    ctaStyle: "'Calculate your cover — 2 minutes'. Not 'Buy Now'. Calculation removes commitment anxiety.",
    emotionalTrigger: "The responsible act performed in private — the father who does the hard thing when everyone else is asleep.",
  },

  // ── Fitness / Wellness ───────────────────────────────────────────────────

  {
    id: 11,
    name: "Gym Membership — The Third Rep",
    industryId: "fitness_wellness",
    campaignTypes: ["gym_membership"],
    audiences: ["general", "mass"],
    heroWeightPercent: 50,
    layoutBrief: "Image 65% | Identity headline upper-right 20% | Month-to-month + free session CTA lower 15%.",
    photographyBrief: "35mm below bar level. Man at three-quarters of pull-up. Trainer's hand at lower frame edge, just released. Available gym light. ISO 3200. 1/250s.",
    typographyBrief: "Strong sans at medium weight. Identity headline: 'The person you are in the third rep is who you become.' Month-to-month and 'Come as you are' at equal visual weight.",
    ctaStyle: "'Come for a free session — no membership required'. Not 'Join Now'. No card required.",
    emotionalTrigger: "Becoming — the identity of being someone who does this difficult thing, not someone who has achieved the result.",
  },

  // ── Automotive ───────────────────────────────────────────────────────────

  {
    id: 12,
    name: "Car Launch — The Morning It Becomes Yours",
    industryId: "automotive",
    campaignTypes: ["car_launch"],
    audiences: ["premium", "general"],
    heroWeightPercent: 55,
    layoutBrief: "Image 65% | Ownership headline upper-right 20% | Model name + experience drive CTA lower 15%. No price. No EMI.",
    photographyBrief: "50mm at passenger seat height. Owner in driver's seat, keys in hand. Open showroom doors ahead. Available light: warm incandescent interior + natural morning light from doors. 1/80s.",
    typographyBrief: "Confident modern sans. Headline: the ownership morning. 'The morning it finally becomes yours.' Model name at 40% headline weight. No specifications.",
    ctaStyle: "'Book your experience drive'. Not 'Test Drive'. Overnight experience drive offer if available.",
    emotionalTrigger: "The end of a two-year journey — keys in hand, looking at the open road, everything that was planned now about to begin.",
  },

  // ── Education ────────────────────────────────────────────────────────────

  {
    id: 13,
    name: "Admissions — The Letter at the Kitchen Table",
    industryId: "education",
    campaignTypes: ["admissions"],
    audiences: ["general", "mass"],
    heroWeightPercent: 50,
    layoutBrief: "Image 65% | Journey headline upper-right 20% | Institution + application CTA lower 15%.",
    photographyBrief: "50mm at table level. Student alone with admission letter. Warm kitchen overhead light. Class 12 textbooks visible at frame edge. 1/60s — slight documentary texture.",
    typographyBrief: "Clean editorial sans. Headline: the journey acknowledged. 'The letter that changes everything, while the table stays the same.' Institution name at 60% headline weight.",
    ctaStyle: "'Begin your application — takes 15 minutes'. Low friction. Specific time reduces commitment anxiety.",
    emotionalTrigger: "A years-long journey arriving at a single morning — alone with it before it becomes the family's.",
  },

  // ── Beauty / Salon ───────────────────────────────────────────────────────

  {
    id: 14,
    name: "Salon — The Stylist Watching",
    industryId: "beauty_cosmetics",
    campaignTypes: ["salon_makeover"],
    audiences: ["premium", "general"],
    heroWeightPercent: 50,
    layoutBrief: "Image 65% | Discovery headline upper-right 20% | Stylist name + WhatsApp CTA lower 15%.",
    photographyBrief: "50mm at chair level. Mirror as compositional centre. Stylist behind, watching client's reflection. Warm bulb mirror light + natural window. 1/80s.",
    typographyBrief: "Clean modern sans. Headline: aspiration not transformation. 'The version of you you've been imagining.' Stylist name as personal CTA: 'Colour and Style — [Stylist Name]'.",
    ctaStyle: "'WhatsApp to book: [number]'. Personal number, not booking form. Scarcity if real: 'Limited weekend slots'.",
    emotionalTrigger: "Being seen by a professional who cares about the result as much as you do.",
  },

  // ── Retail / Fashion ─────────────────────────────────────────────────────

  {
    id: 15,
    name: "Fashion Launch — The Evening She Got Right",
    industryId: "retail_fashion",
    campaignTypes: ["fashion_launch"],
    audiences: ["premium", "general"],
    heroWeightPercent: 55,
    layoutBrief: "Image 70% | Occasion headline left 15% | Brand + explore CTA lower 15%. No price.",
    photographyBrief: "85mm at eye level. Three-quarter profile. Rooftop golden hour. f/2.8 — garment sharp, cityscape soft. 1/250s. Subject looking off-frame at conversation.",
    typographyBrief: "Clean modern sans with editorial lightness. Headline: the occasion, not the garment. 'For the evenings that deserve to be remembered.' No 'Shop Now' — use 'Explore the collection'.",
    ctaStyle: "'Explore the collection' leading to online store. No price in advertisement. No discount language.",
    emotionalTrigger: "Looking exactly right in the exact moment you planned for — before the evening asks anything of you.",
  },

  // ── Events / Entertainment ───────────────────────────────────────────────

  {
    id: 16,
    name: "Event Promotion — The Peak Moment",
    industryId: "events_entertainment",
    campaignTypes: ["event_promotion"],
    audiences: ["general", "mass"],
    heroWeightPercent: 50,
    layoutBrief: "Image 65% | Artist name + experience descriptor upper 20% | Date + one booking platform CTA lower 15%.",
    photographyBrief: "24mm wide at front-of-crowd height. Performer in upper third. Crowd with phones in lower two-thirds. Stage lighting natural. ISO 3200. 1/500s.",
    typographyBrief: "Genre-appropriate typeface for artist name. Experience descriptor at 60% artist name weight: '[City] doesn't get a night like this often.' Date: '[Day], [date] · Doors open [time]'.",
    ctaStyle: "'Get tickets on BookMyShow' — one platform only. No price visible in advertisement.",
    emotionalTrigger: "Retrospective FOMO — 'I will wish I had been there' — not 'I will enjoy this'.",
  },

  // ── Tech / Software ──────────────────────────────────────────────────────

  {
    id: 17,
    name: "SaaS — The Task That Completed Itself",
    industryId: "tech_software",
    campaignTypes: ["saas_product"],
    audiences: ["general", "mass"],
    heroWeightPercent: 50,
    layoutBrief: "Image 65% | Time-saving headline upper 20% | Usage stat + free trial CTA lower 15%.",
    photographyBrief: "50mm at desk level. Indian woman or man at end of day. Only laptop screen light (warm white). Team has gone home — empty chairs visible. ISO 1600. 1/80s.",
    typographyBrief: "Clean modern sans. Headline: specific arithmetic. 'The report that used to take 4 hours now takes 6 seconds.' No 10X language. Software name at 50% headline weight.",
    ctaStyle: "'Try free for 14 days — no card required'. WhatsApp support mentioned as secondary: 'WhatsApp support, under 2 hours'.",
    emotionalTrigger: "The relief of realising a task you have been dreading just completed itself — while you were almost resigned to doing it manually again.",
  },

  // ── General (fallback) ───────────────────────────────────────────────────

  {
    id: 18,
    name: "Brand Launch — Customer Value Delivery",
    industryId: "general",
    campaignTypes: ["brand_launch", "*"],
    audiences: ["general", "mass"],
    heroWeightPercent: 50,
    layoutBrief: "Image 65% | Specific benefit headline upper 20% | Business name + primary CTA lower 15%.",
    photographyBrief: "50mm at customer level. Customer experiencing the service's value. Available light in real environment. 1/80s. Documentary feel.",
    typographyBrief: "Clean modern sans. Headline: specific outcome. 'Glasses that fit your face. Ready in an hour.' Not 'Your trusted [category] partner.'",
    ctaStyle: "'WhatsApp us' or 'Visit us at [address]' — one CTA only. Most natural contact method for this business type.",
    emotionalTrigger: "Recognising that a specific problem you've had is finally solved by someone who specifically understands it.",
  },

];

// ─────────────────────────────────────────────────────────────────────────────

function resolveAudience(audience: string | undefined, rawIdea: string): AudienceSegment {
  if (audience) return audience as AudienceSegment;
  const idea = rawIdea.toLowerCase();
  if (idea.includes("luxury") || idea.includes("high-end") || idea.includes("premium")) {
    return idea.includes("luxury") ? "luxury" : "premium";
  }
  if (idea.includes("affordable") || idea.includes("budget") || idea.includes("economy")) {
    return "affordable";
  }
  return "general";
}

/** Returns the best-matching pattern for the given inputs. Falls back to general. */
export function findBestPattern(
  industryId:    string,
  campaignType:  string,
  rawIdea:       string,
  audience?:     string,
): CreativePattern {
  const resolvedAudience = resolveAudience(audience, rawIdea);

  // Exact match: industry + campaign type + audience
  const exact = PATTERN_REGISTRY.find(
    p => p.industryId === industryId &&
         (p.campaignTypes.includes(campaignType) || p.campaignTypes.includes("*")) &&
         (p.audiences.includes(resolvedAudience))
  );
  if (exact) return exact;

  // Relaxed: industry + campaign type (any audience)
  const byType = PATTERN_REGISTRY.find(
    p => p.industryId === industryId &&
         (p.campaignTypes.includes(campaignType) || p.campaignTypes.includes("*"))
  );
  if (byType) return byType;

  // Industry fallback: first pattern for this industry
  const byIndustry = PATTERN_REGISTRY.find(p => p.industryId === industryId);
  if (byIndustry) return byIndustry;

  // General fallback
  return PATTERN_REGISTRY.find(p => p.industryId === "general")!;
}
