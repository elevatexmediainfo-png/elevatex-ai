import { OPENAI_QUALITY_SENTENCE } from "@/lib/ai-os/provider-translator/providers/openai/quality";

// Canvas-compositor Step 2 — the opposite of poster-prompt.ts's
// buildPosterPrompt(): that one tells the model to render all text itself;
// this one tells it to render NONE, leaving a clean photograph that
// canvas-compositor's composeFromBlueprint() can later overlay with a real
// SVG text layer (headline/benefits/CTA/contact) driven by the blueprint's
// renderPlan. Wired into generateCreativeImage() via composeMarketingPoster()
// (Step 3, engine.ts) — every MARKETING_CREATIVE generation calls it first,
// falling back to buildPosterPrompt only if the compositor chain throws.

export interface CleanBackgroundPromptInput {
  /** The user's own one-line idea (NOT the essay-style enhanced prompt). */
  rawIdea: string;
  industryLabel: string | null;
  /**
   * Style-only guidance from the Admin Reference Library (getIndustryVisualStyle,
   * lib/admin/reference-library.ts) — palette/mood/lighting learned from curated
   * samples for this industry, with the layout clause already stripped (the
   * compositor's renderPlan controls layout, not the photo). Null/undefined
   * when there's nothing curated for this industry yet — the block is omitted
   * entirely, byte-identical to the prompt before this field existed.
   */
  visualStyle?: string | null;
}

export function buildCleanBackgroundPrompt(input: CleanBackgroundPromptInput): string {
  return [
    `Create a single, professional advertising photograph — a clean background image for a designed poster, with absolutely no text, letters, numbers, words, or logos rendered anywhere in the image. All headline, benefit, call-to-action, and contact text will be added afterward as a separate design layer, so the photograph itself must be completely free of any lettering.`,
    // [Ethnicity placement fix] "Indian" was previously stated once, inside
    // OPENAI_QUALITY_SENTENCE's quality/realism paragraph, BEFORE the
    // subject/scene was even described — the same weak-placement pattern
    // that made the "no text" and head-position rules unreliable until they
    // were moved to sit prominently next to what they govern. Fix: the
    // subject/scene line now comes first, immediately followed by a short,
    // dedicated sentence binding "Indian" directly to whoever is in that
    // scene, with OPENAI_QUALITY_SENTENCE's fuller (unchanged, still
    // reused, not duplicated) version right behind it as reinforcement —
    // two adjacent mentions at the exact point the model decides who's
    // being depicted, instead of one mention before the subject exists.
    `Subject and setting: ${input.rawIdea}${input.industryLabel ? ` — a real, natural scene appropriate for a ${input.industryLabel} business.` : "."}`,
    `Everyone shown in this scene is Indian — the main subject and any other staff, colleagues, or people present — with authentic Indian faces and skin tones true to the setting.`,
    OPENAI_QUALITY_SENTENCE,
    // [Reference Library connection, Problem 3 fix] Admin-curated sample
    // style now reaches the compositor's background photo — previously
    // getIndustryStyleGuidance() only fed buildPosterPrompt (the fallback
    // path), so curated samples affected nothing on real (compositor)
    // posters. Placed here, right after the Indian pair and before the
    // composition rules — same placement lesson as everything else in this
    // file: early and adjacent to what it should influence (the photo's
    // overall look), not buried after strict composition rules or
    // appended at the end. Omitted entirely when null (no curated samples
    // or guidance note for this industry yet) — byte-identical to the
    // prompt before this field existed.
    ...(input.visualStyle ? [input.visualStyle] : []),
    // [Composition tightening, v4] v3 ("close, chest-up crop" as the primary
    // instruction) still failed 0/12 real attempts on the top zone — proven
    // by generating 4 real backgrounds, annotating the actual 18%/25% zone
    // lines onto them, and looking: the forehead/hairline was substantially
    // inside the top zone in every sample, not a technicality. Root cause:
    // "chest-up crop" + "face centered in the middle band" push the head up
    // and large, directly fighting the empty-top requirement. v4 replaces
    // the crop convention with a literal, measurable head position + size
    // rule for the TOP zone — proven to work (real pass rate went from 0/4
    // to 2/4 once the verification check itself was fixed to judge only the
    // cropped zone instead of the whole image; see background-zone-check.ts).
    //
    // [Composition tightening, v5 — superseded] v5 added a literal
    // lower-body rule mirroring the top-zone one (70% mark boundary),
    // mirroring the top rule's proven pattern. It still measured 0/4 real
    // pass rate — confirmed via the exact crops the check saw, not just the
    // verdict — because empty "footroom" below a mid-frame torso has almost
    // no precedent in real photography for the model to draw on, unlike
    // headroom above a subject (which is common, and did respond: 3/4).
    // Two independent wording attempts at 0/4 means this isn't a wording
    // problem, it's a model limitation no instruction fixes reliably.
    //
    // [Composition tightening, v6] The bottom margin is no longer requested
    // from the model at all — it's guaranteed structurally instead
    // (canvas-engine.ts's reserveBottomBand crops the photo top-anchored
    // and mattes the reserved footer band in code, regardless of what the
    // photo contains there). The subject filling the lower frame is now
    // correct behavior, not a failure — v6 drops the lower-body rule and
    // the bottom half of the secondary-people rule entirely, keeping only
    // the top/head rules that are proven to work (3/4 real, with the
    // vision-LLM check + retry as backstop for the rest).
    `IMPORTANT — this composition requirement is as strict as the "no text" rule above: this must look like a magazine-cover or poster-campaign template shot, deliberately composed with generous empty background above the subject's head for a headline to be added later — NOT a close-up portrait that fills the frame at the top edge. The subject may fill the rest of the frame naturally, including the lower portion — only the top margin matters here.`,
    // [Composition tightening, v7] Real verification (composed posters, not
    // just the isolated top-zone crop) found heads cut off mid-face at the
    // split-layout photo/text boundary (compose-marketing-poster.ts's
    // SPLIT_LAYOUT_PHOTO_ZONE_FRACTION) even when the top-zone rule above
    // was satisfied — the v4 numbers (head starting ~25% down, sized
    // 20–25% of frame height) leave a worst-case chin position around 50%
    // down, uncomfortably close to that boundary once the compositor's
    // width-matched scale-up is applied. This tightens both numbers
    // (smaller head, positioned higher) purely to push that worst-case
    // chin position further from the boundary — a stronger version of the
    // SAME rule already proven to move real pass rates (3/4 on the
    // top-zone check), not a new vision-verification design (see
    // background-zone-check.ts's v4 history comment for why that path is
    // avoided here). Paired with a widened structural buffer at the
    // compositor boundary itself (compose-marketing-poster.ts) — belt and
    // suspenders, since this prompt alone is not deterministic.
    `Head position and size — a literal, measurable requirement, not a framing style: the top of the subject's head (hair included) must sit no higher than roughly the 22% mark measured down from the top of the frame. There must be a clear, empty band of plain background above the head — at least the top 15–18% of the frame — with absolutely nothing reaching into it: no hair, no forehead, no ears, no light fixtures, décor, or other environmental detail. The subject's ENTIRE head, chin included, must occupy no more than roughly 15–18% of the frame's total height — a noticeably small, pulled-back framing, well short of even a typical close-up portrait — positioned within the upper-middle band of the frame, not the center and not the top. Compose it as a wider medium shot than you might default to, so the subject's whole head sits comfortably within the frame's upper half with genuine empty space above it and real room below the chin before the frame's midpoint.`,
    `No secondary people in the top reserved zone: if the scene includes other staff, colleagues, or people in the background, none of them — no head, hair, face, or shoulder of any secondary person — may appear anywhere in the top reserved strip described above (the empty margin above the main subject's head). Secondary people, if present at all, must be positioned lower in the frame, alongside or behind the main subject, never breaking into the top margin.`,
    `Compose with clear, genuine negative space above the subject and any secondary people — nothing should reach the top edge. Treat the empty margin above the head like the top margin on a real magazine cover: deliberate, generous, and non-negotiable.`,
    `Style: premium advertising photography, warm and professional — the same visual quality as a real paid social campaign for this business, not a stock photo, not a cartoon, not an AI-generated look.`,
  ].join("\n\n");
}
