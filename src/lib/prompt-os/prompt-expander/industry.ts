import type { UniversalPrompt } from "../schema";
import type { IndustryProfile } from "./types";

// Curated visual-language knowledge bank — one profile per business
// category, each with genuinely distinct phrasing so two different
// industries never read like the same boilerplate with the noun swapped.
// Mirrors resolve-kind.ts's keyword-bucket pattern, applied to richer prose
// instead of a 3-way classification.
const PROFILES: IndustryProfile[] = [
  {
    key: "dental",
    label: "Dental / Medical",
    keywords: ["dental", "dentist", "tooth", "teeth", "implant", "orthodont", "smile clinic"],
    atmosphere: "a luxury medical interior — bright, sterile, and calming, the kind of clinic that signals expertise before a single word is read",
    paletteLanguage: "a clean clinical palette of whites and soft blues with a single confident accent tone, never clinical-cold",
    premiumDetails: "premium dental equipment with polished chrome surfaces, immaculate surfaces, soft architectural curves",
    subjectHints: "a genuinely healthy, confident smile or a warm patient-practitioner moment — never a stock-photo grin",
    trustElements: ["board-certified expertise", "modern sterilized equipment", "a calm, trustworthy clinical atmosphere"],
  },
  {
    key: "restaurant",
    label: "Restaurant / Food",
    keywords: ["restaurant", "dining", "menu", "chef", "cafe", "café", "cuisine", "food", "dish", "bistro"],
    atmosphere: "an inviting restaurant ambience — warm, intimate, appetite-driven, the kind of scene that makes a viewer hungry within a glance",
    paletteLanguage: "rich warm tones — amber, deep red, toasted gold — against a softly blurred ambient backdrop",
    premiumDetails: "visible steam rising off the dish, glistening textures, fresh garnish, hand-finished plating",
    subjectHints: "a beautifully plated signature dish shot close enough to read every texture, with a softly out-of-focus dining room behind it",
    trustElements: ["fresh, high-quality ingredients", "an inviting, well-loved dining atmosphere", "genuine culinary craftsmanship"],
  },
  {
    key: "real_estate",
    label: "Real Estate / Hospitality",
    keywords: ["villa", "real estate", "property", "home", "apartment", "residence", "estate", "architecture", "interior design"],
    atmosphere: "golden-hour light washing over premium architecture — the unmistakable lifestyle-aspirational mood of a luxury property campaign",
    paletteLanguage: "warm golden and amber tones against deep architectural shadow, with cool stone and glass accents",
    premiumDetails: "premium natural materials — polished stone, brushed metal, floor-to-ceiling glass — composed with deliberate wide-angle grandeur",
    subjectHints: "the property's defining architectural feature, framed to convey scale and aspiration, with a sense of lived-in luxury rather than an empty showroom",
    trustElements: ["premium build quality", "an aspirational, lived-in lifestyle setting", "architectural credibility"],
  },
  {
    key: "finance",
    label: "Finance / Investment",
    keywords: ["mutual fund", "finance", "investment", "bank", "insurance", "wealth", "stock", "portfolio", "loan", "sip"],
    atmosphere: "a composed, professional lifestyle setting that radiates quiet confidence and long-term trust, never flashy or gimmicky",
    paletteLanguage: "minimal corporate luxury — deep navy or charcoal grounded by a single confident accent (gold or emerald), generous negative space",
    premiumDetails: "subtle growth symbolism rendered tastefully — an upward visual line, a sense of forward motion — never a literal cartoon graph",
    subjectHints: "a composed professional or a tasteful abstract symbol of growth and security, never a cliché stack of coins",
    trustElements: ["institutional credibility", "long-term financial security", "a composed, professional brand presence"],
  },
  {
    key: "salon",
    label: "Salon / Beauty",
    keywords: ["salon", "spa", "beauty", "hair", "skincare", "makeup", "wellness", "grooming"],
    atmosphere: "a softly lit, indulgent beauty studio — calm, premium, sensorial, the visual language of self-care as luxury",
    paletteLanguage: "soft blush and warm neutral tones with gentle diffused highlights, never harsh or clinical",
    premiumDetails: "glossy, healthy textures — skin, hair, polished surfaces — caught in flattering soft-box light",
    subjectHints: "a radiant, natural beauty moment or a close, tactile detail of the treatment itself",
    trustElements: ["visible craftsmanship and skill", "a premium, relaxing studio atmosphere", "genuinely healthy, natural-looking results"],
  },
  {
    key: "jewellery",
    label: "Jewellery / Luxury Goods",
    keywords: ["jewellery", "jewelry", "diamond", "ring", "necklace", "gold", "luxury watch", "gemstone"],
    atmosphere: "a hushed, gallery-quality luxury setting where the product itself is the entire story",
    paletteLanguage: "deep jewel tones and black against a single precise highlight, maximum contrast, minimum distraction",
    premiumDetails: "macro-level material detail — faceted gemstone reflections, polished precious metal, every facet catching light with intention",
    subjectHints: "the piece itself, shot macro with flawless precision, light choreographed to reveal craftsmanship",
    trustElements: ["handcrafted precision", "premium material authenticity", "an unmistakably luxury presentation"],
  },
  {
    key: "hospital",
    label: "Hospital / Healthcare",
    keywords: ["hospital", "clinic", "healthcare", "health awareness", "medical center", "patient care", "wellness campaign"],
    atmosphere: "a reassuring, modern healthcare environment — competent and humane at once, never sterile-cold or fear-driven",
    paletteLanguage: "clean whites and calming blues or greens, soft and reassuring rather than clinical",
    premiumDetails: "modern medical architecture and equipment rendered with quiet competence, human warmth in the foreground",
    subjectHints: "a genuine moment of care between practitioner and patient, or a confident healthcare professional, never a generic stock-clinic shot",
    trustElements: ["genuine medical competence", "a humane, reassuring patient experience", "modern healthcare infrastructure"],
  },
  {
    key: "education",
    label: "Education / Academic",
    keywords: ["school", "college", "university", "admission", "campus", "academic", "student", "learning", "education", "classroom", "teacher", "faculty"],
    atmosphere: "a vibrant, aspirational academic environment — energetic but purposeful, projecting possibility and future success",
    paletteLanguage: "clean institutional blues or energetic greens, lifted with a motivating accent, never institutional-cold",
    premiumDetails: "active students, engaged teachers, modern facilities, visible learning and achievement in progress",
    subjectHints: "a genuine student-teacher engagement or a proud achievement moment — never an empty classroom or posed headshots",
    trustElements: ["proven academic outcomes", "qualified engaged faculty", "modern learning infrastructure"],
  },
  {
    key: "automobile",
    label: "Automobile / Automotive",
    keywords: ["car", "vehicle", "showroom", "motor", "sedan", "suv", "automotive", "automobile", "dealership", "car launch", "auto show"],
    atmosphere: "a dramatic automotive studio or open-road setting — the visual language of freedom, power, and engineering precision",
    paletteLanguage: "bold monochromatic depth — deep blacks, polished silvers, reflective surfaces — with a single vivid accent",
    premiumDetails: "paint-work reflections, machined surfaces, interior craftsmanship details, dynamic road context",
    subjectHints: "the vehicle at a dynamic angle that conveys motion and presence — never a flat side-on dealer-lot shot",
    trustElements: ["engineering excellence", "design innovation", "aspirational driving experience"],
  },
  {
    key: "generic_product",
    label: "Premium Product / General Commercial",
    keywords: [],
    atmosphere: "a premium commercial studio environment built entirely around the product as hero",
    paletteLanguage: "a considered, brand-led palette with one confident accent against a clean, uncluttered background",
    premiumDetails: "tactile, high-end material rendering — every surface, edge, and reflection deliberate",
    subjectHints: "the product itself as the unmistakable hero of the frame, lit to reveal its premium craftsmanship",
    trustElements: ["premium build quality", "considered brand presentation", "unmistakable product craftsmanship"],
  },
];

const FALLBACK_PROFILE = PROFILES[PROFILES.length - 1];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary matching, not plain substring — a naive `.includes("gold")`
// false-positives on "golden retriever", "goldfish", etc. `\b` correctly
// treats "golden" as one word gold does NOT appear inside as its own token.
function matchText(text: string | undefined, profile: IndustryProfile): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return profile.keywords.some((kw) => new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i").test(lower));
}

// Checks intent/industry/creative_type IN THAT PRIORITY ORDER. The user's
// own raw idea text is checked first — confirmed live this session that a
// real LLM's `industry` classification can be too broad to be the best
// signal on its own (e.g. "Dental clinic Instagram post" came back with
// `industry: "Healthcare"`, which would otherwise route to the generic
// hospital profile instead of the more relevant, more specific dental one,
// even though the idea text says "dental" explicitly). `industry` is still
// checked next as a real fallback signal for ideas whose raw text doesn't
// name anything specific. (Iterating profiles-outer/candidates-inner would
// let a lower-priority candidate's keyword steal the match before the
// higher-priority candidate gets a chance to match at all.)
export function matchIndustryProfile(prompt: UniversalPrompt): IndustryProfile {
  const candidates = [prompt.intent, prompt.industry, prompt.creative_type];
  for (const text of candidates) {
    for (const profile of PROFILES) {
      if (profile === FALLBACK_PROFILE) continue;
      if (matchText(text, profile)) return profile;
    }
  }
  return FALLBACK_PROFILE;
}
