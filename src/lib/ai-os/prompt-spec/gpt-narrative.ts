// Phase 5.5 — Provider Prompt Optimization.
//
// buildNarrativePrompt() compresses the GPTCampaignDirection into a
// professional advertising shoot brief at 500–700 final tokens.
//
// Optimization rules applied:
//   1. Drop non-visual fields (campaignConcept, marketingObjective,
//      psychologicalGoal, narrative — none can be photographed).
//   2. Drop visualStory.before — past context, not in-frame.
//   3. Abstract emotion → visible expression: "Subjects convey: X."
//   4. Priority-labelled structure: P1 Hero / P2 Interaction /
//      P3 Environment / P4 Atmosphere.
//   5. Arrays compressed to comma lists; repeated concepts merged.
//   6. mustAvoid written once here; translator skips section-based
//      negatives when GPT narrative is active.
//
// validatePromptQuality() is the quality gate unchanged from Phase 5.4.

import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { GPTNarrativeSection, PromptQualityCheck, PromptQualityResult } from "./types";
import { runDesignIntelligenceLayer, DESIGN_INTELLIGENCE_LAYER_ENABLED } from "../design-layer";
import { buildSceneBlueprint } from "./scene-builder";
import { applyRealismVocabulary, getIndustryPhysicsNote } from "./realism-engine";
import { detectMaterialTier, getMaterialDescriptions } from "./material-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Quality validation — Change 6
// ─────────────────────────────────────────────────────────────────────────────

function check(
  name:   string,
  passed: boolean,
  reason: string,
): PromptQualityCheck {
  return { name, passed, reason };
}

function isPresent(v: string | undefined | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasItems(arr: string[] | undefined): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

export function validatePromptQuality(dir: GPTCampaignDirection): PromptQualityResult {
  const checks: PromptQualityCheck[] = [
    check(
      "hero_subject",
      isPresent(dir.heroSubject),
      dir.heroSubject ? "heroSubject is present and non-empty" : "heroSubject is missing or empty",
    ),
    check(
      "story",
      isPresent(dir.visualStory?.moment) && isPresent(dir.visualStory?.before) && isPresent(dir.visualStory?.after),
      dir.visualStory?.moment ? "visualStory (before/moment/after) is present" : "visualStory fields are missing",
    ),
    check(
      "marketing_objective",
      isPresent(dir.marketingObjective),
      dir.marketingObjective ? "marketingObjective is present" : "marketingObjective is missing",
    ),
    check(
      "emotion",
      isPresent(dir.viewerEmotion),
      dir.viewerEmotion ? "viewerEmotion is present" : "viewerEmotion is missing",
    ),
    check(
      "composition",
      isPresent(dir.compositionIntent?.eyeFlow) && isPresent(dir.compositionIntent?.framingLogic),
      dir.compositionIntent?.eyeFlow ? "compositionIntent fields are present" : "compositionIntent is missing or incomplete",
    ),
    check(
      "negative_space",
      isPresent(dir.negativeSpace?.headline) && isPresent(dir.negativeSpace?.cta),
      dir.negativeSpace?.headline ? "negativeSpace (headline/cta/logo) is present" : "negativeSpace fields are missing",
    ),
    check(
      "must_avoid",
      hasItems(dir.mustAvoid),
      dir.mustAvoid?.length ? `mustAvoid has ${dir.mustAvoid.length} item(s)` : "mustAvoid is empty or missing",
    ),
  ];

  const passedCount  = checks.filter(c => c.passed).length;
  const failedChecks = checks.filter(c => !c.passed).map(c => c.name);
  const score        = Math.round((passedCount / checks.length) * 100);

  let status: PromptQualityResult["status"];
  if (passedCount === checks.length) {
    status = "valid";
  } else if (passedCount >= 5) {
    status = "partial";
  } else {
    status = "failed";
  }

  return { status, score, checks, failedChecks };
}

// ─── Compression helpers ─────────────────────────────────────────────────────
//
// GPT-CD writes 2–4 sentences per field. Image generation needs only the
// first dense visual sentence. These helpers extract the essential part.

// First complete sentence (ends at . ! ?).
// The negative-lookahead (?!\d) prevents splitting on decimals like "f/2.2".
function firstSentence(s: string): string {
  const m = s.trim().match(/^.+?[.!?](?!\d)/);
  return m ? m[0].trim() : s.trim();
}

// First clause — everything before an em-dash elaboration.
// "Upper-left: clean white — because the clinic..." → "Upper-left: clean white"
function firstClause(s: string): string {
  const t   = s.trim();
  const idx = t.indexOf(" — ");
  if (idx > 20) return t.slice(0, idx).trim();
  return firstSentence(t);
}

// First N complete sentences, joined and whitespace-normalised.
function firstNSentences(s: string, n: number): string {
  const ms = s.trim().match(/[^.!?]+[.!?]+/g) ?? [s.trim()];
  return ms.slice(0, n).join(" ").replace(/\s{2,}/g, " ").trim();
}

// Strip trailing period so ". " join never doubles up.
function trimPeriod(s: string): string {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}

// Trim period before appending to a joined list.
function tp(s: string): string { return trimPeriod(s); }

// ─── Narrative builder (Phase 5.5) ───────────────────────────────────────────

export function buildNarrativePrompt(dir: GPTCampaignDirection): string {
  const parts: string[] = [];
  const add = (s: string | undefined | null) => {
    const t = s?.trim();
    if (t) parts.push(t);
  };

  // ── SCENE ─────────────────────────────────────────────────────────────────
  // Location hook (1 sentence) + setting identifier (1 sentence), merged.
  // Dropped: campaignConcept, marketingObjective — not photographable.
  const scene = trimPeriod(firstSentence(dir.sceneDescription));
  const env   = isPresent(dir.environment) ? firstSentence(dir.environment!) : null;
  add(env ? `${scene}. ${env}` : `${scene}.`);

  // ── P1 — HERO ─────────────────────────────────────────────────────────────
  // Subject (1 sentence = the essential visual description) + camera framing.
  // Sentences 2–N of heroSubject repeat or emotionally amplify — dropped.
  if (isPresent(dir.heroSubject)) {
    const hero    = firstSentence(dir.heroSubject!);
    const framing = dir.compositionIntent?.framingLogic;
    add(isPresent(framing)
      ? `P1 — ${hero} ${firstSentence(framing!)}`
      : `P1 — ${hero}`
    );
  }

  // ── P2 — HUMAN INTERACTION ────────────────────────────────────────────────
  // Secondary subject (1 sentence) + captured moment (1 sentence).
  // Dropped: visualStory.before (backstory) and .after (future state).
  // The .moment IS the photograph.
  const p2Parts: string[] = [];
  if (isPresent(dir.secondarySubjects))   p2Parts.push(tp(firstSentence(dir.secondarySubjects!)));
  if (isPresent(dir.visualStory?.moment)) p2Parts.push(tp(firstSentence(dir.visualStory!.moment)));
  if (p2Parts.length) add(`P2 — ${p2Parts.join(". ")}.`);

  // ── P3 — SUPPORTING ENVIRONMENT ──────────────────────────────────────────
  // 2 key props + layout zones compressed to location clause only.
  // Dropped: visualHierarchy — redundant with P1/P2/P3 structure.
  // firstClause strips the lengthy "— because …" elaborations from NS zones.
  const p3Parts: string[] = [];
  if (isPresent(dir.supportingObjects)) {
    p3Parts.push(tp(firstNSentences(dir.supportingObjects!, 2)));
  }
  const ns = dir.negativeSpace;
  if (ns) {
    [ns.headline, ns.cta, ns.logo].forEach(z => {
      if (isPresent(z)) p3Parts.push(tp(firstClause(z!)));
    });
  }
  if (p3Parts.length) add(`P3 — ${p3Parts.join(". ")}.`);

  // ── COMPOSITION ───────────────────────────────────────────────────────────
  // Eye flow + subject balance — 1 sentence each. framingLogic already in P1.
  const comp = dir.compositionIntent;
  if (comp) {
    const cds: string[] = [];
    if (isPresent(comp.eyeFlow))        cds.push(tp(firstSentence(comp.eyeFlow!)));
    if (isPresent(comp.subjectBalance)) cds.push(tp(firstSentence(comp.subjectBalance!)));
    if (cds.length) add(cds.join(". ") + ".");
  }

  // ── P4 — ATMOSPHERE ───────────────────────────────────────────────────────
  // Lighting key directive (1 sentence) + dominant color story (1 sentence).
  const p4Parts: string[] = [];
  if (isPresent(dir.lightingMood))    p4Parts.push(tp(firstSentence(dir.lightingMood!)));
  if (isPresent(dir.colorPsychology)) p4Parts.push(tp(firstSentence(dir.colorPsychology!)));
  if (p4Parts.length) add(`P4 — ${p4Parts.join(". ")}.`);

  // ── VISUAL REGISTER ───────────────────────────────────────────────────────
  // Photography style reference — 1 sentence names the visual tier.
  // Dropped: narrative — abstract story arc, not photographable.
  if (isPresent(dir.commercialStyle)) add(firstClause(dir.commercialStyle!));

  // ── VISIBLE DETAILS ───────────────────────────────────────────────────────
  // Trust credentials + micro details, each compressed to first clause.
  // All are visible, in-frame elements merged into one line.
  const details: string[] = [
    ...(dir.trustTriggers    ?? []).map(firstClause),
    ...(dir.microInteractions ?? []).map(firstClause),
  ].filter(Boolean);
  if (details.length) add(details.join(". ") + ".");

  // ── COMMERCIAL SIGNALS ────────────────────────────────────────────────────
  // Triggers → compact list. 4× shorter than "This image activates X and Y."
  if (hasItems(dir.marketingTriggers)) {
    add(`Signals: ${dir.marketingTriggers.join(", ")}.`);
  }

  // ── VISIBLE EXPRESSION ────────────────────────────────────────────────────
  // viewerEmotion → physical state on subjects (photographable).
  // Dropped: "Every visual decision exists to make the viewer feel X."
  // Dropped: psychologicalGoal — invisible mental shift.
  if (isPresent(dir.viewerEmotion)) {
    add(`Subjects convey: ${dir.viewerEmotion}.`);
  }

  // ── MANDATE ───────────────────────────────────────────────────────────────
  if (isPresent(dir.coreMessage))  add(`Mandate: ${dir.coreMessage}.`);
  if (hasItems(dir.mustInclude))   add(`Include: ${dir.mustInclude.join(", ")}.`);

  // ── CONSTRAINTS — ONCE ONLY ───────────────────────────────────────────────
  if (hasItems(dir.mustAvoid)) add(`Never: ${dir.mustAvoid.join(", ")}.`);

  return parts.join(" ");
}

// ─── Deduplication helpers (Phase 10.3B) ─────────────────────────────────────
//
// Concept registry: first-registered (higher-priority) entries win.
// Before each block is added, its content is checked against all previously
// registered content — if overlap exceeds the threshold, the candidate is skipped.

/** Stopwords excluded from concept overlap checks. */
const DEDUP_STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "are", "not", "was",
  "but", "have", "been", "will", "they", "into", "her", "his", "its", "you",
  "who", "how", "what", "when", "more", "than", "just", "very",
]);

/** Nationality/demonym and generic-adjective words excluded from hero-identifier
 *  extraction — these appear in both hero descriptions and environment copy. */
const HERO_ID_EXCLUSIONS = new Set([
  "indian", "american", "european", "asian", "chinese", "french", "italian",
  "korean", "japanese", "british", "arabic",
  "calm", "warm", "soft", "gentle", "modern", "classic", "bright", "dark",
  "clean", "fresh", "rich", "deep", "light", "young", "beautiful", "elegant",
  "premium", "luxury", "traditional", "contemporary",
]);

/** Split text into individual sentences. */
function toSentences(s: string): string[] {
  return (s.trim().match(/[^.!?]+[.!?]+/g) ?? [s.trim()]).map(t => t.trim()).filter(Boolean);
}

/** Extract content words (length > 3, not a stopword) from a string. */
function contentWords(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !DEDUP_STOPWORDS.has(w));
}

/**
 * True if candidate overlaps significantly with any entry in the registry.
 * Threshold: ≥ 4 shared content words, OR ≥ 60 % of the candidate's content words.
 */
function isDuplicate(candidate: string, registry: string[]): boolean {
  const cw = contentWords(candidate);
  if (cw.length < 2) return false;
  const threshold = Math.max(4, Math.ceil(cw.length * 0.6));
  const cwSet = new Set(cw);
  for (const registered of registry) {
    const overlap = contentWords(registered).filter(w => cwSet.has(w)).length;
    if (overlap >= threshold) return true;
  }
  return false;
}

/**
 * Extract the first 5 non-generic content words from heroSubject for use as
 * scene-description filters. Nationalities and common adjectives are excluded
 * because they appear in both hero and environment copy.
 */
function heroIdentifierWords(heroSubject: string): Set<string> {
  return new Set(
    contentWords(heroSubject)
      .filter(w => !HERO_ID_EXCLUSIONS.has(w))
      .slice(0, 5),
  );
}

/**
 * Return only the sentences from text that do NOT repeat the hero subject.
 * A sentence is hero-repeating if ANY hero identifier word appears in it.
 * Keeps only pure environment / atmosphere sentences.
 */
function environmentOnlySentences(text: string, heroSubject: string): string[] {
  const heroIds = heroIdentifierWords(heroSubject);
  return toSentences(text).filter(s => {
    const sw = new Set(contentWords(s));
    return !Array.from(heroIds).some(w => sw.has(w));
  });
}

// ─── Image-Native Prompt Builder (Phase 10.3A/10.3B) ─────────────────────────
//
// Produces labeled visual-directive blocks instead of a paragraph-first screenplay.
// Phase 10.3B adds: cross-block deduplication, hero-only filtering for sceneDescription,
// and merging of Environment + Lighting + Color into a single SCENE ATMOSPHERE block.
//
// Block order (priority-enforced — higher layers are never overwritten by lower ones):
//   PRIMARY HERO MOMENT → PRIMARY ACTION → VISIBLE EMOTION → SECONDARY SUBJECTS
//   → SCENE ATMOSPHERE (env + lighting + color, merged) → CAMERA
//   → TYPOGRAPHY SAFE SPACE → NEGATIVE PROMPT
//
// Rules:
//   1. Every visual concept appears exactly once — priority order wins on conflict.
//   2. sceneDescription contributes only env-only sentences (no hero repetition).
//   3. Environment + Lighting + Color merge into one SCENE ATMOSPHERE block.
//   4. Output is fully deterministic: same GPTCampaignDirection → same string every run.

export function buildImageNativePrompt(dir: GPTCampaignDirection): string {
  const blocks: string[] = [];
  // Concept registry — array (not Set) preserves insertion order → determinism.
  // First registered (highest priority) wins; lower-priority blocks deduplicate against it.
  const registry: string[] = [];

  const reg     = (text: string)            => { if (text.trim()) registry.push(text); };
  const notDup  = (text: string): boolean   => !isDuplicate(text, registry);

  // ── Compute scene blueprint — used by BACKGROUND ACTIVITY, SCENE, CAMERA ───
  // Phase 10.4L: SCENE block is positioned after hero sections (see below).
  // Phase 10.3C placed it first; that made environment dominate early tokens.
  const scene = buildSceneBlueprint(dir);
  const realismSceneContext = applyRealismVocabulary(scene.sceneContext);

  // ── PRIMARY HERO MOMENT — first HERO directive ─────────────────────────────
  // Phase 10.4L: Hero is block 0. Image models weight early tokens most heavily;
  // the hero must be the dominant concept from the very first token.
  if (isPresent(dir.heroSubject)) {
    const hero = dir.heroSubject!.trim();
    blocks.push(`PRIMARY HERO MOMENT\n${hero}`);
    reg(hero);
  }

  // ── PRIMARY ACTION — deduplicated against hero ──────────────────────────────
  if (isPresent(dir.visualStory?.moment)) {
    const moment = firstSentence(dir.visualStory!.moment);
    if (notDup(moment)) {
      blocks.push(`PRIMARY ACTION\n${moment}`);
      reg(moment);
    }
  }

  // ── VISIBLE EMOTION ─────────────────────────────────────────────────────────
  if (isPresent(dir.viewerEmotion)) {
    const emotion = dir.viewerEmotion!.trim();
    if (notDup(emotion)) {
      blocks.push(`VISIBLE EMOTION\n${emotion}`);
      reg(emotion);
    }
  }

  // ── CAMPAIGN MANDATE — the single most important message to communicate ──────
  // Phase 10.4K.3: was in buildNarrativePrompt, accidentally dropped here.
  if (isPresent(dir.coreMessage)) {
    const msg = firstSentence(dir.coreMessage!);
    if (notDup(msg)) {
      blocks.push(`CAMPAIGN MANDATE\n${msg}`);
      reg(msg);
    }
  }

  // ── SECONDARY SUBJECTS — per-sentence deduplication ────────────────────────
  if (isPresent(dir.secondarySubjects)) {
    const subs = firstNSentences(dir.secondarySubjects!, 2);
    const kept = toSentences(subs).filter(notDup);
    kept.forEach(reg);
    if (kept.length) {
      blocks.push(`SECONDARY SUBJECTS\n${kept.join(" ")}`);
    }
  }

  // ── SUPPORTING OBJECTS — props and details that reinforce the narrative ──────
  // Phase 10.4K.3: was in buildNarrativePrompt, accidentally dropped here.
  if (isPresent(dir.supportingObjects)) {
    const objs = firstNSentences(dir.supportingObjects!, 2);
    const kept = toSentences(objs).filter(notDup);
    kept.forEach(reg);
    if (kept.length) {
      blocks.push(`SUPPORTING DETAILS\n${kept.join(" ")}`);
    }
  }

  // ── BACKGROUND ACTIVITY — meaningful mid/background (Phase 10.3C) ──────────
  // Never "blurred background". Always a specific visual activity that enriches
  // the scene without competing with the hero. Generated by the Scene Builder
  // based on industry + hero type.
  if (notDup(scene.backgroundActivity)) {
    blocks.push(`BACKGROUND ACTIVITY\n${scene.backgroundActivity}`);
    reg(scene.backgroundActivity);
  }

  // ── SCENE — industry/realism context (Phase 10.4L: repositioned after hero) ──
  // Placed here so hero sections get higher dedup priority and environment
  // context only appears after the hero and its supporting cast are established.
  blocks.push(`SCENE\n${realismSceneContext}`);
  reg(realismSceneContext);

  // ── SCENE ATMOSPHERE — Environment + Lighting + Color merged ────────────────
  // Rule 3: three separate sources become one labeled block (not three paragraphs).
  // Rule 2: sceneDescription is filtered to env-only sentences before merging.
  //
  // SCENE ATMOSPHERE uses an internal registry so its sources deduplicate against
  // each other — NOT against the hero. Atmospheric vocabulary (chandeliers, steam,
  // amber) can legitimately appear in both the hero description (as context) and the
  // lighting spec (as direction); registering against the outer registry would
  // wrongly suppress it. The assembled parts are registered in the outer registry
  // afterward so lower-priority blocks (CAMERA, details) can still skip redundancy.
  const atmoRegistry: string[] = [];
  const atmoNotDup = (t: string): boolean => !isDuplicate(t, atmoRegistry);
  const atmoReg    = (t: string)           => { if (t.trim()) atmoRegistry.push(t); };
  const atmosphereParts: string[] = [];

  if (isPresent(dir.environment)) {
    const env = firstSentence(dir.environment!);
    if (atmoNotDup(env)) { atmosphereParts.push(env); atmoReg(env); }
  }

  if (isPresent(dir.sceneDescription)) {
    const sceneSentences = isPresent(dir.heroSubject)
      ? environmentOnlySentences(dir.sceneDescription!, dir.heroSubject!)
      : [firstSentence(dir.sceneDescription!)];
    for (const s of sceneSentences) {
      if (atmoNotDup(s)) { atmosphereParts.push(s); atmoReg(s); }
    }
  }

  if (isPresent(dir.lightingMood)) {
    const lighting = applyRealismVocabulary(firstSentence(dir.lightingMood!));
    if (atmoNotDup(lighting)) { atmosphereParts.push(lighting); atmoReg(lighting); }
  }

  if (isPresent(dir.colorPsychology)) {
    const color = applyRealismVocabulary(firstSentence(dir.colorPsychology!));
    if (atmoNotDup(color)) { atmosphereParts.push(color); atmoReg(color); }
  }

  // Phase 10.4A — append industry-specific physical realism note last, deduped
  const physicsNote = getIndustryPhysicsNote(scene.industry);
  if (atmoNotDup(physicsNote)) { atmosphereParts.push(physicsNote); atmoReg(physicsNote); }

  if (atmosphereParts.length) {
    atmosphereParts.forEach(reg); // register in outer registry for downstream dedup
    blocks.push(`SCENE ATMOSPHERE\n${atmosphereParts.join(" ")}`);
  }

  // ── SURFACE MATERIALS — industry + tier specific (Phase 10.4B) ──────────────
  const materialTier = detectMaterialTier(dir);
  const materialDesc = getMaterialDescriptions(scene.industry, materialTier);
  if (notDup(materialDesc)) {
    blocks.push(`SURFACE MATERIALS\n${materialDesc}`);
    reg(materialDesc);
  }

  // ── STYLE DIRECTION — advertising style and creative positioning ────────────
  // Phase 10.4K.3: was in buildNarrativePrompt (Visual Register block), dropped here.
  if (isPresent(dir.commercialStyle)) {
    const style = firstClause(dir.commercialStyle!);
    if (notDup(style)) {
      blocks.push(`STYLE DIRECTION\n${style}`);
      reg(style);
    }
  }

  // ── CAMERA — GPT framing + hero-type framing hint (Phase 10.3C) ────────────
  const camParts: string[] = [];
  if (isPresent(dir.compositionIntent?.framingLogic)) {
    const s = firstSentence(dir.compositionIntent!.framingLogic!);
    if (notDup(s)) { camParts.push(s); reg(s); }
  }
  if (isPresent(dir.compositionIntent?.eyeFlow)) {
    const s = firstSentence(dir.compositionIntent!.eyeFlow!);
    if (notDup(s)) { camParts.push(s); reg(s); }
  }
  // Phase 10.4K.3: subjectBalance was in buildNarrativePrompt COMPOSITION block, dropped here.
  if (isPresent(dir.compositionIntent?.subjectBalance)) {
    const s = firstSentence(dir.compositionIntent!.subjectBalance!);
    if (notDup(s)) { camParts.push(s); reg(s); }
  }
  // Append the scene builder's hero-type-derived framing hint
  if (notDup(scene.framingHint)) { camParts.push(scene.framingHint); reg(scene.framingHint); }
  if (camParts.length) {
    blocks.push(`CAMERA\n${camParts.join(" ")}`);
  }

  // ── TYPOGRAPHY SAFE SPACE ───────────────────────────────────────────────────
  const typoParts: string[] = [];
  const ns = dir.negativeSpace;
  if (ns) {
    if (isPresent(ns.headline)) typoParts.push(`Headline: ${firstClause(ns.headline!)}`);
    if (isPresent(ns.cta))      typoParts.push(`CTA: ${firstClause(ns.cta!)}`);
    if (isPresent(ns.logo))     typoParts.push(`Logo: ${firstClause(ns.logo!)}`);
  }
  if (typoParts.length) {
    blocks.push(`TYPOGRAPHY SAFE SPACE\n${typoParts.join(". ")}`);
  }

  // ── Visible in-frame details — trust signals, micro-interactions, signals ───
  const detailItems: string[] = [
    ...(dir.trustTriggers    ?? []).map(firstClause),
    ...(dir.microInteractions ?? []).map(firstClause),
  ].filter(Boolean).filter(notDup);
  detailItems.forEach(reg);

  const detailLines: string[] = [];
  if (detailItems.length)              detailLines.push(detailItems.join(". ") + ".");
  if (hasItems(dir.marketingTriggers)) detailLines.push(`Signals: ${dir.marketingTriggers!.join(", ")}.`);
  if (detailLines.length) blocks.push(detailLines.join(" "));

  // ── MUST INCLUDE — visual elements that must appear in the frame ─────────────
  // Phase 10.4K.3: was in buildNarrativePrompt MANDATE block, dropped here.
  if (hasItems(dir.mustInclude)) {
    const items = dir.mustInclude!.map(firstClause).filter(notDup);
    items.forEach(reg);
    if (items.length) {
      blocks.push(`MUST INCLUDE\n${items.join(". ")}`);
    }
  }

  // ── NEGATIVE PROMPT ─────────────────────────────────────────────────────────
  if (hasItems(dir.mustAvoid)) {
    blocks.push(`NEGATIVE PROMPT\n${dir.mustAvoid!.join(", ")}`);
  }

  return blocks.filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemble the full GPTNarrativeSection for the PromptSpecification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param dir     The GPT Creative Director output (23 fields).
 * @param strategy When provided and ENABLE_DESIGN_INTELLIGENCE_LAYER=true, the four
 *                 Design Intelligence Directors run and their compiledPrompt replaces
 *                 buildImageNativePrompt(). When absent or DIL is disabled, falls back
 *                 to Phase 10.3A buildImageNativePrompt() (image-native block format).
 */
export function buildGPTNarrativeSection(
  dir: GPTCampaignDirection,
  strategy?: CreativeStrategy,
): GPTNarrativeSection {
  const quality = validatePromptQuality(dir);

  const ALL_FIELDS: (keyof GPTCampaignDirection)[] = [
    "campaignConcept", "marketingObjective", "psychologicalGoal", "viewerEmotion",
    "coreMessage", "heroSubject", "secondarySubjects", "supportingObjects",
    "visualStory", "sceneDescription", "visualHierarchy", "negativeSpace",
    "compositionIntent", "lightingMood", "environment", "colorPsychology",
    "marketingTriggers", "trustTriggers", "microInteractions",
    "mustInclude", "mustAvoid", "commercialStyle", "narrative",
  ];

  const fieldsConsumed: string[] = [];
  const fieldsMissing:  string[] = [];

  for (const key of ALL_FIELDS) {
    const v = dir[key];
    const present = typeof v === "string"
      ? isPresent(v)
      : Array.isArray(v)
      ? hasItems(v as string[])
      : v !== null && v !== undefined && typeof v === "object";
    if (present) fieldsConsumed.push(key);
    else         fieldsMissing.push(key);
  }

  // Phase 8.2 — Design Intelligence Layer wiring.
  // When enabled, the four specialized Directors (Design, Photography, Typography,
  // Layout) run deterministically and the Prompt Compiler assembles their outputs
  // into a professional executive creative brief. This replaces the Phase 5.5
  // buildNarrativePrompt() compression function.
  // Requires strategy to be provided so the Directors can apply industry-specific
  // domain intelligence (luxury levels, camera specs, negative space tables, etc.).
  const narrativePrompt = (DESIGN_INTELLIGENCE_LAYER_ENABLED && strategy)
    ? runDesignIntelligenceLayer({ gptDirection: dir, strategy }).compiledPrompt
    : buildImageNativePrompt(dir);

  return { narrativePrompt, quality, fieldsConsumed, fieldsMissing };
}
