// Phase 5 — GPT Creative Director types.
//
// GPTCampaignDirection is the JSON schema the LLM must return: a creative brief
// written from the perspective of a Senior Advertising Creative Director.
// It is NOT a prompt. It describes what the ad should feel and mean —
// never how to technically produce it.
//
// GPTDirectorResult is the full return type of runGPTCreativeDirector().
// The deterministic fallbackPlan is ALWAYS computed alongside the GPT direction
// so failures are invisible to the user and debug comparisons are possible.

import type { CampaignPlan } from "./types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { BrandContext, UserUnderstanding } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

export interface GPTDirectorInput {
  strategy:              CreativeStrategy;
  userUnderstanding:     UserUnderstanding;
  brandContext?:         BrandContext;
  /** Text description produced by LLMOrchestrator.analyzeImage() — optional. */
  referenceImageAnalysis?: string;
  rawIdea:               string;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON schema returned by GPT — the creative brief in machine-readable form.
// Every string field must read like a sentence from a human creative director.
// ─────────────────────────────────────────────────────────────────────────────

export interface GPTCampaignDirection {
  /** The single creative idea that unifies every element of the campaign. */
  campaignConcept:    string;
  /** What this specific advertisement must measurably achieve. */
  marketingObjective: string;
  /** The mental shift this ad must create in the viewer's mind. */
  psychologicalGoal:  string;
  /** The primary emotion the viewer should feel when they see this ad. */
  viewerEmotion:      string;
  /** The single most important message — the one idea the viewer must take away. */
  coreMessage:        string;
  /** Elaboration of the Creative Brain's hero subject directive. GPT must NOT replace the hero — only enrich it with vivid scene detail while preserving the fundamental hero decision. */
  heroSubject:        string;
  /** Visual elements that support the hero — described as a scene, not a list. */
  secondarySubjects:  string;
  /** Props, environmental details, or objects that reinforce the narrative. */
  supportingObjects:  string;

  visualStory: {
    /** The situation or state the viewer identifies with before the ad's solution. */
    before: string;
    /** The exact moment this advertisement captures — the narrative pivot point. */
    moment: string;
    /** What the viewer imagines their life looks like after they act. */
    after:  string;
  };

  /** Complete scene description — as if briefing an art director or photographer. Vivid, human, specific. No technical specs. */
  sceneDescription: string;

  visualHierarchy: {
    /** What the eye lands on first — the dominant visual element. */
    primary:    string;
    /** What reinforces the hero — the supporting story element. */
    secondary:  string;
    /** What the background communicates about brand and context. */
    background: string;
    /** Subtle details that reward close attention without competing. */
    decorative: string;
  };

  negativeSpace: {
    /** Where the headline sits and why that position serves the campaign. */
    headline: string;
    /** Where the CTA lives and what its position communicates. */
    cta:      string;
    /** Where the brand mark sits and what it says about brand confidence. */
    logo:     string;
  };

  compositionIntent: {
    /** How the viewer's eye travels through the image — the emotional journey. */
    eyeFlow:        string;
    /** How visual weight is distributed across the frame — described as feeling. */
    subjectBalance: string;
    /** Why the chosen framing serves this campaign's emotional goal. */
    framingLogic:   string;
  };

  /** What the lighting must communicate — not how to technically achieve it. */
  lightingMood:    string;
  /** The setting that makes this campaign believable and aspirational. */
  environment:     string;
  /** The emotional role color plays — not hex codes, not Pantone values. */
  colorPsychology: string;

  /** 3–5 specific psychological triggers (Cialdini principles, FOMO, identity, etc.) this campaign activates. */
  marketingTriggers: string[];
  /** 2–4 specific visual trust signals that should appear in this campaign. */
  trustTriggers:     string[];
  /** 2–3 small visual details that reward close attention — micro-storytelling. */
  microInteractions: string[];

  /** Elements that MUST appear — specific, visual, strategic. */
  mustInclude: string[];
  /** Elements that must NEVER appear — wrong tone, wrong message, brand risk. */
  mustAvoid:   string[];

  /** The advertising style and creative positioning of this campaign. */
  commercialStyle: string;
  /** The complete story this ad tells — from first glance to emotional close. 3–4 sentences. */
  narrative:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug metadata — shown in Admin → Creative Director debug panel
// ─────────────────────────────────────────────────────────────────────────────

export interface GPTDirectorDebug {
  executionTimeMs:  number;
  model:            string | null;
  tokenUsage:       { prompt?: number; completion?: number; total?: number } | null;
  rawOutput:        string | null;
  retryCount:       number;
  promptSizeChars:  number;
  error:            string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result
// ─────────────────────────────────────────────────────────────────────────────

export interface GPTDirectorResult {
  /** The GPT-generated creative direction — null if GPT failed and mode=fallback. */
  direction:    GPTCampaignDirection | null;
  /** The deterministic Creative Director output — always present for comparison and fallback. */
  fallbackPlan: CampaignPlan;
  /** "gpt" = direction is from GPT; "fallback" = GPT failed, use fallbackPlan instead. */
  mode:         "gpt" | "fallback";
  debug:        GPTDirectorDebug;
}
