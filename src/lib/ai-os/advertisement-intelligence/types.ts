// Phase 10.4J — Advertisement Intelligence Translator types.
//
// The Advertisement Intelligence Layer converts invisible marketing signals
// (psychology, trust, authority, identity, urgency, scarcity, social proof)
// into SPECIFIC VISIBLE VISUAL ELEMENTS that make an image a high-converting
// advertisement — not just a beautiful picture.
//
// Principle: The scene's marketing intent must be legible without any copy.
//   Instead of "beautiful food" → "proposal dinner moment: couple sharing
//   a first course as champagne arrives — the beginning of the occasion"
//
// Rules, not lookup tables. Works for any industry.

// ── Story Archetype ───────────────────────────────────────────────────────────

/**
 * The master narrative template governing the entire scene.
 * Each archetype encodes a specific marketing mechanism as a visual story.
 * Industry-agnostic — driven by psychological and marketing signals.
 */
export type StoryArchetype =
  | "expert_in_action"       // Authority demonstrating mastery — trust through process visibility
  | "transformation_proof"   // Before/after or result moment — claim proved, not stated
  | "intimate_occasion"      // Specific meaningful occasion — romance, milestone, gifting moment
  | "social_celebration"     // Group or family moment — belonging and warmth
  | "aspiration_world"       // The life they want to enter — desire and identity confirmation
  | "exclusive_access"       // Private or VIP experience — luxury, scarcity, invitation-only
  | "insight_discovery"      // Learning or reveal moment — education and clarity
  | "comfort_assurance"      // Care and gentleness — safety, ease, and reassurance
  | "trust_reveal"           // Ambient credibility — proof present without being announced
  | "milestone_achievement"  // Peak moment of accomplishment — pride and deserved outcome
  | "ownership_pride"        // Subject with the product — identity confirmation
  | "process_transparency";  // Behind-the-scenes craft — authenticity through visibility

// ── Advertisement Narrative ───────────────────────────────────────────────────

/**
 * The complete advertisement narrative produced by the intelligence layer.
 * Every field is a specific, actionable directive for the image generator.
 * Fields are plain strings — the translator wraps them into prompt structure.
 *
 * Key contract: these directives are MORE specific than the hero subject
 * description because they encode MARKETING INTENT into SCENE SPECIFICS.
 *
 * Example (dental, authority, high trust):
 *   storyScenario:   "Specialist at chairside showing patient their scan — the moment doubt dissolves"
 *   emotionalMoment: "The patient's expression shifting from apprehension to understanding"
 *   proofElement:    "Framed certification visible on the wall, specialist attire and branded equipment"
 *   identitySignal:  "A person who cares enough about their health to choose expertise over price"
 *   conversionMoment:"The viewer thinks: this is who I want doing this for me — and I should call today"
 */
export interface AdvertisementNarrative {
  /** The specific story scenario: what is HAPPENING in this image, not what is shown */
  storyScenario:     string;
  /** The dominant emotional moment to capture — the precise beat of the story */
  emotionalMoment:   string;
  /** What credibility or proof is visually present in the frame (ambient, not staged) */
  proofElement?:     string;
  /** What customer objection this scene pre-handles without stating it */
  objectionCounter?: string;
  /** Who the viewer sees themselves becoming through this image */
  identitySignal:    string;
  /** The urgency or desire-to-act signal made visible in the scene */
  urgencyVisual?:    string;
  /** What the viewer should feel compelled to do or believe after seeing this */
  conversionMoment:  string;
  /** The narrative archetype governing this creative */
  storyArchetype:    StoryArchetype;
  /** Specific story enrichment tags that refine the scenario and block generic outputs */
  enrichmentTags:    string[];
}
