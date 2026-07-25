import type { z } from "zod";
import type { ProviderRuntimeConfig } from "../credentials";
import { logger } from "@/lib/observability/logger";
import { aiReeditResponseSchema, type AIReeditResponse } from "@/lib/validations/ai-reedit";
import type { AICaption } from "@/lib/validations/ai-timeline";
import {
  reasoningPlanOutputSchema,
  type ReasoningCaptionRaw,
  type ReasoningPlanRequest,
  type ReasoningPlanResult,
  type ReasoningProvider,
  type ReasoningReeditRequest,
  type ReasoningReeditResult,
} from "./types";

// Real adapter — GPT-5.x, the REASONING category's own model (distinct
// from the "openai" LLM category adapter's script-writing job). Same
// no-SDK/raw-fetch convention as every other adapter in this codebase.
// Structured output follows this codebase's ESTABLISHED pattern (loose
// `response_format: json_object` + app-side JSON.parse + Zod validate —
// see openai.provider.ts/gemini.provider.ts), not OpenAI's newer strict
// `json_schema` mode, which has no precedent here yet and would be a new
// pattern to introduce for its own sake — matched to Gemini's
// `responseSchema` approach in spirit (constrain via the prompt, verify
// via Zod), just via a different vendor mechanism.
const DEFAULT_MODEL = "gpt-5";
const DEFAULT_REPAIR_MAX_ATTEMPTS = 1;

function formatWords(words: ReasoningPlanRequest["words"]): string {
  // Compact "index:word@start-end" tokens rather than one JSON object per
  // word — a transcript can be hundreds of words; this keeps prompt size
  // sane while preserving every timestamp the model needs. The leading
  // index (2026-07-22) is what TASK 1 now asks the model to CITE for
  // caption timing instead of estimating milliseconds itself — see
  // reasoningCaptionRawSchema's own doc comment (./types.ts) for why.
  return words.map((w, i) => `${i}:${w.word}@${w.startMs}-${w.endMs}`).join(" ");
}

// Deterministically turns the model's word-index citations into real
// ms values from req.words — the model never gets to invent a timestamp
// for a caption, only choose which already-timestamped transcript words
// it spans. Indices are clamped defensively (never crash the whole job
// over one bad citation) and logged when out of range, which should be
// rare: the model is shown the exact numbered list it must cite from.
export function resolveCaptionTiming(raw: ReasoningCaptionRaw[], words: ReasoningPlanRequest["words"]): AICaption[] {
  if (words.length === 0) return [];
  const lastIndex = words.length - 1;
  return raw.map((c) => {
    let startIdx = c.sourceWordStartIndex;
    let endIdx = c.sourceWordEndIndex;
    if (startIdx > lastIndex || endIdx > lastIndex) {
      logger.warn(
        { sourceWordStartIndex: c.sourceWordStartIndex, sourceWordEndIndex: c.sourceWordEndIndex, wordCount: words.length },
        "[gpt5 reasoning] caption cited a word index beyond the real transcript — clamping"
      );
      startIdx = Math.min(startIdx, lastIndex);
      endIdx = Math.min(endIdx, lastIndex);
    }
    return {
      text: c.text,
      startMs: words[startIdx].startMs,
      endMs: words[endIdx].endMs,
      style: c.style,
      reveal: c.reveal,
    };
  });
}

function buildPrompt(req: ReasoningPlanRequest): string {
  const videoSection = req.videoAnalysis
    ? `\nVideo-understanding analysis (from watching the footage):
Emphasis moments: ${JSON.stringify(req.videoAnalysis.emphasisMoments)}
Emotion beats: ${JSON.stringify(req.videoAnalysis.emotionBeats)}
Visual context: ${JSON.stringify(req.videoAnalysis.visualContext)}`
    : `\nNo video-understanding analysis is available for this source (audio-only, or the video analysis step failed) — propose captions only, leave "zoom" as an empty array. Do not invent emphasis moments that weren't given to you.`;

  const styleSection = req.stylePreset
    ? `\nStyle preset: "${req.stylePreset}". Let this genuinely influence the captions' reveal style AND visual style:
- Punchy / energetic / shorts-style presets: reveal.mode "WORD" (or "KARAOKE" for a sing-along feel), short unitDurationMs (120-220), style "POP" or "COLOR_SWEEP".
- Calm / professional / documentary-style presets: reveal.mode "NONE" (a static, non-animated caption per line) — you must set this EXPLICITLY; omitting "reveal" entirely defaults to word-by-word reveal, which is the WRONG choice for a calm preset.
- Bold / hinglish presets: set "style.fontWeight" to 800 or 900 (genuinely bold, not a token increase) and "style.color" to a high-contrast color (a bright white or saturated accent, not a muted tone) on every caption. ALSO rephrase every caption's "text" in natural Hinglish (Hindi-English code-mixed, colloquial, Latin script — the way a real Indian creator captions their own reels, not formal/textbook Hindi and not plain English) — but this is a WORDING change only: "sourceWordStartIndex"/"sourceWordEndIndex" (see TASK 1 below) must still cite the exact same original transcript word range those words occupy, regardless of how the caption text is phrased. Also use reveal.mode "WORD" with style "POP" (punchy energetic reveal) unless the preset text says otherwise.`
    : `\nNo style preset was chosen — use the neutral default: omit "reveal" entirely (the app then applies its own word-by-word default), or set reveal.mode "WORD" explicitly.`;

  // Phase 12 Module 8 — a pasted reference script, "if the user had one."
  // Extra context ONLY: never a timing source (TASK 1 below repeats this
  // constraint at the point it actually matters) and never fed to any
  // other TASK — a script tells you what was SAID, not where b-roll/
  // zoom/stickers/transitions belong.
  // Founder request (2026-07-18) — user control over b-roll aggressiveness,
  // fed into TASK 3 below as an explicit override of its default 0-3 range
  // and threshold, without touching the "propose zero when nothing fits"
  // calibration itself — even HEAVY only raises the ceiling and loosens
  // the bar for what counts as "worth illustrating," it never mandates a
  // minimum count.
  const brollDensityGuidance =
    req.brollDensity === "MINIMAL"
      ? `B-roll density: MINIMAL. Propose 0-1 b-roll slots for the ENTIRE video, and only for the single most compelling moment if one clearly stands out — when in doubt, propose zero.`
      : req.brollDensity === "HEAVY"
        ? `B-roll density: HEAVY. Propose up to 6 b-roll slots — actively look for supporting-shot opportunities, including moments you'd otherwise consider borderline. Still propose fewer (including zero) if the content genuinely doesn't have that many concrete, visualizable moments — never pad with irrelevant cutaways just to hit a count.`
        : `B-roll density: BALANCED (default). Propose 0-3 b-roll slots, as described below.`;

  // Founder policy (2026-07-18) — generation is disabled for b-roll right
  // now; every proposal must be "stock". This is prompt-level guidance
  // only — ai-broll-resolver.ts enforces this as a hard backstop
  // regardless of what "source" you actually return, so treat this as a
  // real constraint, not a soft preference to weigh against the stock-vs-
  // generate judgment call described below.
  const stockOnlyGuidance = req.brollStockOnly
    ? `\nPOLICY OVERRIDE — generation is disabled right now. Every b-roll item you propose MUST have "source": "stock" with a real "searchQuery" — never "generate", regardless of how specific, unusual, or seemingly-unstockable the moment is. If you can't think of a decent stock search phrase for a moment, don't propose a b-roll slot for it at all rather than reaching for generation.`
    : "";

  const scriptSection = req.referenceScript
    ? `\nReference script (provided by the user — may not match the actual recording word-for-word, e.g. an ad-libbed take):\n${req.referenceScript}`
    : "";

  const boundaryGuidance =
    req.survivingSegmentCount >= 2
      ? `There will be ${req.survivingSegmentCount} surviving segments of the main clip after the ALREADY-DECIDED scene removal — you can propose transitions at boundary indices 0 through ${req.survivingSegmentCount - 2} (boundary index N sits between surviving segment N and segment N+1).`
      : `There is only 1 surviving segment of the main clip after scene removal (nothing was cut, or only one piece survives) — there are NO internal boundaries. Propose zero transitions.`;

  return `You are planning the captions, zoom effects, b-roll, stickers, music, sfx, and transitions for a video editor's AI Auto-Editor feature. You are given the full transcript (word-level timestamps, in milliseconds from the start of the source media) and, if available, a video-understanding analysis.

Transcript words (format "index:word@startMs-endMs" — each word is numbered 0 to ${req.words.length - 1} in order):
${formatWords(req.words)}
${videoSection}
${styleSection}
${scriptSection}

Source media duration: ${req.sourceDurationMs}ms. Every timestamp you produce (for zoom/broll/stickers/music/sfx/transitions — captions are the one exception, see TASK 1) must be within [0, ${req.sourceDurationMs}].

TASK 1 — captions: Segment the transcript into natural caption chunks (roughly sentence or clause length, not single words, not the entire transcript as one giant caption). For each caption, set "sourceWordStartIndex" and "sourceWordEndIndex" to the FIRST and LAST numbered word index (from the list above) that caption covers — do NOT produce startMs/endMs yourself, the app computes the caption's real timing directly from the ORIGINAL transcript word timestamps at those indices, so just cite the correct index range and its timing will always be exactly right. This applies even when a reference script was given below, AND even when the style preset above asks you to rephrase caption text into Hinglish or any other wording change — rephrasing changes the WRITTEN TEXT only, never which original word range the caption's timing is derived from. Captions should not overlap (each word index belongs to at most one caption) and should be in chronological order (sourceWordStartIndex strictly increasing across captions).${
    req.referenceScript
      ? ` If the reference script was provided above, use it to CORRECT obvious mis-transcribed words in caption TEXT ONLY (e.g. the transcript says "sink" but the script's context makes clear the speaker said "sync") — never change a caption's sourceWordStartIndex/sourceWordEndIndex based on the script, and never insert script text the transcript's own words don't cover at all (the speaker may have ad-libbed differently than the script). When the script and transcript genuinely disagree on what was said (not just a plausible mishearing), trust the transcript — it's what was actually spoken, the script is only a hint.`
      : ""
  }

TASK 2 — zoom: If (and only if) video-understanding emphasis moments were given above, propose 0 to 3 SUBTLE zoom-in windows on the most genuinely emphasized moments — these should feel natural, not jarring. Keep scaleFrom around 100 (native size) and scaleTo modest (110-130 range for a subtle push-in; never above 150). Each zoom window's startMs/endMs should cover roughly the emphasis moment's own span. If no emphasis moments were given, or none are strong enough to be worth a zoom, return an empty zoom array — do not invent zooms.

TASK 3 — broll: ${brollDensityGuidance}${stockOnlyGuidance} Only propose a slot where the transcript mentions something concrete and visualizable that would genuinely benefit from a supporting shot (a specific object, place, action, or scene) — never for abstract statements, filler, or when you're not confident there's a real visual to show. It's completely fine to propose zero, regardless of density. For each slot, set "trackHint" to "broll", startMs/endMs to a short window (1-4 seconds) covering the moment being illustrated, and choose "source":
- "stock": use this whenever a decent keyword search of a real stock photo/video library would PLAUSIBLY turn up something usable — this covers far more than plain everyday objects: everyday objects, people doing everyday things, generic business/tech/nature/city scenes (e.g. "typing on a laptop," "a stock market chart," "a coffee cup on a desk," "a city skyline at night"), AND real-world professions/settings/activities even when fairly specific in COMBINATION (e.g. "a founder pitching investors," "a doctor examining a patient," "a chef plating a dish," "a warehouse worker scanning boxes") — a specific-sounding scene built from ordinary, photographable real-world elements is still "stock," not "generate." Set "searchQuery" to a short, literal, keyword-style search phrase (2-5 words) a stock library search box would actually match well — not a full sentence, and not an abstract concept. Two specific traps to avoid: (1) if the transcript names an abstract idea rather than a physical thing ("water conservation," "growth," "innovation," "trust"), don't search the abstract phrase itself — describe the one concrete, physically photographable scene or action that represents it instead ("hand turning off a running tap," "small plant sprouting from soil," "two people shaking hands"); (2) avoid a short, generic query built around a word with multiple unrelated real-world meanings ("pump," "crane," "driver") without a disambiguating word, since a stock library will happily match the wrong sense (e.g. "automatic water pump" alone can surface an unrelated industrial concrete pump) — add the one extra literal word that pins down which physical object or setting you mean ("domestic water pump appliance," "construction crane," not "a race car driver's job"). An approximate stock match is virtually always the right choice over spending real generation credits for a closer one.
- "generate": real money is spent per generated item, stock costs nothing — this is a COST decision, not just a quality one, so treat "generate" as a rare last resort, never a coin-flip default. Use it ONLY when you're confident NO real-world photo or video could plausibly exist for this — fictional/surreal/impossible content (a creature that doesn't exist, a physically impossible scene), an exact custom/branded visual that must match specific unreproducible details (a specific app's exact UI mockup), or a genuinely abstract concept with no literal photographable form. If you can picture ANY real photo or video that would reasonably illustrate the moment — even an imperfect match — that is a "stock" case, not a "generate" one. Set "generation" to { "kind": "image"|"video", "prompt": a detailed visual description }. Prefer "kind":"image" over "video" unless genuine motion is essential to what's being shown — a generated still image is far cheaper and faster, and works fine as a brief cutaway.
When genuinely uncertain between the two, ALWAYS choose "stock" — an approximate free match costs nothing, an unnecessary generation call spends real credits for marginal benefit. Never set resolvedAssetId, resolvedAssetUrl, or resolutionNote — those are filled in by a later step, not you.

TASK 4 — stickers: Propose 0-2 sticker/emoji overlays ONLY when the transcript explicitly names something with an obvious, iconic visual symbol — a specific brand/app/product name, a clear emotional beat worth punctuating (excitement → a star/sparkle, a warning → a caution symbol), or a literal object with a well-known emoji/icon equivalent. This is a light garnish, not a requirement — propose zero far more often than not; only add one when it's genuinely obvious what symbol fits. Set "assetQuery" to a short keyword (e.g. "sparkles", "fire", "thumbs up", the literal brand name), startMs/endMs to a brief window (0.5-2 seconds), and "position" (0..1 fraction of frame, e.g. {"x":0.8,"y":0.15} for top-right) if you have an opinion, otherwise omit it. Never set assetId, resolvedAssetUrl, or resolutionNote.

TASK 5 — music and sfx:
- music: propose AT MOST ONE background music bed for the whole video, only if the content genuinely calls for one (skip it for a plain talking-head clip with no clear mood to underscore — silence is a valid choice). Set "searchQuery" to a short mood/style/genre phrase (e.g. "upbeat corporate", "calm ambient piano") informed by the style preset above if one was given. Leave "duckingEnabled" and "duckingVoiceTrackHint" unset unless you have a specific reason to override the defaults (duckingEnabled defaults to true; omitting duckingVoiceTrackHint auto-ducks every voice track in the project, which is almost always what's wanted). Never set assetId, resolvedAssetUrl, or resolutionNote.
- sfx: propose 0-3 short one-shot sound effects (whoosh/pop/click/etc) ONLY at genuinely emphasized or cut-like moments — reuse the video-understanding emphasis moments given above as your primary cue for WHERE (an emphasis moment is exactly the kind of beat a subtle sfx accent suits). Set "assetQuery" to a short literal sound description (e.g. "whoosh", "pop", "click") and "atMs" to the specific instant. Never set assetId, resolvedAssetUrl, or resolutionNote.

TASK 6 — transitions: ${boundaryGuidance} Propose a transition ONLY at a boundary that's a genuine scene change or beat-relevant moment (e.g. a cut immediately after a bad take or long silence was removed) — never on every single boundary reflexively; it's completely fine to propose zero. For each one, set "betweenClipIds" to EXACTLY ["__scene_segment_N__", "__scene_segment_N+1__"] (literal strings, substituting the real boundary index for N on both sides — e.g. ["__scene_segment_0__", "__scene_segment_1__"]), "type" to one of "CROSSFADE"|"DISSOLVE"|"WIPE"|"SLIDE"|"ZOOM"|"FLASH", and "durationMs" (typically 300-800). Do NOT invent real-looking clip ids — only this exact "__scene_segment_N__" placeholder format is understood.

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{
  "captions": [{ "text": string, "sourceWordStartIndex": number, "sourceWordEndIndex": number, "reveal"?: { "mode": "NONE"|"WORD"|"CHARACTER"|"KARAOKE", "unitDurationMs": number, "style": "FADE"|"POP"|"COLOR_SWEEP", "highlightColor": string }, "style"?: { "fontWeight"?: number, "color"?: string, "fontSize"?: number, "fontFamily"?: string, "position"?: "top"|"center"|"bottom" } }],
  "zoom": [{ "startMs": number, "endMs": number, "scaleFrom": number, "scaleTo": number }],
  "broll": [{ "startMs": number, "endMs": number, "trackHint": "broll", "source": "stock"|"generate", "searchQuery"?: string, "generation"?: { "kind": "image"|"video", "prompt": string } }],
  "stickers": [{ "startMs": number, "endMs": number, "assetQuery": string, "position"?: { "x": number, "y": number } }],
  "music"?: { "searchQuery": string, "duckingEnabled"?: boolean, "duckingVoiceTrackHint"?: string },
  "sfx": [{ "assetQuery": string, "atMs": number }],
  "transitions": [{ "betweenClipIds": [string, string], "type": "CROSSFADE"|"DISSOLVE"|"WIPE"|"SLIDE"|"ZOOM"|"FLASH", "durationMs": number }]
}`;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface JsonRepairLoopParams<T> {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  schema: z.ZodType<T>;
  repairMaxAttempts: number;
  // Every message in this call follows one fixed template EXCEPT the
  // schema-validation-failure error, which names what kind of JSON was
  // expected (e.g. "timeline" for plan(), "re-edit instruction" for
  // reEdit()) — everything else stays byte-identical between callers, so
  // this is the one piece of caller-specific wording, not a general
  // "customize everything" escape hatch.
  errorPrefix: string;
  schemaFailureKind: string;
  signal?: AbortSignal;
}

interface JsonRepairLoopResult<T> {
  data: T;
  providerRef?: string;
  usage?: { tokens?: number };
}

// Phase 12 Module 9 — extracted out of plan()'s own body (which used to
// have this inline) so reEdit() below can reuse the EXACT SAME repair-
// retry mechanics (fetch -> parse -> Zod-validate -> feed the error back
// -> retry once -> give up) rather than a second, drifting copy of the
// same ~50 lines. plan()'s own tests are unchanged by this extraction —
// every error message it asserts on is preserved verbatim via
// errorPrefix/schemaFailureKind.
async function runJsonRepairLoop<T>({ apiKey, model, messages, schema, repairMaxAttempts, errorPrefix, schemaFailureKind, signal }: JsonRepairLoopParams<T>): Promise<JsonRepairLoopResult<T>> {
  let lastRawText = "";
  let lastErrorSummary = "";

  // attempt 0 = the original call; attempts 1..repairMaxAttempts are
  // repair-prompt retries, each re-sending the model's own bad output
  // plus a description of exactly what was wrong with it — the
  // standard "feed the validation error back" repair pattern, capped
  // (never an unbounded loop).
  for (let attempt = 0; attempt <= repairMaxAttempts; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.4, response_format: { type: "json_object" } }),
      signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${errorPrefix} request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error(`${errorPrefix} response did not contain a message.`);
    }
    lastRawText = text;

    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(text);
    } catch {
      lastErrorSummary = "Response was not valid JSON.";
      if (attempt < repairMaxAttempts) {
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content: `That response was not valid JSON: ${lastErrorSummary} Return ONLY the corrected JSON object, matching the exact schema given earlier — no other text.`,
        });
        continue;
      }
      throw new Error(`${errorPrefix} returned invalid JSON even after ${repairMaxAttempts} repair attempt(s): ${lastErrorSummary}`);
    }

    const validated = schema.safeParse(rawParsed);
    if (validated.success) {
      return { data: validated.data, providerRef: json.id, usage: { tokens: json.usage?.total_tokens } };
    }

    lastErrorSummary = validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    if (attempt < repairMaxAttempts) {
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `That JSON failed schema validation: ${lastErrorSummary}. Return ONLY the corrected JSON object, matching the exact schema given earlier — no other text.`,
      });
      continue;
    }
    throw new Error(
      `${errorPrefix} returned invalid ${schemaFailureKind} JSON even after ${repairMaxAttempts} repair attempt(s): ${lastErrorSummary} (last raw response: ${lastRawText.slice(0, 200)})`
    );
  }

  // Unreachable — the loop above always either returns or throws — but
  // keeps TypeScript happy about every code path returning.
  throw new Error(`${errorPrefix} failed: ${lastErrorSummary}`);
}

// Phase 12 Module 9 — a single natural-language instruction about ONE
// currently-selected clip, interpreted into ONE of a small, fixed set of
// real operations (lib/validations/ai-reedit.ts's own discriminated
// union) — never arbitrary code, never a forced guess at the nearest
// supported action. The clip's CURRENT real state is given so the model
// can (a) compute absolute target values from relative instructions
// ("make it bigger" -> a real target scale, given the current one) and
// (b) recognize when the instruction doesn't apply at all (e.g. "remove
// the zoom" when the clip has none) and correctly return "cannot_do"
// instead of inventing an effect to remove.
function buildReeditPrompt(req: ReasoningReeditRequest): string {
  const t = req.clip.transform;
  const transformSection = t
    ? `Current transform: scale ${t.scale}%, position (x:${t.position.x}, y:${t.position.y}), rotation ${t.rotation}°, opacity ${t.opacity}%.`
    : `Current transform: default (scale 100%, position (0,0), rotation 0°, opacity 100%).`;

  const captionSection = req.clip.caption
    ? `This clip has caption text: "${req.clip.caption.text}". Current reveal: ${req.clip.caption.reveal ? JSON.stringify(req.clip.caption.reveal) : "none set (defaults to word-by-word)"}.`
    : `This clip has NO caption text — "change_caption_style" is not valid for it.`;

  const transitionsSection =
    req.clip.adjacentTransitions.length > 0
      ? `Adjacent transitions: ${req.clip.adjacentTransitions.map((tr) => `${tr.side} this clip: ${tr.type} (${tr.durationMs}ms)`).join("; ")}.`
      : `No transitions are attached to either side of this clip — "remove_effect" with effect "transition_before"/"transition_after" is not valid.`;

  return `You are interpreting ONE natural-language editing instruction about ONE currently-selected clip in a video editor's Timeline. You must choose EXACTLY ONE of a small, fixed set of real operations. NEVER invent a new operation. NEVER force an ambiguous or out-of-scope instruction into the nearest-matching operation — use "cannot_do" instead, with a short, clear, user-facing explanation.

Selected clip:
- Duration: ${req.clip.durationMs}ms
- ${transformSection}
- Has a zoom/scale animation (scale property is keyframed): ${req.clip.hasZoomKeyframes ? "YES" : "no"}
- ${captionSection}
- ${transitionsSection}

Instruction: "${req.instruction}"

Choose EXACTLY ONE action:
- "remove_effect": ONLY if the clip genuinely has the effect being asked about. Set "effect" to "zoom" (only if hasZoomKeyframes is YES), or "transition_before"/"transition_after" (only if that side's transition is listed above).
- "change_asset": replace this clip's visual/audio source with different stock footage. Set "searchQuery" to a short, literal, keyword-style stock-search phrase (2-5 words, not a sentence) describing what the user wants instead.
- "adjust_transform": set ONE of position/scale/rotation/opacity to a new ABSOLUTE target value, computed from the CURRENT value given above and the instruction (e.g. "make it 20% bigger" with current scale 100 -> value 120). Set "property" to exactly one of "position"|"scale"|"rotation"|"opacity", and "value" to a plain number for scale/rotation/opacity, or {"x":number,"y":number} for position.
- "change_caption_style": ONLY if the clip has caption text (see above). Set "reveal" (any subset of mode/unitDurationMs/style/highlightColor) and/or "color"/"fontSize" — only the fields the instruction actually calls for.
- "delete_clip": remove this clip entirely. No other fields.
- "cannot_do": the instruction doesn't match any action above, is ambiguous, requests something the clip's current state doesn't support (e.g. "remove the zoom" when it has none), or falls outside this feature's scope (multi-clip instructions, whole-timeline changes, anything not in this list). Set "message" to a short, plain-English sentence explaining why, written for the user directly — never JSON, never internal field names.

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{ "action": "remove_effect", "effect": "zoom"|"transition_before"|"transition_after" }
| { "action": "change_asset", "searchQuery": string }
| { "action": "adjust_transform", "property": "position"|"scale"|"rotation"|"opacity", "value": number | { "x": number, "y": number } }
| { "action": "change_caption_style", "reveal"?: { "mode"?: "NONE"|"WORD"|"CHARACTER"|"KARAOKE", "unitDurationMs"?: number, "style"?: "FADE"|"POP"|"COLOR_SWEEP", "highlightColor"?: string }, "color"?: string, "fontSize"?: number }
| { "action": "delete_clip" }
| { "action": "cannot_do", "message": string }`;
}

export class GPT5ReasoningProvider implements ReasoningProvider {
  readonly id = "gpt5";
  readonly category = "REASONING" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async plan(req: ReasoningPlanRequest, signal?: AbortSignal): Promise<ReasoningPlanResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("gpt5 is enabled but no API key is configured (Admin → AI Providers).");
    }
    const repairMaxAttempts = req.repairMaxAttempts ?? DEFAULT_REPAIR_MAX_ATTEMPTS;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a precise video-editing assistant that outputs ONLY valid JSON, exactly matching the schema you're given. Never include prose, markdown fences, or explanation outside the JSON object.",
      },
      { role: "user", content: buildPrompt(req) },
    ];

    const result = await runJsonRepairLoop({
      apiKey,
      model: this.model,
      messages,
      schema: reasoningPlanOutputSchema,
      repairMaxAttempts,
      errorPrefix: "GPT-5 reasoning",
      schemaFailureKind: "timeline",
      signal,
    });

    return {
      captions: resolveCaptionTiming(result.data.captions, req.words),
      zoom: result.data.zoom,
      broll: result.data.broll,
      stickers: result.data.stickers,
      music: result.data.music,
      sfx: result.data.sfx,
      transitions: result.data.transitions,
      providerRef: result.providerRef,
      usage: result.usage,
    };
  }

  async reEdit(req: ReasoningReeditRequest, signal?: AbortSignal): Promise<ReasoningReeditResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("gpt5 is enabled but no API key is configured (Admin → AI Providers).");
    }
    const repairMaxAttempts = req.repairMaxAttempts ?? DEFAULT_REPAIR_MAX_ATTEMPTS;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a precise video-editing assistant that outputs ONLY valid JSON, exactly matching the schema you're given. Never include prose, markdown fences, or explanation outside the JSON object.",
      },
      { role: "user", content: buildReeditPrompt(req) },
    ];

    const result = await runJsonRepairLoop<AIReeditResponse>({
      apiKey,
      model: this.model,
      messages,
      schema: aiReeditResponseSchema,
      repairMaxAttempts,
      errorPrefix: "GPT-5 re-edit",
      schemaFailureKind: "re-edit instruction",
      signal,
    });

    return { response: result.data, providerRef: result.providerRef, usage: result.usage };
  }
}
