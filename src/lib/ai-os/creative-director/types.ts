import type { StrategyField } from "../types";

// Phase 5 — Creative Director types.
// CampaignPlan is the output contract of the Creative Director. It is the
// complete advertising campaign design: every strategic creative decision
// made BEFORE any prompt is written, any layout is designed, any copy is
// drafted, or any image is generated.
//
// Every field: value | "unknown", confidence, reasoning.
// NO generation happens here. No prompts, no layouts, no copy, no images.
// Only strategic campaign planning.

// ─────────────────────────────────────────────────────────────────────────────
// Domain 1 — Campaign Concept
// The unifying creative idea that anchors the entire campaign.
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignConcept {
  /** The overarching creative theme that ties all campaign elements together. */
  campaignTheme: StrategyField;
  /** The single most important thing this campaign must communicate. */
  coreMessage: StrategyField;
  /** The central creative idea that makes this campaign memorable and distinctive. */
  bigIdea: StrategyField;
  /** The primary psychological trigger the campaign activates in the audience. */
  emotionalHook: StrategyField<"curiosity" | "aspiration" | "fomo" | "empowerment" | "reassurance" | "hope" | "excitement" | "identity" | "urgency" | "trust">;
  /** The strategic angle from which the campaign approaches the audience's problem. */
  marketingAngle: StrategyField<"authority" | "social_proof" | "problem_solution" | "transformation" | "aspiration" | "education" | "fear_reduction" | "scarcity" | "community">;
  /** The explicit promise the brand makes to the customer in this campaign. */
  customerPromise: StrategyField;
  /** Why the audience should choose this over any alternative. */
  valueProposition: StrategyField;
  /** The advertisement archetype — determines the visual format, information layers, and composition strategy for this specific campaign. */
  campaignArchetype: StrategyField<
    | "educational_explainer"    // doctor/expert demonstrates to audience — dental, healthcare, finance
    | "lead_generation_local"    // trust + outcome + CTA — local service businesses
    | "awareness_lifestyle"      // aspirational moment — brand/product in life context
    | "trust_authority"          // credentials + evidence + expert — high-trust industries
    | "premium_brand"            // minimal, luxury visual — jewellery, real estate, premium
    | "social_proof_testimonial" // transformation + quote + results — before/after, review
    | "product_hero"             // product isolated and celebrated — ecommerce, product launch
    | "transformation_story"     // split-frame before/after — dental, beauty, fitness
    | "offer_promotional"        // urgency + deal + CTA — limited-time offers, sales
    | "expert_consultation"      // professional in context — B2B, finance, legal
  >;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 2 — Visual Story
// How the campaign unfolds visually as a narrative.
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualStory {
  /** What the viewer sees and feels in the first 1–2 seconds. */
  openingScene: StrategyField;
  /** The moment in the creative that delivers the core message most powerfully. */
  heroMoment: StrategyField;
  /** Secondary visual elements that deepen the story around the hero. */
  supportingStory: StrategyField;
  /** The emotional state and image the viewer is left with after seeing the creative. */
  endingImpression: StrategyField;
  /** The emotional arc from first glance through to the CTA. */
  emotionalJourney: StrategyField;
  /** The complete narrative the visuals tell, independent of text. */
  visualNarrative: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 3 — Information Architecture
// How information is structured and sequenced for maximum comprehension.
// ─────────────────────────────────────────────────────────────────────────────

export interface InformationArchitecture {
  /** Ordered list of sections as a comma-separated sequence (e.g. "Hero → Benefits → Trust → CTA"). */
  sectionSequence: StrategyField;
  /** Which section carries the most visual weight and attention. */
  primaryFocus: StrategyField;
  /** The secondary area of the creative that reinforces the primary focus. */
  secondaryFocus: StrategyField;
  /** What single piece of information matters most if only one thing is remembered. */
  contentPriority: StrategyField;
  /** How information unfolds — horizontal, vertical, progressive disclosure. */
  informationFlow: StrategyField<"top_to_bottom" | "left_to_right" | "center_out" | "progressive_disclosure" | "single_focus">;
  /** The narrative arc across sections: how the story builds. */
  storyFlow: StrategyField<"problem_solution" | "aspiration_delivery" | "trust_building" | "education_action" | "emotion_proof_action" | "single_message">;
  /** The eye movement pattern the layout should support. */
  readingFlow: StrategyField<"z_pattern" | "f_pattern" | "center_weighted" | "top_dominant" | "radial">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 4 — Advertisement Structure
// Which sections appear in the creative and what role each plays.
// All values describe the section's role and content type — NOT actual copy.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdvertisementStructure {
  /** The dominant visual/message zone at the top of the creative — always present. */
  heroSection: StrategyField<"full_bleed_visual" | "headline_dominant" | "split_visual_text" | "product_hero" | "transformation_split" | "lifestyle_scene">;
  /** Benefits section — should it appear, and how should it be structured? */
  benefitsSection: StrategyField<"three_column_icons" | "horizontal_strip" | "single_dominant_benefit" | "bulleted_list" | "absent">;
  /** Features section for detail-focused campaigns. */
  featuresSection: StrategyField<"feature_grid" | "specification_list" | "icon_label_pairs" | "absent">;
  /** Credibility section: certifications, experience, partnerships. */
  trustSection: StrategyField<"certification_badges" | "years_of_experience" | "patient_count" | "awards" | "partnership_logos" | "absent">;
  /** Social proof: testimonials, ratings, case outcomes. */
  socialProofSection: StrategyField<"quote_with_photo" | "star_rating" | "before_after_pair" | "outcome_statistic" | "absent">;
  /** Comparison against alternatives or old solution. */
  comparisonSection: StrategyField<"vs_table" | "side_by_side" | "upgrade_visual" | "absent">;
  /** Data-driven proof points. */
  statisticsSection: StrategyField<"key_metric_callout" | "growth_chart" | "percentage_highlight" | "absent">;
  /** Process or journey showing how the service works over time. */
  timelineSection: StrategyField<"numbered_steps" | "horizontal_timeline" | "before_during_after" | "absent">;
  /** Promotional offer, discount, or event detail. */
  offerSection: StrategyField<"discount_badge" | "event_details" | "limited_time_banner" | "package_card" | "absent">;
  /** Primary call-to-action — always present. */
  ctaSection: StrategyField<"single_button" | "phone_plus_button" | "qr_code" | "form_preview" | "directional_cta">;
  /** Footer with brand mark, contact, tagline. */
  footerSection: StrategyField<"logo_contact_tagline" | "logo_only" | "contact_strip" | "absent">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 5 — Visual Direction
// What should appear in the creative, and what role each visual element plays.
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualDirection {
  /** The primary visual subject: specific, non-generic, strategically chosen. */
  heroSubject: StrategyField;
  /** Secondary visual elements that support and reinforce the hero. */
  supportingElements: StrategyField;
  /** What the background communicates about the brand and context. */
  backgroundStory: StrategyField;
  /** The setting or environment that contextualises the hero subject. */
  environment: StrategyField;
  /** Props or objects that reinforce the key message. */
  props: StrategyField;
  /** Whether icons appear, what style, and what they represent. */
  icons: StrategyField<"none" | "minimal_line_icons" | "filled_icons" | "branded_icons" | "emoji_style">;
  /** Whether infographic elements appear and what type. */
  infographics: StrategyField<"none" | "process_flow" | "comparison_chart" | "statistics_visual" | "growth_chart" | "timeline_infographic">;
  /** Whether trust badges appear, where, and what type. */
  trustBadges: StrategyField<"none" | "certification_corner" | "badge_strip" | "watermark_style" | "floating_badge">;
  /** Whether data charts appear and what they show. */
  charts: StrategyField<"none" | "bar_chart" | "line_chart" | "pie_chart" | "compound_growth" | "comparison_bar">;
  /** Whether trend lines or data graphs reinforce the message. */
  graphs: StrategyField<"none" | "upward_trend" | "growth_curve" | "comparison_graph">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 6 — Photography Direction
// How the visual elements should be captured / composed.
// ─────────────────────────────────────────────────────────────────────────────

export interface PhotographyDirection {
  /** The overall emotional quality the camera treatment should convey. */
  cameraMood: StrategyField;
  /** The type of shot that serves this campaign best. */
  shotType: StrategyField<"extreme_close_up" | "close_up" | "medium" | "wide" | "full_product" | "overhead" | "aerial" | "split_frame">;
  /** How the subject is positioned within the frame. */
  framingStyle: StrategyField<"rule_of_thirds" | "centered_symmetry" | "leading_lines" | "negative_space_dominant" | "frame_within_frame" | "edge_tension">;
  /** The viewpoint that best serves the subject and message. */
  perspective: StrategyField<"eye_level" | "slightly_elevated" | "low_angle" | "overhead" | "dutch_tilt">;
  /** The focal length character that best serves the creative. */
  lensStyle: StrategyField<"wide_environmental" | "standard_natural" | "telephoto_compressed" | "macro_detail" | "portrait_85mm">;
  /** Depth of field treatment to guide focus and emotion. */
  depth: StrategyField<"extreme_shallow_subject_isolation" | "shallow_romantic" | "medium_natural" | "deep_environmental" | "selective_progressive">;
  /** What the lighting must communicate, not technically how to achieve it. */
  lightingIntent: StrategyField<"clinical_trust" | "warm_intimate" | "dramatic_luxury" | "soft_approachable" | "bold_energetic" | "natural_authentic" | "golden_aspirational">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 7 — Design Direction
// The overall visual treatment and design philosophy for this campaign.
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignDirection {
  /** The foundational design style that defines this creative. */
  overallDesignStyle: StrategyField<"editorial_clean" | "luxury_minimal" | "corporate_professional" | "modern_bold" | "warm_approachable" | "dramatic_cinematic" | "informational_structured">;
  /** How premium / elevated the design must feel. */
  luxuryLevel: StrategyField<"utility_functional" | "consumer_quality" | "premium_polished" | "luxury_refined" | "ultra_prestige">;
  /** The use of space and restraint in the design. */
  minimalism: StrategyField<"information_dense" | "balanced_commercial" | "clean_focused" | "generous_editorial" | "ultra_minimal">;
  /** How much the creative should read like editorial vs. advertising. */
  editorialFeel: StrategyField<"pure_advertisement" | "editorial_inspired" | "magazine_quality" | "press_release_credible">;
  /** The contemporary vs. timeless positioning of the visual style. */
  modernFeel: StrategyField<"classic_enduring" | "contemporary_relevant" | "modern_fresh" | "cutting_edge_progressive">;
  /** The degree of polish and refinement in every detail. */
  premiumFeel: StrategyField<"practical_accessible" | "professional_quality" | "premium_craft" | "luxury_perfection">;
  /** How much information the design should carry. */
  informationDensity: StrategyField<"single_idea" | "focused_message" | "structured_content" | "rich_information" | "comprehensive_detail">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 8 — Marketing Structure
// The strategic messaging architecture for this campaign.
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketingStructure {
  /** The one thing the audience must remember about this campaign. */
  primaryMessage: StrategyField;
  /** Two or three supporting points that reinforce the primary message. */
  supportingMessages: StrategyField;
  /** How the creative builds credibility and earns trust. */
  trustStrategy: StrategyField<"credentials_first" | "results_first" | "testimonials_first" | "statistics_first" | "process_transparency" | "expert_authority">;
  /** Which audience objection this creative specifically addresses. */
  objectionHandling: StrategyField;
  /** How the creative captures attention in the first second. */
  attentionStrategy: StrategyField<"visual_shock" | "emotional_trigger" | "curiosity_gap" | "transformation_reveal" | "strong_claim" | "relatable_pain" | "aspirational_image">;
  /** How the creative keeps the audience engaged after the first glance. */
  retentionStrategy: StrategyField<"story_progression" | "benefit_revelation" | "social_proof_cascade" | "problem_deepening" | "data_credibility">;
  /** The mechanism that drives the audience from interest to action. */
  conversionStrategy: StrategyField<"urgency_scarcity" | "low_barrier_cta" | "social_momentum" | "authority_directive" | "value_clarity" | "risk_removal">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 9 — Creative Constraints
// Non-negotiable rules that protect brand, platform, and audience.
// ─────────────────────────────────────────────────────────────────────────────

export interface CreativeConstraints {
  /** Elements that must never appear in this creative — comma-separated list. */
  mustNeverAppear: StrategyField;
  /** Elements that must always appear — comma-separated list. */
  mustAlwaysAppear: StrategyField;
  /** Brand safety level for this campaign context. */
  brandSafety: StrategyField<"standard" | "elevated" | "medical_grade" | "financial_compliant" | "educational_appropriate">;
  /** Platform-specific content restrictions to observe. */
  platformRestrictions: StrategyField;
  /** Industry-specific legal or ethical restrictions. */
  industryRestrictions: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// CampaignPlan — the complete output of the Creative Director
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignPlan {
  concept:                 CampaignConcept;
  visualStory:             VisualStory;
  informationArchitecture: InformationArchitecture;
  advertisementStructure:  AdvertisementStructure;
  visualDirection:         VisualDirection;
  photographyDirection:    PhotographyDirection;
  designDirection:         DesignDirection;
  marketingStructure:      MarketingStructure;
  creativeConstraints:     CreativeConstraints;

  /** 0–100 overall confidence across all 9 domains. */
  confidenceScore: number;
  /** Fields where no signal was found and value is "unknown". */
  unknownFields: string[];
}
