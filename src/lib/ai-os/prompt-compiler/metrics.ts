import type { PromptMetrics } from "./types";
import { countEnumLeaks, hasBrokenPunctuation } from "./enum-language";
import { containsBannedLanguage } from "./banned-language";

// Phase 10.6A — Prompt metrics.
// Same word-list-based heuristic classification used throughout the Phase
// 10.5 audit series (10.5B/10.5D), productionised here so before/after
// compilation quality can be measured the same way it was audited.

const VISUAL_NOUNS = new Set(["chef","patient","dentist","doctor","specialist","professional","client","customer",
"guest","family","sommelier","stylist","jeweller","builder","consultant","hand","eye","smile","mirror","ring","dish",
"plate","garnish","wine","glass","cookware","kitchen","clinic","chair","instrument","scan","screen","tablet","salon",
"product","bottle","tool","gemstone","diamond","villa","key","door","table","tray","counter","window","light","floor",
"room","showroom","interior","staff","apron","uniform","dress","garment","fabric","material","texture","surface",
"brass","copper","marble","plant","flower","camera","lens","implant","building","property","apartment","garden",
"pool","terrace","balcony","facade","wall","station","food","person","people","face","skin","walnut","stone",
"crystal","cutlery","velvet","candle","seating","reception","desk",
// Camera / composition / framing vocabulary
"angle","frame","framing","shot","lens","perspective","distance","height","position","viewpoint","zoom","closeup",
"close-up","composition","symmetry","balance","thirds","diagonal","silhouette","foreground","midground","background",
"depth","layer","layers","focus","blur","viewfinder","horizon","tilt","profile",
// Lighting / material / colour vocabulary
"shadow","shadows","glow","reflection","reflections","highlight","backlight","glare","sunlight","daylight","dusk",
"dawn","glass","chrome","steel","leather","linen","silk","cotton","ceramic","porcelain","gold","silver","platinum",
"gemstone","wood","wooden","tile","gradient","tone","palette","hue","accent",
// Environment / architecture
"column","archway","doorway","ceiling","staircase","pillar","courtyard","hallway","corridor","skyline","street",
"pavement","rooftop","balustrade","fountain",
// People / body detail
"gaze","posture","gesture","expression","silhouette","fingers","shoulder","glance","visible",
// Common misses surfaced by direct inspection of real compiled output
"environment","background","product","steam","ambient","corner","lighting","area","zone","image",
"placeholder","icon","icons","badge","certificate","credential"]);
const VISUAL_VERBS = new Set(["plates","pours","walks","speaks","laughs","smiles","holds","rotates","presents",
"hands","adjusts","leans","applauds","reviews","examines","places","garnishing","steadies","removes","sees","shows",
"catches","dances","streams","reflects","wears","stands","sits","gestures","points","displays","hangs","maintaining",
"explaining","serving","positioned","angled","framed","lit","illuminated","captured","rendered","weighted","filled",
"filling","occupying","centred","anchored","radiating","glowing","casting","revealing"]);
const ATMOSPHERE_WORDS = new Set(["premium","luxury","warm","elegant","aspirational","atmosphere","ambience",
"intimate","dramatic","cinematic","editorial","authentic","natural","soft","hard","dominant","subtle","genuine",
"golden","clinical","bright","even","directional","commercial","professional","photorealistic","stylised"]);
// Image-generation quality/defect vocabulary — the AVOID/artifact-prevention lists are
// concrete, actionable rendering instructions (confirmed 100% renderable in the Phase
// 10.5B audit) but use specialised words this list wouldn't otherwise recognise.
const RENDERING_QUALITY_WORDS = new Set(["cartoon","plastic","anatomy","distorted","proportions","watermark",
"watermarks","artifact","artifacts","blurry","oversaturated","saturated","vignette","vignettes","glistening",
"cgi","texture","textures","resolution","grain","noise","exposure","sharp","sharpness","crisp","grainy",
"pixelated","render","rendered","rendering","photorealistic","hyperrealistic","realistic","lifelike"]);
// Closed-class function words: prepositions/adverbs that connect content
// together without being content themselves. Excluded from the denominator
// so the ratio measures content-word quality, not grammatical scaffolding.
const STOPWORDS = new Set(["the","a","an","and","or","but","with","this","that","from","into","onto","their","its",
"his","her","who","while","being","never","always","near","just","only","then","than","also","of","in","on","at",
"to","is","are","was","were","been","not","as","for","by","it","they","them","he","she","we","you","i","be","have",
"has","had","do","does","did","will","would","can","could","should","within","about","below","above","beside",
"toward","towards","directly","clearly","must","no","not","each","every","any","all","some","such"]);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 0);
}
function singularize(w: string): string {
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("es")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

function classifySentence(sentence: string, seenNormalized: string[]): "A" | "C" | "D" {
  const norm = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  for (const prior of seenNormalized) {
    if (prior === norm) return "D";
    const a = new Set(prior.split(" ")), b = new Set(norm.split(" "));
    if (a.size > 3 && b.size > 3) {
      let shared = 0;
      for (const w of b) if (a.has(w)) shared++;
      if (shared / Math.max(a.size, b.size) >= 0.7) return "D";
    }
  }
  const tokens = tokenize(sentence);
  const visualHits = tokens.filter((t) => VISUAL_NOUNS.has(t) || VISUAL_NOUNS.has(singularize(t)) || VISUAL_VERBS.has(t)).length;
  const atmosphereHits = tokens.filter((t) => ATMOSPHERE_WORDS.has(t)).length;
  const qualityHits = tokens.filter((t) => RENDERING_QUALITY_WORDS.has(t)).length;
  if (visualHits > 0 || atmosphereHits > 0 || qualityHits > 0) return "A";
  return "C";
}

export function measurePrompt(text: string): PromptMetrics {
  const tokens = tokenize(text).filter((t) => !STOPWORDS.has(t));
  const sentences = splitSentences(text);
  const seen: string[] = [];
  let renderable = 0, abstract = 0, duplicate = 0;
  for (const s of sentences) {
    const cls = classifySentence(s, seen);
    seen.push(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim());
    if (cls === "A") renderable++; else if (cls === "D") duplicate++; else abstract++;
  }
  const total = sentences.length || 1;

  const visualTokenHits = tokens.filter((t) =>
    VISUAL_NOUNS.has(t) || VISUAL_NOUNS.has(singularize(t)) || VISUAL_VERBS.has(t) ||
    ATMOSPHERE_WORDS.has(t) || RENDERING_QUALITY_WORDS.has(t)
  ).length;
  const totalTokens = tokens.length || 1;

  return {
    wordCount: tokenize(text).length,
    sentenceCount: sentences.length,
    charCount: text.length,
    visualTokenRatio: Math.round((visualTokenHits / totalTokens) * 1000) / 10,
    renderablePct: Math.round((renderable / total) * 1000) / 10,
    abstractPct: Math.round((abstract / total) * 1000) / 10,
    duplicatePct: Math.round((duplicate / total) * 1000) / 10,
    promptEfficiency: Math.round((visualTokenHits / totalTokens) * 1000) / 10,
  };
}

export function meetsTargets(after: PromptMetrics, fullText: string) {
  return {
    visualTokenRatioOver70: after.visualTokenRatio > 70,
    duplicateUnder2: after.duplicatePct < 2,
    abstractUnder20: after.abstractPct < 20,
    noEnumLeakage: countEnumLeaks(fullText) === 0,
    noBrokenPunctuation: !hasBrokenPunctuation(fullText),
    noBannedLanguage: !containsBannedLanguage(fullText),
  };
}
