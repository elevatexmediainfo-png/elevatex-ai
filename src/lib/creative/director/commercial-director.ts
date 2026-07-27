import { z } from "zod";
import { generateScript } from "@/lib/generation/llm";
import type { DirectorPlan } from "./types";

// AI Director System — Commercial Director (2026-07-27). This module's
// actual planning logic (system prompt, schema, LLM call) is unchanged
// from what previously lived directly in lib/creative/scene-split.ts —
// moved here as this app's second concrete "Director" implementation,
// producing a style-tagged DirectorPlan instead of a bespoke SceneSplit
// shape, matching the Film Director's output type exactly.
//
// AI Video Phase 3a — the fix for the "script crammed into one 8s clip
// produces something random" failure: split the full script into 3-5
// independent VISUAL scenes before any video generation happens, one clip
// per scene. Refined live against a real script (not accepted on the first
// pass): the first version of this prompt silently dropped the ad's closing
// farewell/logo beat by over-merging adjacent cues — rule 4 below exists
// specifically because of that real failure, not as a hypothetical
// precaution.

// Narrowed from "3 to 5 scenes" to exactly 2 (2026-07-24) — downstream
// MAX_VIDEO_GENERATION_TOTAL_SECONDS (lib/video-generation-limits.ts) now
// hard-caps this at 2 scenes × 8s = 16s regardless (createScenesFromSplit()
// truncates anything beyond that). Truncating a naively-planned 3-5-scene
// list would silently drop whichever scenes happen to sort last — often the
// closing/farewell beat rule 4 explicitly protects — so the real fix is
// asking for exactly what actually fits, not planning more and hoping the
// truncation lands well.
// Meta-ad / performance-marketing rewrite (2026-07-25) — founder feedback
// on the previous "premium cinematic brand commercial" rewrite (same day,
// see git history): too slow and polished for a real Meta ad.
//
// Creative-detail rewrite (2026-07-25, same day) — same real founder
// feedback that drove film-director.ts's identical rewrite (see that
// file's own comment for the full real quote and reasoning): each scene's
// ONE visualPrompt string now explicitly weaves in richer creative-
// direction categories (environment, subject, camera, cinematography,
// lighting, action/energy arc, props, background activity, color grading,
// visual style, motion) plus a real negative-exclusion list folded into
// the text (confirmed via each vendor's own docs — neither Veo nor
// Seedance has a real separate negative_prompt field). GENERATED's scenes
// were already visual-only (rule 1 already excluded spoken dialogue) —
// unlike FILM, there's no native-speech conflict to fix here.
//
// Fixed 8s scene length (2026-07-27 note) — matches Veo 3.1 Lite's
// confirmed-fixed real output length (video-provider-capabilities.ts's
// `veo` entry: min === max === 8). Unlike the Film Director, this pipeline
// doesn't need a generate-then-trim mechanism, since 8s is already both
// the intended on-screen duration AND a real vendor's native output —
// there's nothing to trim.
const SYSTEM_PROMPT = `You are a cinematographer planning scenes for a short PERFORMANCE-MARKETING ad meant to run on Meta (Instagram/Facebook Reels) — not a brand commercial. You receive a full marketing script — often mixing spoken host dialogue in Hindi/Hinglish with bracketed visual directions like "[Scene: ...]" — and must break it into EXACTLY 2 distinct VISUAL scenes, each suitable for one independent 8-second AI video clip (16 seconds total — a tight micro-ad, not a longer sequence).

Rules:
1. Extract only the VISUAL content each scene needs to show. Never the spoken dialogue text itself — there is no synced narration or lip-sync yet (that is a later phase). Treat any "Host:" dialogue only as context for mood/setting, not as words to render or lip-sync.
2. Each visualPrompt is the ENTIRE creative brief for the video model, so it must genuinely earn its length by weaving in real, specific direction across every one of these dimensions as ONE flowing, natural-sentence paragraph a cinematographer would actually write (not a labeled list, not multiple disconnected moments — one clear, concrete visual moment renderable in 8 seconds):
   - Environment: the specific location, time of day, and mood it sets.
   - Subject: who/what is the visual focus, described concretely.
   - Camera: shot type (close-up/medium/wide) and ONE deliberate movement — a quick, purposeful move or a handheld feel — never a flat, static, locked-off shot.
   - Cinematography: framing/composition and depth of field (sharp focus vs. softly blurred background).
   - Lighting: the real light source and mood (e.g. warm morning light, soft ambient fill, a hint of rim light) — never just "nice lighting."
   - Action + energy arc across the clip's own 8 seconds — how the moment shifts from start to end (e.g. stillness → sudden motion → reveal), not one static description for the whole scene.
   - Props: the specific real objects in frame that matter.
   - Background activity: what's happening behind/around the main subject, even subtly — a dead, static background reads as fake.
   - Color grading + visual style: a real, specific palette/mood.
   - Motion: what moves within the frame beyond the camera itself.
   - A real negative-exclusion clause: no on-screen text or captions, no blurry or distorted faces, no extra/deformed limbs, no watermark or logo, no flickering or warping.
   Name the real creative tension explicitly rather than defaulting to generic "premium"/"cinematic" language: favor an authentic, slightly raw, creator/UGC-adjacent energy over a slow, over-polished commercial look, while the shot still stays clean enough to read as real production, not amateur. Bias toward vertical/tight framing, the product or subject always the clear visual focus, nothing in the background competing for attention. Every second must earn its place — no filler shots, no idle establishing moments with nothing happening. Scene 1 specifically must hook the viewer within its very first 1-2 seconds with a bold visual, an unexpected moment, or a direct claim — never a slow, empty warm-up, never a logo or establishing shot.
3. With only 2 scenes available, scene 1 must be the HOOK — the beat that stops the scroll fastest. Scene 2 must be the CLOSE — the ad's single clearest call-to-action, and it must feel EARNED by scene 1's pacing, not tacked on. Both scenes together must build toward exactly ONE goal — infer it from the script (a sale, a visit, an order) and keep every visual choice serving that one goal.
4. Never plan more than 2 scenes, even if the script's own bracketed cues suggest more beats — pick the 2 that matter most (hook + close) rather than diluting across more, weaker scenes.
5. A bracketed cue that is really an on-screen TEXT/graphic instruction (e.g. "[Text on screen: 20% OFF...]") is NOT a visual scene for the video model. Do not create a video scene for it — instead add it as a textOverlay tied to the scene it should appear over (an editor will render this as real overlay text afterward, not the video model).
6. Every visual prompt that shows people (staff, host, customers) must explicitly specify they are Indian — never leave ethnicity unstated.
7. Output strict JSON only, no markdown fences, no commentary: { "scenes": [{ "sceneNumber": number, "visualPrompt": string, "durationSeconds": 8 }], "textOverlays": [{ "afterSceneNumber": number, "text": string }] }`;

const sceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  visualPrompt: z.string().min(1),
  durationSeconds: z.number().int().positive().default(8),
});

const textOverlaySchema = z.object({
  afterSceneNumber: z.number().int().positive(),
  text: z.string().min(1),
});

// Real LLMs occasionally omit an empty array entirely rather than send `[]`
// — same defensive posture prompt-os/schema.ts's stringArray()/section()
// already establish for this codebase's other structured-LLM-output call
// sites. Not hypothetical: worth guarding here too since this is a fresh
// schema with no live-traffic track record yet.
const sceneSplitSchema = z.object({
  scenes: z.array(sceneSchema).min(1),
  textOverlays: z.array(textOverlaySchema).optional().default([]),
});

export class CommercialDirectorError extends Error {}

export async function planCommercialFromScript(script: string, userId: string): Promise<DirectorPlan> {
  const result = await generateScript(
    {
      prompt: `Script:\n${script}`,
      contentLanguage: "EN",
      systemPrompt: SYSTEM_PROMPT,
      responseFormat: "json",
    },
    { userId },
    "scene_split"
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    throw new CommercialDirectorError("Scene-split response was not valid JSON.");
  }

  const validated = sceneSplitSchema.safeParse(parsed);
  if (!validated.success) {
    throw new CommercialDirectorError(`Scene-split response did not match the expected shape: ${validated.error.message}`);
  }

  return { style: "commercial", scenes: validated.data.scenes, textOverlays: validated.data.textOverlays };
}
