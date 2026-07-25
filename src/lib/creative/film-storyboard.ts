import { z } from "zod";
import { generateScript } from "@/lib/generation/llm";
import type { FILM_STYLES } from "@/lib/validations/video";

// AI Film — the Storyboard screen's generation logic. Mirrors
// scene-split.ts's proven pattern (system prompt -> strict JSON -> Zod
// validation) exactly, adapted for Film: instead of splitting an existing
// script, this plans a storyboard from scratch out of the film's idea, and
// tags each scene with which character (by slot index) it features so
// Scene.filmCharacterId can be set — the seam the still-undecided
// consistency method will eventually read from, not something this
// function itself resolves.
//
// Founder product feedback, 2026-07-12, after watching real generated
// scenes: technically fine but "boring" — silent, observational
// cinematography with no ad energy, because that's literally what the old
// prompt asked for ("stands behind counter wiping it down" — no dialogue,
// no direct address). Fixed by making every character scene dialogue-
// driven by default, with real ad pacing (hook -> warmth -> spoken CTA),
// instead of a silent visual montage. Product decision, not a per-project
// toggle: this app's Film feature exists to make promotional content, so
// ad energy is the default for every `style` value (Cinematic/
// Documentary/Vintage/etc. — passed through to the LLM as-is below, still
// controlling visual treatment: camera language, lighting, grading —
// completely independent of whether people talk). Simpler than adding a
// second "tone" picker to the Input screen for a product where every film
// is inherently promotional.
//
// UPDATE (2026-07-25) — the "dialogue-driven" mechanism described above
// has changed: this originally relied on Veo's own native speech
// generation (confirmed live, Phase 2, 2026-07-12) directly rendering
// each character's spokenLine as on-screen audio. That's been replaced —
// see the real rewrite comment further down — with a genuine, separate
// ElevenLabs voiceover dubbed in at generation time instead, because
// asking the video model to ALSO render its own speech on top of that
// would create two competing voices. The "every character scene must
// speak" product decision above is unchanged; only the mechanism that
// actually produces the audio is different now.
// Fast-cut rewrite (2026-07-25) — founder feedback: this app's Film feature
// should produce MANY short, punchy scenes (real fast-cut, ad-native editing
// rhythm), not a few longer ones — the old 8-12s/scene assumption below
// produced a slow narrative arc (1 scene per 10s target), not a real Meta ad
// cut pattern. Narrowed to 2-3s/scene so a 10s target yields ~4-5 real cuts
// (hook/context/product/CTA) instead of one long shot.
//
// Real vendor-constraint investigation (2026-07-25), done BEFORE this
// change: no currently-eligible VIDEO provider can natively generate a clip
// this short in one call. Veo 3.1 (incl. Lite) is a fixed, non-configurable
// 8s (veo.provider.ts never even sends durationSeconds for Lite). Sora only
// accepts {4, 8, 12}s and is already filtered out for FILM's 10/20s targets
// by filterByDurationSupport() (video.ts). Seedance2.ai — the only real,
// currently-enabled VIDEO provider for FILM — has a genuine 4-15s range
// (seedance2.ai/api-docs, confirmed in this file's own prior research table
// in PROJECT_STATUS.md), so 4 seconds is the real floor. There is no way to
// literally request a 2-3s clip from any real vendor today.
//
// Mechanism: generate-then-trim, not literal short-generation. Every scene
// is still generated at the vendor floor (FILM_SCENE_GENERATION_FLOOR_SECONDS,
// requested by film-scene-video.ts) — but Scene.durationSeconds (this
// module's output) stays the SHORT intended on-screen value and is never
// overwritten after generation (generate-scene.ts's own scene.update() only
// touches status/videoKey/voiceKey). merge-via-editor.ts already builds each
// timeline clip's durationMs directly from scene.durationSeconds with
// trimStartMs defaulting to 0 — so the merged output naturally plays only the
// first 2-3s of each longer generated clip, a real trim through addClip()'s
// already-existing, already-render-pipeline-respected trimStartMs mechanism
// (confirmed live in render/pipeline.ts), not a new primitive. No code
// changes were needed in merge-via-editor.ts for this to work.
const MIN_SCENE_DURATION_SECONDS = 2;
const MAX_SCENE_DURATION_SECONDS = 3;

// The real per-call floor every scene is actually generated at (see the
// investigation above) — distinct from MIN/MAX_SCENE_DURATION_SECONDS above,
// which describe the SHORT intended on-screen duration stored on Scene and
// used for the final trim, not the vendor request. Exported for
// film-scene-video.ts to apply to its renderVideo() call.
export const FILM_SCENE_GENERATION_FLOOR_SECONDS = 4;

// Narrowed from up-to-300s total to exactly 10 or 20 seconds (2026-07-24) —
// MAX_VIDEO_GENERATION_TOTAL_SECONDS (lib/video-generation-limits.ts) now
// applies to FILM's total stitched output. At 2-3s/scene, a 10s target is
// typically 4-5 real cuts; a 20s target is typically 8-10 — the system
// prompt below says so explicitly, but trimScenesToTotalDuration() is the
// real enforcement: an LLM that ignores this guidance and returns more
// scenes than fit (or scenes that are too long) gets hard-trimmed, not just
// asked nicely.
// Meta-ad / performance-marketing rewrite (2026-07-25) — founder feedback
// on the previous "premium cinematic brand commercial" rewrite (same day,
// see git history): too slow and polished for a real Meta ad. Real, live
// before/after comparison confirmed a measurable directional shift toward
// handheld/vertical/direct-to-camera language.
//
// Creative-detail + real-audio rewrite (2026-07-25, same day) — founder's
// own real feedback watching an actual generated film: "video toh thoda
// theek aaya hai lekin satisfactory result nahi hai, voice music bhi kuch
// nahi tha... accha ad jaisa nahi laga" (roughly OK visually but not
// satisfying, no voice/music, doesn't feel like a real ad). Two real,
// separate fixes, both aimed at that actual complaint, not checklist
// completeness: (1) each scene's ONE visualPrompt string now explicitly
// weaves in the richer creative-direction categories a real reference
// "Master Storyboard Prompt" specifies — environment, subject, camera
// (type/angle/movement), cinematography (composition/depth-of-field),
// lighting (key/fill/back/color-temp), a real facial-expression ARC
// (beginning→middle→end, not one static descriptor), props, background
// activity, color grading, visual style, motion — plus a real negative-
// exclusion list folded into the text (confirmed via each vendor's own
// current docs: neither Veo nor Seedance has a real separate
// negative_prompt API field, so exclusions only work folded into the main
// prompt, same as quick-video-prompt.ts's established pattern). (2) The
// video model no longer generates the character's OWN native speech —
// real dialogue now comes from a genuine, separate ElevenLabs voiceover
// dubbed in during generateFilmSceneVideo() and actually mixed into the
// final merged output (see merge-via-editor.ts's own real fix, same day) —
// asking the video model to ALSO render speech on top of that would create
// two competing voices, the exact bug just fixed in Quick Video for the
// identical reason. Text overlay/transitions/editing notes/export settings
// from the reference structure are deliberately NOT part of this prompt —
// those are the Editor's own post-production layer, not something a
// text-to-video API call can act on.
const SYSTEM_PROMPT = `You are a commercial director writing the storyboard for a short PERFORMANCE-MARKETING ad film meant to run on Meta (Instagram/Facebook Reels) — not a brand commercial, not a silent art film. You receive the film's idea, its visual style, its total target duration (either 10 or 20 seconds — very short, a micro-ad), and a numbered list of its characters (each with a short description). Break the film into MANY short, punchy scenes, each 2 to 3 seconds long, stitched together in a real fast-cut editing rhythm — the exact opposite of a slow narrative arc told in one or two long shots. For a 10-second target this is typically 4 to 5 real cuts (e.g. hook -> context -> product moment -> CTA); for a 20-second target typically 8 to 10. Scenes must add up to AT MOST the total duration — never plan more scenes than fit within the target; a scene that would push the running total over the target must not be included.

This must feel like a real ad someone would actually run on Meta — the kind that stops a thumb mid-scroll, cut fast like a real Reels/TikTok ad, not a slow, polished TV commercial, and not a flat AI-generated clip either. A real, separate voiceover actor will read each character's spokenLine over the finished video — the video itself must NEVER attempt to render that speech (no lip-sync, no mouth-matched dialogue); characters are visually expressive and engaged with camera, not silently mouthing words.

Rules:
1. SCENE 1 IS THE HOOK, and it must land immediately — a bold visual, an unexpected moment, or a direct question/claim that stops the scroll, all within its own 2-3 seconds. Never open with a slow establishing shot, a logo, or a calm warm-up — start already mid-action, mid-emotion, or mid-statement.
2. Pacing IS the ad — many quick cuts, not a few long ones. Every scene is ONE single, immediate beat (one glance, one gesture, one short spoken line, one product reveal) — never try to fit two ideas or a slow buildup into one 2-3 second scene, that's what the NEXT cut is for. If a beat doesn't move the ad toward its one goal, cut it entirely rather than stretching it.
3. The whole film must build toward exactly ONE goal — decide what it is from the idea (a sale, a booking, a sign-up, driving foot traffic — whatever fits) and make every scene visibly serve that goal. The FINAL scene must land a clear, direct call-to-action that feels EARNED by the pacing before it, not tacked on as an afterthought.
4. Every scene that features one of the film's characters (characterSlotIndex is not null) MUST be an active, engaged moment for that character — visually reacting, gesturing, or emoting toward camera as if mid-conversation with the viewer. Only a scene with NO character at all may be a pure product/environment shot, and use those sparingly.
5. Give every character scene a "spokenLine": the exact short sentence that character would be saying at that moment, written the way a real person actually talks — natural, a little raw, not a slogan read off a page. One short sentence only. This becomes the real dubbed voiceover — never described as happening ON-CAMERA in the visualPrompt (no "she says", no lip movement, no mouth-sync language).
6. The visualPrompt is the single most important field — it is the ENTIRE creative brief for the video model, so it must genuinely earn its length by weaving in real, specific direction across every one of these dimensions (not as a labeled list — as one flowing, natural-sentence paragraph a cinematographer would actually write):
   - Environment: the specific location, time of day, and mood it sets.
   - Subject: who/what is the visual focus, described concretely.
   - Camera: shot type (close-up/medium/wide), and ONE deliberate movement scaled to a 2-3 second shot — a quick push-in, a snap whip-pan, a short confident tracking move, a handheld snap-to-frame — never a slow, gradual movement that wouldn't finish reading in 2-3 seconds, and never a flat, static, locked-off shot.
   - Cinematography: framing/composition and depth of field (what's in sharp focus vs. softly blurred).
   - Lighting: the real light sources and mood — e.g. warm morning window light as key, soft ambient fill, a hint of rim/back light separating the subject from the background — never just "nice lighting."
   - Character action: ONE clear, immediate expression or reaction committed to fully for the whole 2-3 seconds (e.g. a genuine surprised-delighted smile, a focused determined look) — the shot is too short for a slow beginning-to-end arc, so pick the single strongest beat and hold it, don't split it across a buildup.
   - Props: the specific real objects in frame that matter (the product, a tool, a cup — whatever the idea calls for).
   - Background activity: what's happening behind/around the main subject, even subtly (steam rising, someone else moving past, ambient motion) — a scene with a dead, static background reads as fake.
   - Color grading + visual style: a real, specific palette/mood (warm and inviting, crisp and clean, etc.) consistent with the requested style.
   - Motion: what moves within the frame beyond the camera itself.
   - Name the real creative tension explicitly rather than defaulting to generic "premium"/"cinematic" language: favor an authentic, slightly raw, creator/UGC-adjacent energy over a slow, over-polished commercial look, while the shot composition still stays clean enough to read as real production, not amateur.
   - End with a real negative-exclusion clause naming what must NOT appear: no on-screen text or captions, no blurry or distorted faces, no extra/deformed limbs, no watermark or logo, no flickering or warping, no lip-sync or mouth movement matching speech.
   Bias toward vertical or tight framing (this is a 9:16/1:1 Meta ad, not a widescreen commercial), the character always the clear visual focus. Example of the bar to hit: "A quick handheld push-in inside a small bakery at golden-hour, warm window light as key with a soft ambient fill and a hint of rim light separating her from the shelves of fresh bread blurred softly behind her. She looks up straight at camera already mid-motion, holding up a warm croissant toward the lens with a genuine, surprised-you're-here smile — steam still rising off it. No on-screen text, no blurry or distorted faces, no watermark, no lip-sync or mouth movement matching speech." Keep it to ONE clear, single visual beat renderable in 2-3 seconds — rich in detail, but one moment only, never multiple disconnected moments crammed together.
7. Every scene that features one of the film's characters must set characterSlotIndex to that character's slot index (0-based, matching the input list). A scene with no specific character sets characterSlotIndex to null.
8. Every visual prompt that shows people must explicitly specify they are Indian — never leave ethnicity unstated — unless the character list itself describes otherwise.
9. Output strict JSON only, no markdown fences, no commentary: { "scenes": [{ "sceneNumber": number, "visualPrompt": string, "spokenLine": string | null, "durationSeconds": number, "characterSlotIndex": number | null }] }`;

const storyboardSceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  visualPrompt: z.string().min(1),
  // Structured separately from visualPrompt for review/future-use clarity
  // (e.g. a captions feature later) even though visualPrompt is instructed
  // to already fold this line in as spoken dialogue — visualPrompt alone
  // remains the one string that actually reaches Veo, unchanged pipeline.
  spokenLine: z.string().min(1).nullable().default(null),
  durationSeconds: z.number().int().positive().default(3),
  characterSlotIndex: z.number().int().min(0).nullable().default(null),
});

// Real LLMs occasionally omit an empty array entirely rather than send `[]`
// — same defensive posture scene-split.ts already establishes.
const storyboardSchema = z.object({
  scenes: z.array(storyboardSceneSchema).min(1),
});

export type FilmStoryboard = z.infer<typeof storyboardSchema>;

export class FilmStoryboardError extends Error {}

export interface FilmStoryboardCharacterInput {
  slotIndex: number;
  name: string | null;
  characterSheet: unknown;
}

export interface SplitFilmIntoStoryboardInput {
  userId: string;
  videoProjectId: string;
  idea: string;
  style: (typeof FILM_STYLES)[number];
  totalDurationSeconds: number;
  characters: FilmStoryboardCharacterInput[];
}

function describeCharacter(character: FilmStoryboardCharacterInput): string {
  const label = character.name?.trim() || `Character ${character.slotIndex + 1}`;
  const sheet = character.characterSheet as Record<string, string> | null;
  if (!sheet) return `${character.slotIndex}. ${label} — no description yet.`;
  const traits = Object.values(sheet).filter((v) => typeof v === "string" && v.trim()).join(" ");
  return `${character.slotIndex}. ${label} — ${traits}`;
}

export function clampSceneDuration(durationSeconds: number): number {
  return Math.min(MAX_SCENE_DURATION_SECONDS, Math.max(MIN_SCENE_DURATION_SECONDS, durationSeconds));
}

// Real hard-cap enforcement (2026-07-24) — the system prompt above ASKS the
// LLM to stay within the target, but an LLM occasionally ignores numeric
// instructions; this is the actual guarantee. Drops scenes (from the end)
// once including the next one would exceed totalDurationSeconds, and always
// keeps at least the first scene (clamped down to fit) even if its own
// duration alone would otherwise exceed the target — never returns an empty
// storyboard. Renumbers sceneNumber sequentially since trimming can leave
// gaps.
export function trimScenesToTotalDuration<T extends { sceneNumber: number; durationSeconds: number }>(
  scenes: T[],
  totalDurationSeconds: number
): T[] {
  const kept: T[] = [];
  let remaining = totalDurationSeconds;
  for (const scene of scenes) {
    if (remaining < MIN_SCENE_DURATION_SECONDS) break;
    const duration = Math.min(clampSceneDuration(scene.durationSeconds), remaining);
    kept.push({ ...scene, durationSeconds: duration });
    remaining -= duration;
  }
  if (kept.length === 0 && scenes.length > 0) {
    kept.push({ ...scenes[0], durationSeconds: Math.min(MAX_SCENE_DURATION_SECONDS, totalDurationSeconds) });
  } else if (remaining > 0 && kept.length > 0) {
    // Real quantization gap (2026-07-25) — 2-3s scenes rarely divide a 10s/
    // 20s target evenly (e.g. three 3s scenes only fill 9 of 10, leaving 1s
    // unused). Rather than silently shipping a slightly-short ad, fold the
    // leftover into the final kept scene — an extra second or two on the
    // closing CTA cut reads as a deliberate beat, not a bug. Larger 8-12s
    // scenes never hit this in practice (one scene alone usually covers most
    // of a 10/20s target), which is why this wasn't needed before.
    const lastIndex = kept.length - 1;
    kept[lastIndex] = { ...kept[lastIndex], durationSeconds: kept[lastIndex].durationSeconds + remaining };
  }
  return kept.map((scene, i) => ({ ...scene, sceneNumber: i + 1 }));
}

export async function splitFilmIntoStoryboard(input: SplitFilmIntoStoryboardInput): Promise<FilmStoryboard> {
  const characterList = input.characters.map(describeCharacter).join("\n");
  const prompt =
    `Film idea: ${input.idea}\n` +
    `Style: ${input.style}\n` +
    `Total target duration: ${input.totalDurationSeconds} seconds\n` +
    `Characters:\n${characterList || "(none)"}`;

  const result = await generateScript(
    { prompt, contentLanguage: "EN", systemPrompt: SYSTEM_PROMPT, responseFormat: "json" },
    { userId: input.userId, videoProjectId: input.videoProjectId },
    "film_storyboard"
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    throw new FilmStoryboardError("Storyboard response was not valid JSON.");
  }

  const validated = storyboardSchema.safeParse(parsed);
  if (!validated.success) {
    throw new FilmStoryboardError(`Storyboard response did not match the expected shape: ${validated.error.message}`);
  }

  return { scenes: trimScenesToTotalDuration(validated.data.scenes, input.totalDurationSeconds) };
}
