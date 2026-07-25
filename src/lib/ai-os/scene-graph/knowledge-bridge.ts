import {
  RESTAURANT_BEHAVIOURS, RESTAURANT_SCENE_TYPES, RESTAURANT_EMOTIONAL_MOMENTS,
  DENTAL_BEHAVIOURS, DENTAL_SCENE_TYPES, DENTAL_EMOTIONAL_MOMENTS,
  SALON_BEHAVIOURS, SALON_SCENE_TYPES, SALON_EMOTIONAL_MOMENTS,
  JEWELLERY_BEHAVIOURS, JEWELLERY_SCENE_TYPES, JEWELLERY_EMOTIONAL_MOMENTS,
  HOSPITAL_BEHAVIOURS, HOSPITAL_SCENE_TYPES, HOSPITAL_EMOTIONAL_MOMENTS,
  INTERIOR_DESIGN_BEHAVIOURS, INTERIOR_DESIGN_SCENE_TYPES, INTERIOR_DESIGN_EMOTIONAL_MOMENTS,
  REAL_ESTATE_BEHAVIOURS, REAL_ESTATE_SCENE_TYPES, REAL_ESTATE_EMOTIONAL_MOMENTS,
  FURNITURE_BEHAVIOURS, FURNITURE_SCENE_TYPES, FURNITURE_EMOTIONAL_MOMENTS,
  SCHOOL_BEHAVIOURS, SCHOOL_SCENE_TYPES, SCHOOL_EMOTIONAL_MOMENTS,
  RETAIL_BEHAVIOURS, RETAIL_SCENE_TYPES, RETAIL_EMOTIONAL_MOMENTS,
  GENERIC_BEHAVIOURS, GENERIC_SCENE_TYPES, GENERIC_EMOTIONAL_MOMENTS,
} from "../creative-knowledge";
import type { BehaviourKnowledgeNode, SceneTypeKnowledgeNode, EmotionalMomentKnowledgeNode } from "../creative-knowledge";
import type { SceneIndustry } from "../prompt-spec/scene-builder";
import { pick } from "./seed";

// Phase 10.6B — Knowledge Bridge.
//
// "Use existing intelligence: Knowledge" — this module is the sole bridge
// between the Scene Graph Compiler and creative-knowledge/'s per-industry
// behaviour banks. It deliberately never surfaces a KnowledgeNode's full
// prose field (`description`, `environment`, `moment`) as final output —
// those are hand-written editorial sentences and re-emitting them verbatim
// would be exactly the "static clause" the brief prohibits. Instead it
// extracts short, composable signal fragments (`tags`, `emotionalSignal`,
// `mood`, `emotionType`) that the builders blend with their OWN vocabulary
// axes. The knowledge bank decides *what is thematically plausible*; the
// builders decide *what specific words appear*.

const BEHAVIOURS: Record<SceneIndustry, readonly BehaviourKnowledgeNode[]> = {
  restaurant: RESTAURANT_BEHAVIOURS, dental: DENTAL_BEHAVIOURS, salon: SALON_BEHAVIOURS,
  jewellery: JEWELLERY_BEHAVIOURS, hospital: HOSPITAL_BEHAVIOURS, interior: INTERIOR_DESIGN_BEHAVIOURS,
  "real-estate": REAL_ESTATE_BEHAVIOURS, furniture: FURNITURE_BEHAVIOURS, school: SCHOOL_BEHAVIOURS,
  retail: RETAIL_BEHAVIOURS, generic: GENERIC_BEHAVIOURS,
};

const SCENE_TYPES: Record<SceneIndustry, readonly SceneTypeKnowledgeNode[]> = {
  restaurant: RESTAURANT_SCENE_TYPES, dental: DENTAL_SCENE_TYPES, salon: SALON_SCENE_TYPES,
  jewellery: JEWELLERY_SCENE_TYPES, hospital: HOSPITAL_SCENE_TYPES, interior: INTERIOR_DESIGN_SCENE_TYPES,
  "real-estate": REAL_ESTATE_SCENE_TYPES, furniture: FURNITURE_SCENE_TYPES, school: SCHOOL_SCENE_TYPES,
  retail: RETAIL_SCENE_TYPES, generic: GENERIC_SCENE_TYPES,
};

const EMOTIONAL_MOMENTS: Record<SceneIndustry, readonly EmotionalMomentKnowledgeNode[]> = {
  restaurant: RESTAURANT_EMOTIONAL_MOMENTS, dental: DENTAL_EMOTIONAL_MOMENTS, salon: SALON_EMOTIONAL_MOMENTS,
  jewellery: JEWELLERY_EMOTIONAL_MOMENTS, hospital: HOSPITAL_EMOTIONAL_MOMENTS, interior: INTERIOR_DESIGN_EMOTIONAL_MOMENTS,
  "real-estate": REAL_ESTATE_EMOTIONAL_MOMENTS, furniture: FURNITURE_EMOTIONAL_MOMENTS, school: SCHOOL_EMOTIONAL_MOMENTS,
  retail: RETAIL_EMOTIONAL_MOMENTS, generic: GENERIC_EMOTIONAL_MOMENTS,
};

export interface KnowledgeSignal {
  /** Short keyword tags pooled from the selected behaviour + scene-type + emotional-moment nodes. */
  tags: string[];
  /** The behaviour node's short emotional-signal label (e.g. "perfectionism", "trust"), when one was selected. */
  emotionalSignal?: string;
  /** The scene-type node's short mood label, when one was selected. */
  mood?: string;
  /** The scene-type node's short lighting-character label, when one was selected. */
  lightingCharacter?: string;
  /** Source node ids, kept for test/debug traceability — never rendered. */
  sourceIds: string[];
}

function safeIndustry(industry: string): SceneIndustry {
  return (industry in BEHAVIOURS ? industry : "generic") as SceneIndustry;
}

/**
 * Deterministically select one behaviour + one scene-type + one emotional-moment
 * node for this industry (optionally narrowed to a compatible hero archetype),
 * and pool their short signal fields. Pure, synchronous — same seed always
 * selects the same nodes.
 */
export function getKnowledgeSignal(industry: string, heroArchetype: string, seed: number): KnowledgeSignal {
  const ind = safeIndustry(industry);
  const behaviours = BEHAVIOURS[ind];
  const sceneTypes = SCENE_TYPES[ind];
  const emotionalMoments = EMOTIONAL_MOMENTS[ind];

  const matchingBehaviours = behaviours.filter((b) => b.compatibleHeroes.includes(heroArchetype));
  const behaviourPool = matchingBehaviours.length > 0 ? matchingBehaviours : behaviours;

  const matchingScenes = sceneTypes.filter((s) => s.compatibleHeroTypes.includes(heroArchetype));
  const scenePool = matchingScenes.length > 0 ? matchingScenes : sceneTypes;

  const tags = new Set<string>();
  const sourceIds: string[] = [];
  let emotionalSignal: string | undefined;
  let mood: string | undefined;
  let lightingCharacter: string | undefined;

  if (behaviourPool.length > 0) {
    const b = pick(behaviourPool, seed);
    for (const t of b.tags) tags.add(t);
    emotionalSignal = b.emotionalSignal;
    sourceIds.push(b.id);
  }
  if (scenePool.length > 0) {
    const s = pick(scenePool, seed >>> 3);
    for (const t of s.tags) tags.add(t);
    mood = s.mood;
    lightingCharacter = s.lightingCharacter;
    sourceIds.push(s.id);
  }
  if (emotionalMoments.length > 0) {
    const e = pick(emotionalMoments, seed >>> 5);
    for (const t of e.tags) tags.add(t);
    for (const v of e.visualSignals.slice(0, 2)) tags.add(v);
    sourceIds.push(e.id);
  }

  return { tags: [...tags], emotionalSignal, mood, lightingCharacter, sourceIds };
}

/** True when any of the signal's tags contains one of the given keywords (substring match, case-insensitive). */
export function signalHasAny(signal: KnowledgeSignal, keywords: readonly string[]): boolean {
  const hay = signal.tags.join(" ").toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}
