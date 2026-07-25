import { z } from "zod";
import sharp from "sharp";

import { generateScript } from "@/lib/generation/llm";
import { toBuffer } from "@/lib/image/fetch-bytes";

// Canvas-compositor reliability fix — verifies a generated clean-background
// photo actually has an open top zone before compositing, rather than
// trusting the prompt alone. Reuses the SAME vision-LLM call mechanism
// analyzeAssetForLibrary() already uses (generateScript with imageUrl +
// responseFormat "json") — no new dependency, no face-detection model.
//
// Two lightweight pixel-based signals (raw variance, Laplacian edge-density)
// were measured against real known-good/known-bad background images before
// choosing this approach — both failed to separate the cases, confounded by
// lighting gradients, background objects, and photographic grain unrelated
// to whether a face/hand is actually intruding. A semantic check answers the
// real question directly instead of guessing from pixel statistics.
//
// Spatial-precision fix (v2 of this check) — a single whole-image call with
// a "look ONLY at the top/bottom regions" instruction was proven unreliable
// against real generated backgrounds: samples with a visually empty top
// zone (real, visible margin above the hairline) were still flagged
// "topZoneIssue: face", while the actual face sat well inside the middle of
// the frame. The model was reasoning about the image as a whole rather than
// truly isolating the requested band. Fix: physically crop the image to
// just the top band with sharp BEFORE sending it, so the model receives
// only that strip and literally cannot see (or reason about) the rest of
// the photo. Measured pass rate after this fix: 3/4 real samples.
//
// Bottom-zone check removed (v3 of this check) — the bottom margin is now
// guaranteed structurally by canvas-engine.ts's reserveBottomBand crop+matte
// instead of requested from the AI generator, so there is nothing left to
// verify there: whatever the photo contains below the matte line gets
// cropped away regardless of content. The top zone can't get the same
// structural treatment (cropping it would cut into the subject's own head,
// not just excess background), so it still depends on generation-time
// framing and this check remains its safety net.
//
// Head-containment attempt AND REVERT (v4, this section is institutional
// memory — the mechanism described below is NOT currently active). Phase
// 2a's split layout crops the photo zone to a fixed fraction of canvas
// height (SPLIT_LAYOUT_PHOTO_ZONE_FRACTION, 0.52 in compose-marketing-poster.ts),
// but nothing ever verified where the subject's head actually ends. Real
// verification showed heads cut off mid-face at that boundary in a
// meaningful fraction of generations, so a combined top+head check was
// attempted here, TWICE, both real-world-tested and both reverted:
//   v4.0 — asked for a continuous headBottomPercent (where does the chin
//     sit, as % of frame height) in the same call as the top-zone
//     question, cropped to a generous 70%-tall band. Real result: the
//     model consistently reported the HAIRLINE position, not the chin —
//     confirmed by drawing the reported line on real photos and looking —
//     even after a reworded prompt that explicitly warned against exactly
//     that mistake. Same "model limitation, not a wording problem" pattern
//     already seen in clean-background-prompt.ts's lower-body rule history.
//   v4.1 — dropped the continuous number for a plain binary "is the entire
//     head, chin included, contained within this crop" — the same isolate
//     +ask-yes/no pattern that made the ORIGINAL top-zone check reliable.
//     Real result: false failures across the board — the model flagged
//     "chin cut off" at every candidate boundary including 60%, even on
//     photos where the chin visibly sat around 40% with 10+ points of
//     margin to spare. Root cause: the crop's bottom edge always slices
//     through the subject's torso (arms, coat, collar) — expected and
//     fine, only the head needs to be above the line — and the model
//     conflated "a person's body is truncated by the image edge" with
//     "the head is cut off," despite being told to ignore the body.
//   Both v4.0 and v4.1 ALSO widened the crop used for the (already
//   reliable) top-zone question — from the tight isolated 18% strip to a
//   50-70%-tall shared band — which reintroduced the exact whole-image
//   reasoning imprecision the v2 fix above was built to eliminate. Real
//   measured top-zone pass rate under the combined design: 0/16, then
//   0/20, down from the historical 3/4 — confirmed as a false-positive
//   regression (e.g. a subject's hairline genuinely starting at 25% down,
//   outside the true 18% zone, still flagged FAIL) caused entirely by the
//   crop-widening, not by the underlying photos getting worse. Reverted
//   immediately once found, back to this file's original isolated-crop
//   top-zone-only design below.
//   Head-containment is an unsolved problem as of this revert — the next
//   attempt is expected to use a deterministic face-detection model
//   instead of a third vision-LLM prompt, given two independent prompt
//   designs have now failed real-world verification in different ways.
export const MAX_BACKGROUND_RETRIES = 2;

const TOP_ZONE_FRACTION = 0.18;

const zoneCheckSchema = z.object({
  clean: z.boolean(),
  issue: z.string().nullable().optional(),
});

export interface BackgroundZoneCheckResult {
  topZoneClean: boolean;
  topZoneIssue: string | null;
}

function parseJsonLoose(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  return JSON.parse(text);
}

const SYSTEM_PROMPT =
  "You are reviewing a single cropped photograph strip taken from the extreme top edge of a larger poster " +
  "background image. This strip is the ENTIRE image you can see — there is no other part of the photo " +
  `available to you. It represents the top ${Math.round(TOP_ZONE_FRACTION * 100)}% of the original frame, ` +
  "reserved as empty space so that a headline can be overlaid there later. Judge only what is visible in this " +
  "strip. It is clean ONLY if it is plain, uncluttered background — soft out-of-focus blur is fine. It is NOT " +
  "clean if any part of a face, head, hair, ear, hand, arm, clothing, held object, light fixture, furniture, " +
  "or décor is visible anywhere in this strip, even a small sliver at the edge. Return ONLY a single JSON " +
  "object (no markdown, no prose, no code fences) with exactly these fields: clean (true or false), issue (a " +
  "short phrase naming what is intruding, or null if clean).";

// Physically isolates the top band so the vision-LLM never receives pixels
// outside it — the actual fix for the spatial-attention failure mode
// described above (as opposed to just asking it to ignore the rest).
async function cropTopZone(fullImageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(fullImageBuffer).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new Error(`source image is missing usable dimensions (width=${width}, height=${height})`);
  }

  const bandHeight = Math.max(1, Math.round(height * TOP_ZONE_FRACTION));

  return sharp(fullImageBuffer)
    .extract({ left: 0, top: 0, width, height: bandHeight })
    .jpeg({ quality: 90 })
    .toBuffer();
}

// Throws on any crop or vision-call failure (rather than silently treating
// an unverifiable image as clean) — the caller (compose-marketing-poster.ts)
// already catches this, logs it, and treats it as a failed attempt subject
// to the same retry-then-fallback-to-buildPosterPrompt policy as a real
// "not clean" verdict. A background that couldn't be verified must never be
// trusted, but a verification hiccup must never hard-crash the generation
// either — that split is handled at the call site, not here.
export async function checkBackgroundZones(imageUrl: string, userId: string): Promise<BackgroundZoneCheckResult> {
  const { buffer } = await toBuffer(imageUrl);

  let cropped: Buffer;
  try {
    cropped = await cropTopZone(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[background-zone-check] top-zone crop failed: ${message}`);
    throw new Error(`background-zone-check: top-zone crop failed (${message})`);
  }

  const dataUri = `data:image/jpeg;base64,${cropped.toString("base64")}`;

  let result;
  try {
    result = await generateScript(
      {
        prompt: "Check this top strip as described above and return the JSON object.",
        contentLanguage: "EN",
        systemPrompt: SYSTEM_PROMPT,
        imageUrl: dataUri,
        responseFormat: "json",
      },
      { userId },
      "background_zone_check_top"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[background-zone-check] top-zone vision call failed: ${message}`);
    throw new Error(`background-zone-check: top-zone vision call failed (${message})`);
  }

  let parsed: unknown;
  try {
    parsed = parseJsonLoose(result.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[background-zone-check] top-zone response was not valid JSON: ${message}`);
    throw new Error(`background-zone-check: top-zone response was not valid JSON (${message})`);
  }

  const validated = zoneCheckSchema.parse(parsed);
  return { topZoneClean: validated.clean, topZoneIssue: validated.issue ?? null };
}
