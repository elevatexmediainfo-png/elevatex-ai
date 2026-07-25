// Fast keyword-based intent classifier. Zero I/O, zero cost.
// Runs at the start of every generation so all projects carry a category
// label — including direct (non-enhanced) generations that never touch the
// 13-phase enhance-prompt pipeline.
//
// When the enhance-prompt pipeline already ran, universalPrompt.creative_type
// is set by the LLM and we trust it at "high" confidence. The keyword scan
// is the fallback for plain/direct generations.

export type CreativeCategory =
  | "THUMBNAIL"
  | "PRODUCT"
  | "RESTAURANT"
  | "REAL_ESTATE"
  | "POSTER"
  | "SOCIAL_POST"
  | "LOGO"
  | "ADVERTISEMENT"
  | "CINEMATIC"
  | "PORTRAIT"
  | "GENERAL";

export interface DetectedIntent {
  category: CreativeCategory;
  confidence: "high" | "medium" | "low";
  signals: string[];
}

// Most-specific to least-specific: first match wins.
const CATEGORY_PATTERNS: [CreativeCategory, RegExp][] = [
  ["THUMBNAIL", /\b(thumbnail|youtube (thumbnail|cover|art)|click.?bait|video cover|channel art)\b/i],
  ["LOGO", /\b(logo|brand.?mark|wordmark|icon design|logotype|monogram|mascot logo)\b/i],
  ["PRODUCT", /\b(product (photo|shot|image|listing|render)|e.?commerce|shopify|pack(aging|shot)|merchandise)\b/i],
  ["RESTAURANT", /\b(restaurant|cafe|coffee shop|food (photo|photography|shot)|menu item|dish|cuisine|meal|dining|bakery|dessert photo)\b/i],
  ["REAL_ESTATE", /\b(real estate|property (photo|listing)|house (photo|exterior|interior)|home (exterior|interior)|apartment|architecture photo|living room|bedroom (photo|shot))\b/i],
  ["POSTER", /\b(movie poster|event poster|concert (poster|flyer)|music festival|gig poster|album (cover|art)|film poster)\b/i],
  ["SOCIAL_POST", /\b(instagram (post|reel|story|carousel)|facebook post|twitter post|pinterest pin|linkedin post|social (media )?(graphic|post)|reel cover)\b/i],
  ["ADVERTISEMENT", /\b(advertisement|ad creative|billboard|banner ad|marketing campaign|promo(tional)? (ad|creative)|flyer design|paid ad)\b/i],
  ["PORTRAIT", /\b(portrait (photo)?|headshot|professional photo(graph)?|model (photo|shot)|profile photo|editorial portrait)\b/i],
  ["CINEMATIC", /\b(cinematic (shot|scene|photo)|film still|movie scene|epic (landscape|shot)|wide angle scene|establishing shot|narrative scene|dramatic scene)\b/i],
];

// Maps creative_type strings from UniversalPrompt to our categories.
// Normalized to lowercase with underscores before lookup.
const CREATIVE_TYPE_MAP: Record<string, CreativeCategory> = {
  thumbnail: "THUMBNAIL",
  youtube_thumbnail: "THUMBNAIL",
  video_thumbnail: "THUMBNAIL",
  logo: "LOGO",
  brand_identity: "LOGO",
  logo_design: "LOGO",
  product_photo: "PRODUCT",
  product_shot: "PRODUCT",
  product_render: "PRODUCT",
  ecommerce: "PRODUCT",
  food_photography: "RESTAURANT",
  restaurant_menu: "RESTAURANT",
  food_photo: "RESTAURANT",
  real_estate: "REAL_ESTATE",
  property_listing: "REAL_ESTATE",
  architecture: "REAL_ESTATE",
  movie_poster: "POSTER",
  event_poster: "POSTER",
  concert_poster: "POSTER",
  album_cover: "POSTER",
  social_media_post: "SOCIAL_POST",
  social_post: "SOCIAL_POST",
  instagram_post: "SOCIAL_POST",
  social_graphic: "SOCIAL_POST",
  advertisement: "ADVERTISEMENT",
  ad_creative: "ADVERTISEMENT",
  marketing_creative: "ADVERTISEMENT",
  banner_ad: "ADVERTISEMENT",
  portrait: "PORTRAIT",
  headshot: "PORTRAIT",
  editorial_portrait: "PORTRAIT",
  cinematic: "CINEMATIC",
  film_still: "CINEMATIC",
  cinematic_scene: "CINEMATIC",
};

export function detectIntent(prompt: string, creativeType?: string): DetectedIntent {
  // If the enhance-prompt pipeline already classified the intent, trust it.
  if (creativeType) {
    const normalized = creativeType.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const mapped = CREATIVE_TYPE_MAP[normalized];
    if (mapped) {
      return { category: mapped, confidence: "high", signals: [`creative_type:${creativeType}`] };
    }
  }

  // Keyword scan over the raw user prompt.
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    const matches = prompt.match(new RegExp(pattern, "gi"));
    if (matches) {
      const signals = [...new Set(matches.map((m) => m.trim().toLowerCase()))].slice(0, 3);
      return {
        category,
        confidence: signals.length >= 2 ? "high" : "medium",
        signals,
      };
    }
  }

  return { category: "GENERAL", confidence: "low", signals: [] };
}
