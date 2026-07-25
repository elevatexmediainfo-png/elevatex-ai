// Phase 8.5 — Self-Review Engine
//
// Generates GPT instruction strings for the internal self-review loop.
// These are injected as part of the CDE context block — GPT executes them
// as chain-of-thought before returning its final output.

/** 10-question quality checklist. GPT scores each 0–10 before finalising. */
export function buildSelfReviewInstruction(): string {
  return `━━ SELF-REVIEW MANDATE (execute internally before returning output) ━━
Score each 0–10. Rewrite the 2 lowest-scoring fields if total < 90.

 1. Single hero       — Exactly ONE primary element named with specific, unique detail?
 2. Hierarchy %       — Visual weights expressed as percentages summing to 100%?
 3. Recreatable       — Can a photographer recreate this from the description alone?
 4. Typography        — H1 / H2 / CTA differentiated by weight, size, and tracking?
 5. CTA               — Exactly ONE CTA, phrased as a specific action (not "Learn More")?
 6. Emotion           — SPECIFIC emotional trigger named (not "emotional" or "warm")?
 7. Trust signal      — At least one verifiable trust element present?
 8. Decisive moment   — Hero captured at a decisive unrepeatable moment — not a pose?
 9. Background        — Background actively supports narrative — not neutral or random?
10. Agency quality    — Every field specific enough to brief a photographer and art director?

Rule: if total < 90 → identify 2 lowest-scoring fields → rewrite → check again → then output.`;
}

/** Weighted commercial score rubric. GPT self-verifies before returning. */
export function buildCommercialScoreInstruction(): string {
  return `━━ COMMERCIAL SCORE TARGETS (self-verify — total must reach 90/100) ━━
Hero Subject    (20 pts) — names specific subject + body position + expression + micro-detail
Photography     (15 pts) — specifies lens + shutter or aperture + light source + camera height
Visual Hierarchy(15 pts) — % allocations across hero / secondary / copy / CTA zones
Typography      (10 pts) — specifies font register + weight hierarchy + tracking or size ratio
Layout          (10 pts) — zone distribution in % (image% | upper zone% | lower zone%)
Emotion         (10 pts) — names the specific psychological conversion mechanism
Marketing       (10 pts) — names the conversion action + the trigger that produces it
Trust Signal    ( 5 pts) — at least one verifiable credential, social proof, or guarantee
Indian Context  ( 5 pts) — at least one detail grounded in Indian reality (city, brand, habit)

If score < 90: identify and strengthen the weakest criterion — then return.`;
}
