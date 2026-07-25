// Phase 10 — Visual Scene Planning knowledge banks.
// Industry-specific scene intelligence: what a Senior Art Director knows
// about each category without needing a creative brief. Pure data, no I/O.

// ─────────────────────────────────────────────────────────────────────────────
// Hero subject descriptions by industry × intent
// ─────────────────────────────────────────────────────────────────────────────

export const HERO_SUBJECT_BY_INDUSTRY: Record<string, Record<string, string>> = {
  dental: {
    informative:       "A real-looking dental implant model held in gloved hands against a clean clinical background — the implant itself is the hero, not a person",
    lead_generation:   "A 35-45 year old patient with a naturally confident smile, post-treatment, inside a premium modern dental clinic — the result IS the hero",
    before_after:      "A split-frame: left side shows a self-conscious, closed-mouth person; right side shows the same person with a full, natural confident smile",
    education:         "A board-certified dental specialist showing a dental implant cross-section model to an engaged patient — education through expertise",
    awareness:         "A close-up of a genuinely healthy, natural smile — authentic, never stock-photo perfection",
    default:           "A warm patient-practitioner consultation moment in a bright, modern clinic — trust communicated through human connection",
  },
  healthcare: {
    awareness:         "A diverse family group with a caring healthcare professional in a welcoming clinic — approachable expertise",
    lead_generation:   "A confident, caring healthcare professional in clean clinical attire — competence communicated through posture and environment",
    education:         "A healthcare professional explaining a process using a diagram or model — expertise made accessible",
    default:           "A genuine moment of care between a healthcare professional and a patient — humanity first, clinical second",
  },
  food_beverage: {
    event_announcement:"The restaurant's signature dish, close enough to read every texture — appetite-activated by detail",
    awareness:         "A beautifully plated hero dish in warm ambient restaurant lighting — the food is the entire message",
    default:           "The hero dish shot close enough to see individual textures, with a softly blurred dining room atmosphere behind",
  },
  real_estate: {
    awareness:         "The property's defining architectural feature at golden hour — scale and aspiration communicated without words",
    lead_generation:   "An aspirational outdoor living scene that makes the viewer think 'this is exactly how I want to live'",
    default:           "Wide-angle view of the property's most distinctive feature in the best natural light of the day",
  },
  finance: {
    education:         "A tasteful upward-trending data visualization rendered as a lifestyle element — growth as a way of life",
    lead_generation:   "A composed professional reviewing a financial plan — quiet confidence that this person is ahead",
    default:           "Abstract visual metaphor for growth: forward momentum, natural upward energy, never a cliché coin stack",
  },
  education: {
    lead_generation:   "A proud student in an active learning environment — potential and achievement radiating from the scene",
    awareness:         "A dynamic classroom with engaged students and an inspiring teacher — possibility as the dominant feeling",
    default:           "A genuine student achievement moment or active learning scene — optimism and forward momentum",
  },
  beauty_wellness: {
    before_after:      "Split frame: natural/untreated hair on the left, vibrant/styled transformation on the right — the transformation IS the message",
    lead_generation:   "A confident client with visibly healthy, radiant hair in the salon chair — the result achieved",
    default:           "A close-up of genuinely healthy, lustrous hair or skin in flattering salon lighting — quality through texture",
  },
  jewellery_luxury: {
    sales:             "The hero jewellery piece in extreme macro — every facet catching light, every surface revealing craftsmanship",
    awareness:         "The piece in a tasteful lifestyle setting — worn naturally, communicating its presence without aggression",
    default:           "Single hero piece, macro precision lighting, on a surface that frames it without competing",
  },
  automotive: {
    lead_generation:   "The vehicle at a three-quarter dynamic angle that communicates motion even in stillness — never a flat side-on dealer shot",
    default:           "The vehicle in an environment that communicates its character: urban for performance, open road for freedom",
  },
};

export function getHeroSubject(industryKey: string, intentKey: string): string {
  const industryMap = HERO_SUBJECT_BY_INDUSTRY[industryKey] ?? HERO_SUBJECT_BY_INDUSTRY["healthcare"];
  return industryMap[intentKey] ?? industryMap["default"] ?? "A powerful, specific visual that communicates the marketing message before any text is read";
}

// ─────────────────────────────────────────────────────────────────────────────
// Required objects by industry
// ─────────────────────────────────────────────────────────────────────────────

export const REQUIRED_OBJECTS: Record<string, string> = {
  dental:           "Dental clinic environment elements (chair, equipment visible but not threatening), optionally a dental implant model if educational",
  dental_clinic:    "Premium modern dental clinic: clean surfaces, professional lighting, clinical tools visible as background credibility signals",
  healthcare:       "Clean, modern medical environment; healthcare professional attire; subtle medical equipment for credibility",
  food_beverage:    "The signature dish plated to restaurant standards; genuine food styling; ambient dining environment",
  restaurant:       "Signature dish, premium tableware, ambient restaurant lighting — the food must look genuine and appetising",
  real_estate:      "The property's defining architectural feature; landscaping that signals maintenance quality; natural light",
  finance:          "Clean, uncluttered professional environment; subtle data reference (phone, tablet, document); composed posture",
  education:        "Active learning materials (books, digital devices, student work); modern classroom environment; natural enthusiasm",
  beauty_wellness:  "Professional styling tools visible but elegant; premium salon products present; high-quality lighting setup",
  jewellery_luxury: "Premium display surface (marble, velvet, silk); controlled lighting setup revealing material quality",
  automotive:       "Clean background or aspirational environment; vehicle in optimal condition; correct angle for character communication",
};

export const EXCLUDED_OBJECTS: Record<string, string> = {
  dental:           "Frightening or clinical-cold equipment, blood, extreme procedure imagery, competitor products, stock-photo-perfect unnaturally white teeth",
  healthcare:       "Fear-inducing imagery, extreme clinical coldness, anything that stigmatises illness or patients",
  food_beverage:    "Artificial-looking food, unhygienic environment hints, generic chain-restaurant aesthetics",
  real_estate:      "Empty rooms without lifestyle staging, outdated furnishings, anything suggesting neglect or decline",
  finance:          "Cliché money imagery (coin stacks, gold bars), complex charts that confuse rather than inspire, flashy materialism",
  education:        "Stressed or unhappy students, outdated facilities, anything suggesting academic pressure without outcome",
  beauty_wellness:  "Unrealistic transformation results (digitally altered), clinical medical references, anything suggesting cosmetic surgery",
  jewellery_luxury: "Competitor brands, synthetic-looking materials, low-quality display surfaces, cluttered backgrounds",
  automotive:       "Competitor vehicles, road damage, unglamorous urban settings, flat side-on dealer-lot photography",
};

// ─────────────────────────────────────────────────────────────────────────────
// Environment type by industry
// ─────────────────────────────────────────────────────────────────────────────

export const ENVIRONMENT_BY_INDUSTRY: Record<string, { type: string; backgroundStory: string; details: string }> = {
  dental:           { type: "premium_interior", backgroundStory: "A luxury dental clinic that communicates expertise before a word is read — bright, clinical but warm, expensive without being intimidating", details: "Polished chrome surfaces, clean white walls with warm accent lighting, dental chair visible but non-threatening, professional ambient light" },
  healthcare:       { type: "premium_interior", backgroundStory: "A modern, welcoming healthcare environment — competent and humane simultaneously", details: "Clean architectural lines, warm white walls, subtle medical equipment as background credibility, natural light where possible" },
  food_beverage:    { type: "premium_interior", backgroundStory: "A warm, inviting restaurant ambience that activates appetite and desire before the dish is even examined", details: "Warm amber lighting, premium tableware, soft focus diners in background, genuine materials (wood, linen, ceramic)" },
  real_estate:      { type: "architectural_exterior", backgroundStory: "The property's setting communicates lifestyle and investment quality — architecture as aspiration", details: "Golden hour light on premium materials, manicured landscaping, pristine condition, no visual distractions" },
  finance:          { type: "lifestyle_real_world", backgroundStory: "A composed professional setting that communicates quiet confidence — this person is ahead of the curve", details: "Clean modern space, natural light, minimal clutter, tasteful lifestyle elements (coffee, plant, premium stationery)" },
  education:        { type: "lifestyle_real_world", backgroundStory: "An energetic, optimistic learning environment — possibility and forward momentum in every detail", details: "Modern classroom or campus, active learning visible, natural light, happy engagement without forced performance" },
  beauty_wellness:  { type: "premium_interior", backgroundStory: "A softly lit, indulgent beauty studio — the environment itself is part of the luxury experience", details: "Warm diffused lighting, clean white and warm tone palette, high-quality products as props, immaculate surfaces" },
  jewellery_luxury: { type: "controlled_product_table", backgroundStory: "A gallery-quality setting where the piece is the only story — the background serves the jewellery", details: "Premium surface material (marble, velvet, brushed metal), controlled studio lighting, minimal distractions" },
  automotive:       { type: "outdoor_natural", backgroundStory: "An environment that amplifies the vehicle's character — open road, urban prestige, or dramatic landscape", details: "Clean, aspirational environment with natural or dramatic lighting; no clutter, no competitors visible" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Lighting specification by photography style
// ─────────────────────────────────────────────────────────────────────────────

export const LIGHTING_BY_STYLE: Record<string, { primaryLight: string; secondaryLight: string; mood: string }> = {
  before_after:       { primaryLight: "Even, matched lighting on both sides of the split — natural daylight quality, no dramatic shadows", secondaryLight: "Rim light to cleanly separate subjects from background on both sides", mood: "Natural, authentic, believable — if the before/after lighting is inconsistent it will look fabricated" },
  lifestyle:          { primaryLight: "Natural window light or simulated natural light — soft, directional, warm", secondaryLight: "Reflector fill to lift shadow areas, maintaining natural feel", mood: "Warm, genuine, aspirational without being artificial" },
  studio_product:     { primaryLight: "Controlled soft-box key light positioned to reveal product texture and form", secondaryLight: "Fill light at 50% power to manage shadows without eliminating them", mood: "Clean, precise, professional — product in best possible presentation light" },
  macro_detail:       { primaryLight: "Close, precisely positioned light source that catches every facet and texture", secondaryLight: "Focused accent light to separate foreground from background", mood: "Reverent, precise, intimate — every detail deliberate" },
  editorial:          { primaryLight: "Natural or naturalistic artificial light — quality-over-quantity approach", secondaryLight: "Practical lights visible in frame add authenticity", mood: "Sophisticated, cinematic, magazine-ready" },
  documentary:        { primaryLight: "Available light with minimal augmentation — authenticity is the quality", secondaryLight: "Gentle fill to manage harsh shadows without removing the natural feeling", mood: "Real, human, genuine — the opposite of production artifice" },
  aerial:             { primaryLight: "Natural overhead light (midday for urban, golden hour for dramatic)", secondaryLight: "None — aerial photography works with the available ambient light", mood: "Scale-communicating, environment-defining, powerful" },
};

// ─────────────────────────────────────────────────────────────────────────────
// AI artifact prevention by subject type
// ─────────────────────────────────────────────────────────────────────────────

export const AI_ARTIFACT_PREVENTION: Record<string, string> = {
  person:           "Avoid distorted hands, extra fingers, misaligned eyes, unnatural skin texture, merged body parts. Faces must be specific and human — avoid the symmetrical 'average face' that signals AI generation",
  product_jewellery:"Avoid inconsistent reflections, floating gemstones, mismatched light sources. Engravings and hallmarks must appear plausible (blurred is better than wrong)",
  product_food:     "Avoid glistening that looks artificial, steam that looks CGI, textures that repeat. Food must read as genuinely cooked, not rendered",
  product_car:      "Avoid chrome reflections that show impossible geometry, wheel spokes that merge, light sources that appear from multiple impossible directions simultaneously",
  architecture:     "Avoid perspective distortion that defies physics, windows reflecting impossible scenes, structural elements that defy gravity",
  text_in_image:    "Avoid generating text directly — placeholder shapes only. All text in marketing creatives is added in post-production, never AI-generated inline",
  logo:             "Never attempt to render the actual brand logo — placeholder shape only. Logos added in post-production",
  general:          "Prioritise photorealistic textures, consistent single light source, natural proportions, and avoid any element that draws attention to its artificiality",
};

export function getAIArtifactPrevention(heroType: string, hasText: boolean, hasLogo: boolean): string {
  const parts: string[] = [];
  if (hasText) parts.push(AI_ARTIFACT_PREVENTION.text_in_image);
  if (hasLogo) parts.push(AI_ARTIFACT_PREVENTION.logo);
  const typeKey = heroType.includes("jewel") ? "product_jewellery"
    : heroType.includes("food") || heroType.includes("dish") ? "product_food"
    : heroType.includes("car") || heroType.includes("vehicle") ? "product_car"
    : heroType.includes("building") || heroType.includes("property") || heroType.includes("villa") ? "architecture"
    : heroType.includes("person") || heroType.includes("patient") || heroType.includes("specialist") ? "person"
    : "general";
  parts.push(AI_ARTIFACT_PREVENTION[typeKey] ?? AI_ARTIFACT_PREVENTION.general);
  return parts.join(". Additionally: ");
}
