import { z } from "zod";
import type { ProviderRuntimeConfig } from "../credentials";
import { logger } from "@/lib/observability/logger";
import { aiReeditResponseSchema, type AIReeditResponse } from "@/lib/validations/ai-reedit";
import type { AICaption } from "@/lib/validations/ai-timeline";
import { buildFallbackCaptionsFromWords, splitTextIntoCaptionChunks, MAX_WORDS_PER_CAPTION } from "@/lib/video-editor/caption-formatting";
import { chatTemperatureParam } from "../openai-chat-params";
import {
  parsePlanOutputLeniently,
  reasoningAudioOutputSchema,
  reasoningCaptionRawSchema,
  reasoningQualityReviewOutputSchema,
  reasoningStoryOutputSchema,
  reasoningVisualsOutputSchema,
  type ReasoningAudioRequest,
  type ReasoningAudioResult,
  type ReasoningCaptionRaw,
  type ReasoningCaptionRequest,
  type ReasoningCaptionResult,
  type ReasoningPlanRequest,
  type ReasoningPlanResult,
  type ReasoningProvider,
  type ReasoningQualityReviewRequest,
  type ReasoningQualityReviewResult,
  type ReasoningReeditRequest,
  type ReasoningReeditResult,
  type ReasoningStoryRequest,
  type ReasoningStoryResult,
  type ReasoningVisualsRequest,
  type ReasoningVisualsResult,
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
//
// Fix (2026-08-06, FIX 5 — "modern social-media captions") — two changes
// on top of the pre-existing index-resolution above:
// (1) a caption whose cited word range is longer than
// MAX_WORDS_PER_CAPTION (12 — see caption-formatting.ts) is now SPLIT into
// multiple caption items, each formatted (proper punctuation, max 6
// words/2 lines, auto-balanced) and individually timed. The split works
// on the MODEL'S OWN text (which may be a rephrased/Hinglish version of
// the underlying transcript words — see this file's own "keeps real
// transcript-word timing even when rephrased" test — so it can't just be
// re-chunked from `words` directly) via splitTextIntoCaptionChunks,
// proportionally mapping each text chunk's fraction of the total word
// count onto the real [words[startIdx].startMs, words[endIdx].endMs]
// time range. The overall start/end anchors are still always real
// transcript timestamps, never invented — only the INTERNAL split points
// between an oversized caption's own multiple resulting captions are a
// proportional (text-length-based) estimate, which is the honest,
// documented approximation this requires once one citation must become
// several real caption items.
// (2) "never return empty captions" — if the model proposed literally
// zero usable captions (an empty response, or every item dropped by
// parsePlanOutputLeniently) despite real transcript words existing, this
// falls back to buildFallbackCaptionsFromWords — the SAME deterministic
// chunking MockReasoningProvider.plan() already uses when there's no real
// reasoning at all, reused (not reimplemented) here for the "the real
// model gave us nothing to work with" case specifically. Never used to
// override captions the model DID successfully propose.
export function resolveCaptionTiming(raw: ReasoningCaptionRaw[], words: ReasoningPlanRequest["words"]): AICaption[] {
  if (words.length === 0) return [];
  const lastIndex = words.length - 1;
  const result: AICaption[] = [];

  for (const c of raw) {
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
    const rangeStartMs = words[startIdx].startMs;
    const rangeEndMs = words[endIdx].endMs;
    const rangeDurationMs = Math.max(1, rangeEndMs - rangeStartMs);

    for (const chunk of splitTextIntoCaptionChunks(c.text)) {
      result.push({
        text: chunk.text,
        startMs: rangeStartMs + Math.round(rangeDurationMs * chunk.startFraction),
        endMs: rangeStartMs + Math.round(rangeDurationMs * chunk.endFraction),
        style: c.style,
        reveal: c.reveal,
        // Fix (2026-08-07) — carried to every resulting chunk unchanged;
        // ai-timeline-translator.ts's resolveCaptionHighlightRuns only
        // ever matches a highlight word against the SPECIFIC chunk's own
        // text, so a word that landed in a different chunk (an oversized
        // caption that got split) simply finds no match there — no extra
        // bookkeeping needed to scope this correctly per chunk.
        highlightWords: c.highlightWords,
      });
    }
  }

  if (result.length === 0) {
    return buildFallbackCaptionsFromWords(words).map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs }));
  }
  return result;
}

// Founder request (2026-08-07 — "context-aware b-roll engine, heavy
// density should visually change the video every few seconds") — pure,
// independently testable: turns a density tier + real video duration into
// a concrete slot-count RANGE, expressed as a real English sentence in
// the prompt (buildPrompt below) rather than a vague "up to N" ceiling
// that doesn't scale with a video's actual length. Rounds proportionally
// for videos shorter than a full minute (the common case — a 30s Reel is
// most of what this pipeline edits) rather than applying the per-minute
// rate only to videos a full minute or longer.
// Quality-calibration pass (2026-08-07, live human-editor review) — a
// real 38.4s talking-head run at the default MEDIUM density produced only
// 2 b-roll slots, undershooting the founder's own explicit target ("a
// 30-40s talking head should get 4-7 meaningful b-rolls, not 1-2"). Root
// cause: a straight per-minute rate rounds a SHORT (<1 min) video down
// hard — MEDIUM's 3-6/min gives just round(3*0.64)=2 to round(6*0.64)=4
// for a 38s clip, and every AI Auto-Edit job in practice is short-form.
// shortFormFloor* below sets an absolute lower bound that only matters
// under ~1 minute — Math.max means it has ZERO effect once the pure
// per-minute math already clears it, so nothing changes for longer
// videos (a 3-minute HEAVY video still scales the same as before).
export function computeBrollTargetRange(sourceDurationMs: number, density: "MINIMAL" | "BALANCED" | "HEAVY" | undefined): { min: number; max: number } {
  const minutes = Math.max(sourceDurationMs, 1) / 60_000;
  const [perMinMin, perMinMax] = density === "HEAVY" ? [6, 12] : density === "MINIMAL" ? [1, 3] : [3, 6];
  const [shortFormFloorMin, shortFormFloorMax] = density === "HEAVY" ? [5, 9] : density === "MINIMAL" ? [2, 4] : [4, 7];
  const min = Math.max(1, shortFormFloorMin, Math.round(perMinMin * minutes));
  const max = Math.max(min, shortFormFloorMax, Math.round(perMinMax * minutes));
  return { min, max };
}

// Re-exported for callers (and this file's own doc comments above) that
// need the hard per-caption word cap without importing caption-
// formatting.ts's whole surface directly.
export { MAX_WORDS_PER_CAPTION };

// AI Video Director (2026-08-07) — extracted verbatim out of buildPrompt's
// own inline TASK 1 text so the standalone Director Caption agent
// (buildCaptionsPrompt below) reuses the exact same viral/Hinglish/
// power-word/highlighting guidance rather than a second, drifting copy.
//
// Quality-calibration pass (2026-08-07, live human-editor review) — this
// constant used to be the LEGACY-only base, with a Director-only sibling
// (DIRECTOR_CAPTION_VOICE_AND_HIGHLIGHT_GUIDANCE) layering face-safety/
// quality-bar/highlight-vocabulary/restructuring guidance on top —
// because AI_EDIT_DIRECTOR_PIPELINE_ENABLED defaults off, every one of
// those improvements was UNREACHABLE in production. A live pipeline run
// + rendered-video review confirmed the real symptom: captions highlighted
// at most 1 word (never 2-4) and had no face-safety instruction at all.
// The Director-only additions were genuinely universal (not
// Director-specific reasoning), so they're merged directly into this
// shared constant now — every caller (legacy buildPrompt's TASK 1 AND
// Director's buildCaptionsPrompt) gets them, and the separate Director
// constant was deleted (it would otherwise just be an alias, pure drift
// risk for zero benefit).
const CAPTION_VOICE_AND_HIGHLIGHT_GUIDANCE = `CAPTION VOICE — write viral, hook-style captions, not a plain transcription. A caption's job is to make someone stop scrolling and keep watching, not to be a court-reporter transcript of every word spoken:
- Punch up the wording. Rather than transcribing verbatim, distill each caption down to its punchiest phrasing — short, declarative, high-impact. "Diabetes ko lightly mat lo" becomes something like "DON'T IGNORE DIABETES" or "BIGGEST MISTAKE" or "3 FOODS TO AVOID" — pick whichever punchy framing actually fits what that moment of the transcript is saying, don't force the same template everywhere.
- Reach for power words where they genuinely fit the moment (never force one into every caption): WARNING, STOP, SAVE, SECRET, PRO TIP, DON'T, BIGGEST, WHY, HOW, TOP 3, IMPORTANT, NEVER.
- Not every caption needs to be a hook — mid-video informational beats can read more plainly; save the punchiest treatment for the moments that most deserve it (the actual hook near the start, a genuine warning/insight, a key number or list item).
- LANGUAGE REGISTER: if the transcript is spoken in Hindi or Hinglish, caption TEXT defaults to Roman-script Hinglish (Hindi-English code-mixed, colloquial, LATIN SCRIPT) — the way a real Indian creator captions their own reels, not formal/textbook Hindi and NEVER Devanagari script, unless the style preset above explicitly asks for something else. Example: "आज से ये मत करो" is WRONG; "Aaj se ye mat karo" is correct. Mix in English naturally where a real bilingual creator would ("Sugar Control", "Morning Routine", "Health Tip", "Business Mistake") rather than translating everything into one language mechanically. If the transcript is entirely in English, this doesn't apply — keep captions in English.
- CTA: if the transcript's own final ~15% doesn't already contain a clear call-to-action, propose ONE additional caption citing the LAST few numbered words (for timing only) whose TEXT is a short CTA appropriate to the content — e.g. "Follow For More", "Save This Reel", "Comment GUIDE", "Like & Share". This is the same "text is rephrased, timing still anchors to real words" mechanic as everything else in this task — never invent a word index range that doesn't exist.

POWER-WORD HIGHLIGHTING — for a caption whose wording genuinely has 2-4 standout words (not every caption needs this), set "highlightWords" to color just those words, using ONLY these five colors: white (#FFFFFF, the default/remaining-text color — you don't need to set this explicitly on non-highlighted words), yellow (#FFD60A), red (#FF3B30), green (#34C759), blue (#0A84FF). Use color to signal SEVERITY/TYPE, not decoration: red for warnings/negatives/urgency ("DON'T", "STOP", "NEVER"), yellow for the key subject/attention word, green for positive/success framing, blue for neutral informational emphasis (a number, a named thing). Across a caption's highlighted words, prefer 2-4 DIFFERENT colors over repeating the same one on every word — color variety itself is part of what reads as "designed," not "default." Example: for the caption "DON'T IGNORE DIABETES RISK", you might set highlightWords to [{"word":"DON'T","color":"#FF3B30"},{"word":"IGNORE","color":"#FFD60A"},{"word":"RISK","color":"#FF3B30"}], leaving "DIABETES" as the default white. Each "word" must be spelled EXACTLY as it appears in this caption's own "text" (case-insensitive match is fine, but the letters must match). Beyond the power words already listed above, also watch for these finance/motivational/business terms and highlight them when they genuinely appear: Investment, Money, Profit, Growth, Business, Success, Mistake, Secret, Truth, Reality.

CAPTION OUTPUT FORMAT — you are writing a SOCIAL MEDIA CAPTION, not a subtitle. A subtitle transcribes; a caption RESTRUCTURES for readability and punch, even when no words need to change meaning. Example: the spoken line "Aaj hum investment seekhenge" becomes the caption "Aaj Investment Seekhte Hai" — reordered/reworded into a punchier, more natural on-screen phrasing, with the key subject word given Title Case even outside of highlightWords. Apply this restructuring instinct to every caption, not just ones with an obvious rephrase.

NEVER COVER THE FACE — this is a talking-head video; the speaker's face sits in the CENTER-to-upper two-thirds of a portrait frame for almost the entire video. Default "style.position" to "bottom" for every caption unless you have a specific reason to do otherwise — this is the same safe zone every professional short-form editor (CapCut, Opus Clip, Descript) defaults to. NEVER set "position":"center" on a talking-head caption — that lands directly on the face. "top" is only appropriate for a brief moment where the bottom is already occupied by something else on screen (a sticker, an on-screen graphic) — it is the exception, not a rotation to cycle through.

QUALITY BAR — calibrate every caption against the editors who cut for Alex Hormozi, Ali Abdaal, Iman Gadzhi, and MrBeast: short, punchy, instantly readable at a glance, never a wall of text, mobile-first (assume a 5-inch phone screen at arm's length, not a desktop preview).`;

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
  // Founder request (2026-08-07 — "context-aware b-roll engine") — density
  // is now a PER-MINUTE rate, not a flat per-video ceiling: a 3-minute
  // HEAVY video should feel as visually restless as a 30-second one, not
  // hit the same absolute cap. computeBrollTargetRange (below) is the
  // real, testable math; this string is just its English restatement.
  const brollRange = computeBrollTargetRange(req.sourceDurationMs, req.brollDensity);
  const brollDensityGuidance =
    req.brollDensity === "MINIMAL"
      ? `B-roll density: LIGHT. Aim for roughly ${brollRange.min}-${brollRange.max} b-roll slots for this video's length (~1-3 per minute) — only for moments that clearly stand out; when in doubt, propose fewer.`
      : req.brollDensity === "HEAVY"
        ? `B-roll density: HEAVY. Aim for roughly ${brollRange.min}-${brollRange.max} b-roll slots for this video's length (~6-12 per minute — the video's visual should genuinely change every few seconds, the way a fast-cut Reel/Short does) — actively look for supporting-shot opportunities, including moments you'd otherwise consider borderline. It is a real failure mode to land far below this range (e.g. proposing only one slot for a full minute of HEAVY content) — if you're short of the target, look again at EVERY sentence for a noun/location/product/action/person/brand you skipped the first pass, per the six categories below. Still propose fewer only if the content genuinely, truly has nothing left to illustrate — never pad with irrelevant cutaways just to hit a count.`
        : `B-roll density: MEDIUM (default). Aim for roughly ${brollRange.min}-${brollRange.max} b-roll slots for this video's length (~3-6 per minute).`;

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

  // Founder request (2026-08-07 — "story rhythm, not a linear timeline")
  // — a short preamble every TASK below is asked to reason within, rather
  // than each section deciding pacing independently with no shared model
  // of the whole video's shape. Kept intentionally short: this is framing
  // for judgment calls the tasks below already make (where to zoom, when
  // to cut to b-roll, when a caption should punch harder), not a new
  // rigid structure imposed on top of them.
  const pacingGuidance = `\nSTORY RHYTHM — think of the edit as: HOOK (first 1-3 seconds must earn attention — the very first caption should be punchy, not a slow warm-up) -> fast pacing through the main content (short caption chunks, frequent visual changes) -> visual support (b-roll/zoom landing on the moments that most need it, not evenly spread on a timer) -> a clear finish, ideally with a call-to-action in the final ~15% of the video (see TASK 1's own CTA instruction below). Every task below should serve this shape, not just its own isolated rule.`;

  return `You are planning the captions, zoom effects, b-roll, stickers, music, sfx, and transitions for a video editor's AI Auto-Editor feature — the target quality bar is a modern short-form AI editor (Opus Clip / Vizard / CapCut Auto Edit style: punchy, fast-paced, visually restless, immediately publishable to Reels/Shorts/TikTok), not a plain transcript with a subtitle track laid under it. You are given the full transcript (word-level timestamps, in milliseconds from the start of the source media) and, if available, a video-understanding analysis.

Transcript words (format "index:word@startMs-endMs" — each word is numbered 0 to ${req.words.length - 1} in order):
${formatWords(req.words)}
${videoSection}
${styleSection}
${scriptSection}
${pacingGuidance}

Source media duration: ${req.sourceDurationMs}ms. Every timestamp you produce (for zoom/broll/stickers/music/sfx/transitions — captions are the one exception, see TASK 1) must be within [0, ${req.sourceDurationMs}].

TASK 1 — captions: Segment the transcript into natural caption chunks (roughly sentence or clause length, not single words, not the entire transcript as one giant caption). For each caption, set "sourceWordStartIndex" and "sourceWordEndIndex" to the FIRST and LAST numbered word index (from the list above) that caption covers — do NOT produce startMs/endMs yourself, the app computes the caption's real timing directly from the ORIGINAL transcript word timestamps at those indices, so just cite the correct index range and its timing will always be exactly right. This applies REGARDLESS of how the caption TEXT is rephrased below — rephrasing changes the WRITTEN TEXT only, never which original word range the caption's timing is derived from. Captions should not overlap (each word index belongs to at most one caption) and should be in chronological order (sourceWordStartIndex strictly increasing across captions).${
    req.referenceScript
      ? ` If the reference script was provided above, use it to CORRECT obvious mis-transcribed words in caption TEXT ONLY (e.g. the transcript says "sink" but the script's context makes clear the speaker said "sync") — never change a caption's sourceWordStartIndex/sourceWordEndIndex based on the script, and never insert script text the transcript's own words don't cover at all (the speaker may have ad-libbed differently than the script). When the script and transcript genuinely disagree on what was said (not just a plausible mishearing), trust the transcript — it's what was actually spoken, the script is only a hint.`
      : ""
  }

${CAPTION_VOICE_AND_HIGHLIGHT_GUIDANCE}

TASK 2 — zoom: Zoom should feel motivated by the SPEECH, not decorative or random — use it ONLY when it improves emphasis. Propose a zoom window (in addition to any video-understanding emphasis moments given above) when the transcript itself signals a moment worth pushing in on:
- A question being asked (the sentence ends with "?" or is phrased as one).
- A specific number, statistic, or list item ("3 foods", "50 percent", "step one").
- A word or short phrase spoken with clear emotional emphasis (the video-understanding emotion beats above are a strong signal for this when available).
Choose a named "style" for every zoom, matched to what's actually happening — never default to the same style repeatedly:
${ZOOM_STYLE_GUIDE}
Vary the intensity by how strong the moment is — don't use the same scaleTo every time: a mild emphasis might be 105-110%, a stronger one 115%, a genuine peak moment up to 120% (never above 150 regardless; "pull_out" reverses scaleFrom/scaleTo instead). Keep scaleFrom around 100 (native size) except for "pull_out". AVOID REPETITIVE RHYTHM — never on a fixed interval, never the identical scale value or style for every window; if you're proposing several zooms across the video, vary spacing, intensity, AND style so it doesn't read as a metronome. Propose 0 to 5 zoom windows total depending on how many of the above genuinely occur — it's fine to propose zero for a video with no real emphasis moments, questions, or numbers; a zoom with no real motivation is worse than no zoom at all.

TASK 3 — broll: ${brollDensityGuidance}${stockOnlyGuidance} understand what the speaker MEANS, not just the words they used — semantic intent, not literal keyword matching. Example: the phrase "I invested" should search concepts like "stock market", "investor", "finance", "money graph", "business growth" — NOT a literal, generic re-enactment like "person investing". EDITORIAL VALUE GATE — never propose a slot just because a word happened to match something photographable: before proposing one, ask "does cutting away HERE genuinely increase understanding (illustrating something abstract or hard to picture), emotion (reinforcing what the moment feels like), or retention (breaking up a stretch that would otherwise sit static too long)?" If the honest answer is "not really, it's just a keyword," skip it — a talking head holding for a few more seconds beats a pointless cutaway. Only propose a slot where the underlying idea is genuinely concrete and visualizable AND clears this bar.

Placement is NOT evenly spaced or random — anchor slots to genuine TRIGGERS: a topic change (the speaker moves from one subject to a clearly different one), a sentence carrying real informational weight (a claim, a warning, a list item — not a filler transition sentence), or one of the six concrete-mention categories below. Scan the transcript specifically for these SIX kinds of concrete, visualizable mentions — each is its own reason to consider a b-roll slot, and a moment often has more than one of these stacked together (e.g. "our founder demoed the app in Mumbai" is a PERSON + a PRODUCT + a LOCATION at once — that's still ONE slot, not three):
- Important NOUNS — a specific physical object or thing named in the transcript (a laptop, a coffee cup, a delivery van, a whiteboard).
- LOCATIONS — a named or clearly implied place or setting (a city, an office, a warehouse, a beach, "our factory floor").
- PRODUCTS — a specific product, app, device, or piece of software being discussed or demoed.
- ACTIONS — a physical action or activity being described (typing, shipping a package, shaking hands, cooking, driving).
- PEOPLE — a role or person being referenced (a founder, a customer, a doctor, a team, "our engineers").
- BRANDS — a named brand, company, or well-known product line mentioned by name.
Use whichever of these actually appear. At HEAVY density specifically, be generous about what counts as "worth illustrating" — a doctor discussing diabetes, for instance, is a real, rich source of b-roll moments well beyond the literal word "doctor": consultations, a hospital or clinic setting, a patient, medicine, a blood test, healthy food, the specific condition itself, nutrition, a medical exam — scan for ALL of these adjacent concrete visuals the topic implies, not just the one or two most obvious nouns.

For each slot, set "trackHint" to "broll", startMs/endMs to a window that VARIES with the moment (roughly 1-4 seconds — never the same duration slot after slot, that's a repetitive-rhythm tell) covering the moment being illustrated, and choose "source". Prefer footage that is PORTRAIT-oriented, CINEMATIC (real production value, considered framing — describe the scene with that quality in mind, not a flat generic stock phrase), and has genuine MOVEMENT/motion over a static photo — describe a scene something is actively DOING, not a still pose; reject any candidate that reads as low-production-value or amateur in your own description:
- "stock": use this whenever a decent keyword search of a real stock photo/video library would PLAUSIBLY turn up something usable — this covers far more than plain everyday objects: everyday objects, people doing everyday things, generic business/tech/nature/city scenes (e.g. "typing on a laptop," "a stock market chart," "a coffee cup on a desk," "a city skyline at night"), AND real-world professions/settings/activities even when fairly specific in COMBINATION (e.g. "a founder pitching investors," "a doctor examining a patient," "a chef plating a dish," "a warehouse worker scanning boxes") — a specific-sounding scene built from ordinary, photographable real-world elements is still "stock," not "generate." Set "searchQuery" to a short, literal, keyword-style search phrase (2-5 words) a stock library search box would actually match well — not a full sentence, and not an abstract concept. ALSO set "searchQueries" to 3-8 SEMANTICALLY RELATED alternative phrasings of the same moment — synonyms, near-synonyms, and category expansions the way a human researcher would broaden a search that came up thin, not just word-order variations of the same phrase. Example: for a moment about a doctor discussing diabetes, "searchQuery" might be "doctor consultation" with "searchQueries" like ["hospital", "patient", "medicine", "blood test", "healthy food", "diabetes", "clinic", "Indian doctor", "nutrition", "medical examination", "healthy breakfast"] — a genuinely useful spread across the topic's adjacent concrete visuals, not near-duplicates of each other. Three specific traps to avoid: (1) if the transcript names an abstract idea rather than a physical thing ("water conservation," "growth," "innovation," "trust"), don't search the abstract phrase itself — describe the one concrete, physically photographable scene or action that represents it instead ("hand turning off a running tap," "small plant sprouting from soil," "two people shaking hands"); (2) avoid a short, generic query built around a word with multiple unrelated real-world meanings ("pump," "crane," "driver") without a disambiguating word, since a stock library will happily match the wrong sense (e.g. "automatic water pump" alone can surface an unrelated industrial concrete pump) — add the one extra literal word that pins down which physical object or setting you mean ("domestic water pump appliance," "construction crane," not "a race car driver's job"); (3) for a BRAND mention specifically, a stock library almost never carries real licensed footage of a named brand — search the generic real-world scene the brand name implies instead of the literal brand name (a mention of a specific coffee brand becomes "coffee shop counter" or "barista pouring coffee," not the brand's own name as a search phrase). An approximate stock match is virtually always the right choice over spending real generation credits for a closer one.
- "generate": real money is spent per generated item, stock costs nothing — this is a COST decision, not just a quality one, so treat "generate" as a rare last resort, never a coin-flip default. Use it ONLY when you're confident NO real-world photo or video could plausibly exist for this — fictional/surreal/impossible content (a creature that doesn't exist, a physically impossible scene), an exact custom/branded visual that must match specific unreproducible details (a specific app's exact UI mockup), or a genuinely abstract concept with no literal photographable form. If you can picture ANY real photo or video that would reasonably illustrate the moment — even an imperfect match — that is a "stock" case, not a "generate" one. Set "generation" to { "kind": "image"|"video", "prompt": a detailed visual description }. Prefer "kind":"image" over "video" unless genuine motion is essential to what's being shown — a generated still image is far cheaper and faster, and works fine as a brief cutaway.
When genuinely uncertain between the two, ALWAYS choose "stock" — an approximate free match costs nothing, an unnecessary generation call spends real credits for marginal benefit. Never set resolvedAssetId, resolvedAssetUrl, or resolutionNote — those are filled in by a later step, not you.

TASK 4 — stickers: Propose 0-3 sticker/icon overlays based on the TOPIC actually being discussed, not random decorative emoji. Pick an icon that concretely represents the subject matter — health content calls for a heart/medicine-cross/stethoscope icon, business content a money/growth-chart icon, tech content a chip/AI icon, food content a plate/ingredient icon, travel content a plane/map-pin icon, education content a book/graduation-cap icon — the same category thinking as TASK 3's b-roll, just as a small persistent overlay icon instead of a full cutaway shot. A pure emotional-beat sparkle/star/fire is still valid when nothing topical fits, but prefer a topical icon when the content clearly has one. Set "assetQuery" to a short keyword describing that icon (e.g. "heart icon", "money growth chart", "stethoscope", "sparkles" for a pure emotional beat), startMs/endMs to a brief window (0.5-2 seconds), and "position" (0..1 fraction of frame, e.g. {"x":0.8,"y":0.15} for top-right) if you have an opinion, otherwise omit it. This is a light garnish, not a requirement — propose zero far more often than not. Never set assetId, resolvedAssetUrl, or resolutionNote.

TASK 5 — music and sfx:
- music: propose AT MOST ONE background music bed for the whole video, only if the content genuinely calls for one (skip it for a plain talking-head clip with no clear mood to underscore — silence is a valid choice). First identify which CATEGORY the content actually fits — business, corporate, finance, motivational, healthcare, calm, podcast, minimal, comedy, fun, travel, or cinematic — then set "searchQuery" to a short mood/style/genre phrase matching that category (e.g. "upbeat corporate" for business, "calm ambient piano" for healthcare/calm, "motivational cinematic build" for motivational), informed by the style preset above if one was given. Leave "duckingEnabled" and "duckingVoiceTrackHint" unset unless you have a specific reason to override the defaults (duckingEnabled defaults to true — the music automatically ducks under speech and fades appropriately; omitting duckingVoiceTrackHint auto-ducks every voice track in the project, which is almost always what's wanted). Never set assetId, resolvedAssetUrl, or resolutionNote.
  MUSIC MUST EVOLVE — a flat, unchanging bed reads as robotic. Set "volumeEnvelope" to 3-6 points across the video's own timeline, each {"atFraction": a number 0-1 where 0=start and 1=end, "volumeLevel": a number 0-100}, shaping a real arc that MATCHES what's actually happening at each fraction: build through the hook/opening, briefly PULL BACK (a real dip, not just a smaller rise) right at any pattern-interrupt/topic-change moment so it doesn't fight the speaker, rise again into the next payoff, ease off during a moment that should breathe (a strong statement, a genuine pause), and lift toward the end for the CTA. Never a flat line (every point the same volumeLevel) and never a straight, one-directional ramp — real music breathes up AND down more than once. This envelope is on top of real-time ducking under speech, which still happens automatically regardless.
- sfx: propose 0-4 short one-shot sound effects (most videos genuinely warrant 0-2, not the ceiling) tied to genuine TIMELINE EVENTS, not sprinkled arbitrarily — a whoosh or swipe at a b-roll cut or transition, a pop or click at a caption's punchy entrance or a sticker appearing, an impact or text-pop at the video's single strongest emphasis moment, a sparkle at a positive/success beat. Reuse the video-understanding emphasis moments given above as your primary cue for WHERE when available. Silence is often stronger than sound — the default answer to "should I add an SFX here" is no; NEVER SPAM, only propose more than 1-2 when there are truly that many distinct, real cut/emphasis events to accent, the way a real professional editor's SFX should feel INVISIBLE, felt more than consciously heard. Set "assetQuery" to a short literal sound description (e.g. "whoosh", "swipe", "click", "pop", "impact", "sparkle", "transition", "text pop") and "atMs" to the specific instant. Never set assetId, resolvedAssetUrl, or resolutionNote.

TASK 6 — transitions: ${boundaryGuidance} Propose a transition ONLY at a boundary that's a genuine scene change or beat-relevant moment (e.g. a cut immediately after a bad take or long silence was removed) — never on every single boundary reflexively; it's completely fine to propose zero. For each one, set "betweenClipIds" to EXACTLY ["__scene_segment_N__", "__scene_segment_N+1__"] (literal strings, substituting the real boundary index for N on both sides — e.g. ["__scene_segment_0__", "__scene_segment_1__"]), "type" to one of "CROSSFADE"|"DISSOLVE"|"WIPE"|"SLIDE"|"ZOOM"|"FLASH" (vary the TYPE across the video if you propose more than one — don't reuse the same one boundary after boundary), and "durationMs" (typically 300-800, genuinely varied per transition, not the identical value every time). Do NOT invent real-looking clip ids — only this exact "__scene_segment_N__" placeholder format is understood.

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{
  "captions": [{ "text": string, "sourceWordStartIndex": number, "sourceWordEndIndex": number, "reveal"?: { "mode": "NONE"|"WORD"|"CHARACTER"|"KARAOKE", "unitDurationMs": number, "style": "FADE"|"POP"|"COLOR_SWEEP", "highlightColor": string }, "style"?: { "fontWeight"?: number, "color"?: string, "fontSize"?: number, "fontFamily"?: string, "position"?: "top"|"center"|"bottom" }, "highlightWords"?: [{ "word": string, "color": string }] }],
  "zoom": [{ "startMs": number, "endMs": number, "scaleFrom": number, "scaleTo": number, "style"?: "fast_punch"|"slow_push"|"micro"|"pull_out"|"shake_punch"|"question_zoom"|"number_zoom"|"reveal_zoom" }],
  "broll": [{ "startMs": number, "endMs": number, "trackHint": "broll", "source": "stock"|"generate", "searchQuery"?: string, "searchQueries"?: string[], "generation"?: { "kind": "image"|"video", "prompt": string } }],
  "stickers": [{ "startMs": number, "endMs": number, "assetQuery": string, "position"?: { "x": number, "y": number } }],
  "music"?: { "searchQuery": string, "duckingEnabled"?: boolean, "duckingVoiceTrackHint"?: string, "volumeEnvelope"?: [{ "atFraction": number, "volumeLevel": number }] },
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
      // Fix (2026-08-06) — reasoning-tier models (o-series, gpt-5 family)
      // reject ANY custom temperature value; chatTemperatureParam omits it
      // entirely for those, detected by model name, not hardcoded per
      // caller — see openai-chat-params.ts's own doc comment.
      body: JSON.stringify({ model, messages, ...chatTemperatureParam(model, 0.4), response_format: { type: "json_object" } }),
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

// Fix (2026-08-06, FIX 2 — "AI Timeline Planning is failing") — a
// deliberately SEPARATE loop from runJsonRepairLoop above, not a shared
// abstraction: this one validates the response PER-SECTION/PER-ITEM
// (parsePlanOutputLeniently, ./types.ts) instead of one all-or-nothing
// `schema.safeParse()`, so a single bad broll item can no longer wipe out
// otherwise-valid captions/zoom/etc. Kept as its own function (a small,
// deliberate amount of duplication of the outer fetch/JSON.parse-retry
// skeleton) rather than parametrizing runJsonRepairLoop, since reEdit()'s
// own strict all-or-nothing contract (a single discriminated action, not
// independent sections) is real, tested behavior this fix must not risk
// disturbing. Repair-prompting still fires exactly like before whenever
// anything was dropped and attempts remain — the only actual behavior
// change is what happens once attempts are EXHAUSTED: instead of throwing
// (and the caller resetting every section to empty, the real production
// bug), this returns whatever validated across every attempt, plus
// `warnings` naming exactly what was dropped and why. Only a response
// that isn't valid JSON at all still throws — there's nothing to salvage
// from that shape, same as runJsonRepairLoop's own non-JSON handling.
async function runPlanJsonRepairLoop(params: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  repairMaxAttempts: number;
  errorPrefix: string;
  signal?: AbortSignal;
}): Promise<{ data: ReturnType<typeof parsePlanOutputLeniently>["data"]; warnings: string[]; providerRef?: string; usage?: { tokens?: number } }> {
  const { apiKey, model, messages, repairMaxAttempts, errorPrefix, signal } = params;

  for (let attempt = 0; attempt <= repairMaxAttempts; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      // Fix (2026-08-06) — reasoning-tier models (o-series, gpt-5 family)
      // reject ANY custom temperature value; chatTemperatureParam omits it
      // entirely for those, detected by model name, not hardcoded per
      // caller — see openai-chat-params.ts's own doc comment.
      body: JSON.stringify({ model, messages, ...chatTemperatureParam(model, 0.4), response_format: { type: "json_object" } }),
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

    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(text);
    } catch {
      if (attempt < repairMaxAttempts) {
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content: `That response was not valid JSON: Response was not valid JSON. Return ONLY the corrected JSON object, matching the exact schema given earlier — no other text.`,
        });
        continue;
      }
      throw new Error(`${errorPrefix} returned invalid JSON even after ${repairMaxAttempts} repair attempt(s): Response was not valid JSON.`);
    }

    const { data, warnings } = parsePlanOutputLeniently(rawParsed);
    if (warnings.length === 0) {
      return { data, warnings: [], providerRef: json.id, usage: { tokens: json.usage?.total_tokens } };
    }
    if (attempt < repairMaxAttempts) {
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `Some items in that JSON failed schema validation and were dropped: ${warnings.join(" ")} Return ONLY the corrected, COMPLETE JSON object (every section, not just the previously-invalid parts), matching the exact schema given earlier — no other text.`,
      });
      continue;
    }
    // Repair attempts exhausted — return whatever validated across every
    // attempt rather than losing every section over one bad item (see
    // this function's own doc comment above). This is the ONE real
    // behavior difference from runJsonRepairLoop's own "throw once
    // exhausted" contract.
    return { data, warnings, providerRef: json.id, usage: { tokens: json.usage?.total_tokens } };
  }

  // Unreachable — the loop above always returns — but keeps TypeScript
  // happy about every code path returning.
  throw new Error(`${errorPrefix} failed.`);
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

// ---------------------------------------------------------------------
// AI Video Director (2026-08-07) — 5 new, focused prompt builders, one
// per new agent, replacing slices of buildPrompt's single combined
// prompt. Each is deliberately independent of buildPrompt (no shared
// mutable state, no reuse of buildPrompt itself) so the legacy single-
// call path stays byte-for-byte unchanged regardless of what happens
// here. Small, genuinely-shared fragments (video-understanding section,
// caption-voice guidance) are their own tiny helpers so the SAME wording
// isn't hand-copied and left to drift.
// ---------------------------------------------------------------------

function buildVideoAnalysisFragment(videoAnalysis: ReasoningPlanRequest["videoAnalysis"], noneFallback: string): string {
  return videoAnalysis
    ? `\nVideo-understanding analysis (from watching the footage):
Emphasis moments: ${JSON.stringify(videoAnalysis.emphasisMoments)}
Emotion beats: ${JSON.stringify(videoAnalysis.emotionBeats)}
Visual context: ${JSON.stringify(videoAnalysis.visualContext)}`
    : `\n${noneFallback}`;
}

// Agent 3 — Story + Hook + Retention.
function buildStoryPrompt(req: ReasoningStoryRequest): string {
  const styleSection = req.stylePreset ? `\nStyle preset: "${req.stylePreset}" — let this influence TONE (energetic/calm/bold) but not the story STRUCTURE below.` : "";
  const scriptSection = req.referenceScript ? `\nReference script (provided by the user — may not match the actual recording word-for-word):\n${req.referenceScript}` : "";

  return `You are the Story + Hook + Retention agent inside an AI Video Director — a senior short-form video editor (15+ years, Opus Clip/Vizard/CapCut Auto Edit tier) planning the NARRATIVE STRUCTURE of a talking-head video before any captions, b-roll, zoom, or audio decisions are made downstream. The goal is an edit a professional editor would confidently publish without manual changes.

Transcript words (format "index:word@startMs-endMs", numbered 0 to ${req.words.length - 1}):
${formatWords(req.words)}
${buildVideoAnalysisFragment(req.videoAnalysis, "No video-understanding analysis is available for this source — build the story purely from the transcript.")}
${styleSection}
${scriptSection}

Source media duration: ${req.sourceDurationMs}ms. Every beat's startMs/endMs must be within [0, ${req.sourceDurationMs}].

TASK — STORY RHYTHM: break the video into beats using this rhythm, in order, using ONLY the kinds that genuinely occur (most videos won't have all 7 — never invent a beat that isn't really there): "hook" (the opening moment that must earn attention — always required, always first), "curiosity" (a question or gap that makes the viewer want to keep watching), "value" (the actual substance/information/story — always required), "pattern_interrupt" (a genuine shift in energy, topic, or delivery that resets attention mid-video — optional), "visual_reward" (a moment that pays off with something satisfying to see/hear — optional), "proof" (evidence, a result, a demonstration, a specific number backing up a claim — optional), "cta" (a closing call-to-action). Beats must be chronological and non-overlapping, and together should roughly span the full video (small unaccounted-for stretches are fine — this is a narrative skeleton, not frame-perfect coverage). For each beat set a short "description" (what happens here) and, when there's a genuine editorial reason, "reason" (why this counts as this KIND of beat).

TASK — HOOK: identify (or, if the literal opening words are weak, propose an IMPROVED) the hook. Set "hookText" to the strongest possible opening line for this content — if the transcript's actual first few seconds are already strong, use them close to verbatim; if they're a slow warm-up ("Hi guys, so today I wanted to talk about..."), propose a punchier alternative a real editor would open on instead. Set "hookStrengthReason" — a short, honest editorial note on WHY this hook works (or the biggest risk if it's weak).

TASK — RETENTION: set "retentionScore" (0-100) — YOUR OWN editorial judgment (an opinion, not a measured statistic) of how likely a typical viewer is to keep watching past the first 3 seconds and through to the end, given the hook, pacing, and content. Be honest and calibrated, not automatically optimistic — a genuinely weak or slow opening should score well below 100. Set "retentionRisks" (0-6 short strings) naming SPECIFIC concrete risks (e.g. "slow first 2 seconds before any hook", "no clear payoff until very late", "monotone pacing in the middle third") — empty array if you see none.

TASK — CTA: set "ctaPresent" true if the transcript's own final ~15% already contains a clear call-to-action; if not, set it false and propose one in "ctaText" (e.g. "Follow For More", "Save This Reel", "Comment GUIDE", "Like & Share") for the downstream Caption agent to place.

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{
  "beats": [{ "kind": "hook"|"curiosity"|"value"|"pattern_interrupt"|"visual_reward"|"proof"|"cta", "startMs": number, "endMs": number, "description": string, "reason"?: string }],
  "hookText": string,
  "hookStrengthReason"?: string,
  "retentionScore": number,
  "retentionRisks": string[],
  "ctaPresent"?: boolean,
  "ctaText"?: string
}`;
}

// Agent 4 — Captions. Same CAPTION_VOICE_AND_HIGHLIGHT_GUIDANCE the
// legacy plan() uses, informed by the Story agent's own beats/hook/CTA.
function buildCaptionAgentPrompt(req: ReasoningCaptionRequest): string {
  const styleSection = req.stylePreset
    ? `\nStyle preset: "${req.stylePreset}". Let this genuinely influence the captions' reveal style:
- Punchy / energetic / shorts-style presets: reveal.mode "WORD" (or "KARAOKE" for a sing-along feel), short unitDurationMs (120-220), style "POP" or "COLOR_SWEEP".
- Calm / professional / documentary-style presets: reveal.mode "NONE" (a static, non-animated caption per line) — set this EXPLICITLY; omitting "reveal" entirely defaults to word-by-word reveal, the WRONG choice for a calm preset.
- Bold / hinglish presets: set "style.fontWeight" to 800 or 900 and "style.color" to a high-contrast color on every caption.`
    : `\nNo style preset was chosen — use the neutral default: omit "reveal" entirely, or set reveal.mode "WORD" explicitly.`;
  const scriptSection = req.referenceScript
    ? `\nReference script (provided by the user — may not match the actual recording word-for-word): ${req.referenceScript}\nUse it to CORRECT obvious mis-transcribed words in caption TEXT ONLY — never change a caption's sourceWordStartIndex/sourceWordEndIndex based on the script, and never insert script text the transcript's own words don't cover at all. When the script and transcript genuinely disagree, trust the transcript.`
    : "";
  const beatsSection =
    req.storyBeats.length > 0
      ? `\nStory beats already planned by the Story agent — use these to know where the hook/CTA/value beats land, but still cite the transcript's own real word indices for every caption's timing: ${JSON.stringify(req.storyBeats)}`
      : "";
  const hookSection = req.hookText ? `\nThe Story agent's chosen hook line: "${req.hookText}" — the caption spanning the opening hook beat should reflect this framing (rephrase toward it, don't ignore it).` : "";
  const ctaSection = req.ctaText
    ? `\nThe Story agent's proposed CTA: "${req.ctaText}" — propose one additional caption citing the transcript's final few word indices (for timing only) whose TEXT is this CTA.`
    : "";

  return `You are the Caption agent inside an AI Video Director — the target quality bar is a modern short-form AI editor (Opus Clip / Vizard / CapCut Auto Edit style: punchy, fast-paced, immediately publishable to Reels/Shorts/TikTok), not a plain transcript with a subtitle track laid under it.

Transcript words (format "index:word@startMs-endMs", numbered 0 to ${req.words.length - 1}):
${formatWords(req.words)}
${styleSection}
${scriptSection}
${beatsSection}
${hookSection}
${ctaSection}

Segment the transcript into natural caption chunks (roughly sentence or clause length). For each caption, set "sourceWordStartIndex" and "sourceWordEndIndex" to the FIRST and LAST numbered word index that caption covers — do NOT produce startMs/endMs yourself, the app computes real timing directly from the ORIGINAL transcript word timestamps at those indices. Captions should not overlap and should be in chronological order (sourceWordStartIndex strictly increasing).

${CAPTION_VOICE_AND_HIGHLIGHT_GUIDANCE}

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{ "captions": [{ "text": string, "sourceWordStartIndex": number, "sourceWordEndIndex": number, "reveal"?: { "mode": "NONE"|"WORD"|"CHARACTER"|"KARAOKE", "unitDurationMs": number, "style": "FADE"|"POP"|"COLOR_SWEEP", "highlightColor": string }, "style"?: { "fontWeight"?: number, "color"?: string, "fontSize"?: number, "fontFamily"?: string, "position"?: "top"|"center"|"bottom" }, "highlightWords"?: [{ "word": string, "color": string }] }] }`;
}

// Quality upgrade (2026-08-07, TASK 5 — "smart zooms") — 8 named style
// archetypes a real editor reaches for, rather than reasoning about raw
// scaleFrom/scaleTo numbers in isolation. Shared between the prompt text
// below and the anti-repetition instruction, so the exact wording can't
// drift between the two.
const ZOOM_STYLE_GUIDE = `- "fast_punch": a quick, snappy push-in (under ~200ms) landing hard on a word — for a sudden emphasis or a punchline.
- "slow_push": a gradual, cinematic push-in over a longer window — for a serious or emotional moment that deserves to build.
- "micro": a very small, subtle scale change (105-108%) — for a quiet moment that still needs SOME life, not a big statement.
- "pull_out": scaleFrom higher than scaleTo (zooming OUT, not in) — for a reveal or a "here's the bigger picture" moment.
- "shake_punch": a fast push-in for a high-energy/shock moment (pairs naturally with a strong SFX from the Audio agent downstream).
- "question_zoom": a push-in landing exactly on a question being asked.
- "number_zoom": a push-in landing exactly on a specific number/statistic/list item being said.
- "reveal_zoom": a push-in timed to land right as new information/a surprising fact is revealed.`;

// Agent 5 — "Visuals": B-roll + Motion (zoom/camera-punch) + Transitions.
function buildVisualsPrompt(req: ReasoningVisualsRequest): string {
  const brollRange = computeBrollTargetRange(req.sourceDurationMs, req.brollDensity);
  const brollDensityGuidance =
    req.brollDensity === "MINIMAL"
      ? `B-roll density: LIGHT. Aim for roughly ${brollRange.min}-${brollRange.max} b-roll slots for this video's length (~1-3 per minute) — only for moments that clearly stand out.`
      : req.brollDensity === "HEAVY"
        ? `B-roll density: HEAVY. Aim for roughly ${brollRange.min}-${brollRange.max} b-roll slots for this video's length (~6-12 per minute — the video's visual should genuinely change every few seconds). It is a real failure mode to land far below this range — if short of the target, look again at every sentence for a noun/location/product/action/person/brand you skipped.`
        : `B-roll density: MEDIUM (default). Aim for roughly ${brollRange.min}-${brollRange.max} b-roll slots for this video's length (~3-6 per minute).`;
  const stockOnlyGuidance = req.brollStockOnly
    ? `\nPOLICY OVERRIDE — generation is disabled. Every b-roll item MUST have "source": "stock" with a real "searchQuery" — never "generate".`
    : "";
  const varietySection =
    req.usedZoomStyles?.length || req.usedTransitionTypes?.length || req.usedStickerQueries?.length || req.usedBrollStyles?.length
      ? `\nVISUAL VARIETY (maintain a diversity score — TASK 9) — already used this video: zoom styles ${JSON.stringify(req.usedZoomStyles ?? [])}, transition types ${JSON.stringify(req.usedTransitionTypes ?? [])}, sticker queries ${JSON.stringify(req.usedStickerQueries ?? [])}, b-roll styles ${JSON.stringify(req.usedBrollStyles ?? [])}. Do not propose the same zoom style, transition type, sticker, or b-roll style you already used — ALTERNATE genuinely, the same way a human editor consciously varies their toolkit shot to shot rather than reaching for the same effect out of habit.`
      : `\nVISUAL VARIETY (maintain a diversity score — TASK 9) — nothing used yet this video; still plan for variety across the whole edit, not just this one call — don't propose the same zoom style/transition/sticker/b-roll style more than once or twice in a row.`;
  const boundaryGuidance =
    req.survivingSegmentCount >= 2
      ? `There will be ${req.survivingSegmentCount} surviving segments of the main clip after the already-decided scene removal — you can propose transitions at boundary indices 0 through ${req.survivingSegmentCount - 2}.`
      : `There is only 1 surviving segment of the main clip — there are NO internal boundaries. Propose zero transitions.`;

  return `You are the Visuals agent (B-roll + Motion + Transitions + Stickers) inside an AI Video Director — an experienced short-form editor (CapCut AI / Opus Clip / Vidyo.ai tier) planning EXACTLY the way a human editor thinks, second by second: for every moment on screen, deliberately decide whether NOTHING should happen (a clean, uninterrupted beat is a real, valid choice — not every second needs an effect), or whether a zoom, b-roll cutaway, transition, or sticker belongs there — and WHY. Never add an effect just to fill space; every decision needs a real editorial reason, captured in that item's own "reason" field.

RETENTION CURVE (TASK 2) — predict where a viewer would drop off and prevent it: introduce a genuine visual change roughly every 2-4 seconds WHEN THE CONTENT ACTUALLY SUPPORTS IT (never force one into a moment with nothing to show) — a talking head must never sit static and unchanged for more than 1.5-2 seconds without SOME visual event (zoom, b-roll, sticker, or an upcoming transition) covering it. Build RHYTHM by alternating between zoom / b-roll / sticker / motion graphic / camera-punch-style zoom rather than leaning on one tool repeatedly — see VISUAL VARIETY below for the concrete anti-repetition rule this implies.

NOTHING SHOULD FEEL ALGORITHMIC — a real editor never lands on the same B-roll duration, the same zoom spacing, or the same transition rhythm twice in a row. Deliberately vary the LENGTH of consecutive b-roll windows (not always exactly 2s, not always exactly 3s), the GAP between consecutive zooms (not evenly spaced like a metronome), and transition durationMs (not the same 400ms every time). If you notice yourself about to propose the same duration/spacing as your last item of that type, change it.

Transcript words (format "index:word@startMs-endMs", numbered 0 to ${req.words.length - 1}):
${formatWords(req.words)}
${buildVideoAnalysisFragment(req.videoAnalysis, "No video-understanding analysis is available for this source.")}

Finalized captions (for real timing/pacing context): ${JSON.stringify(req.captions.map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs })))}
Story beats (know where pattern-interrupt/visual-reward/proof moments land — anchor extra visual energy there): ${JSON.stringify(req.storyBeats)}
${varietySection}

Source media duration: ${req.sourceDurationMs}ms. Every timestamp must be within [0, ${req.sourceDurationMs}].

TASK — B-ROLL (semantic intent, not literal words — TASK 3): understand what the speaker MEANS, not just the words they used. Example: the phrase "I invested" should search concepts like "stock market", "investor", "finance", "money graph", "business growth" — NOT a literal, generic re-enactment like "person investing". Ask yourself what a professional editor would actually cut to for this moment's underlying IDEA. ${brollDensityGuidance}${stockOnlyGuidance}

EDITORIAL VALUE GATE — never propose a b-roll slot just because a word happened to match something photographable. Before proposing one, ask: does cutting away HERE genuinely increase understanding (illustrating something abstract or hard to picture), emotion (reinforcing what the moment feels like), or retention (breaking up a stretch that would otherwise sit static too long)? If the honest answer is "not really, it's just a keyword," skip it — a talking head holding for a few more seconds beats a pointless cutaway. Only propose a slot where the underlying idea is genuinely concrete and visualizable AND clears this bar. Placement is NOT evenly spaced or random — anchor to genuine TRIGGERS: a topic change, a sentence carrying real informational weight, or a concrete mention (important nouns, locations, products, actions, people, brands). At HEAVY density, scan for ALL adjacent concrete visuals a topic implies, not just the one or two most obvious nouns — prefer Indian context where the content itself is Indian/Hinglish. For each slot set "trackHint":"broll", startMs/endMs (a window that VARIES with the moment, roughly 1-4s — never the same duration slot after slot), "source" ("stock" whenever a decent keyword search would plausibly turn up something usable — this is nearly always the right choice; "generate" only for genuinely unphotographable content), "searchQuery" (2-5 literal keywords, your TOP-RANKED choice) AND "searchQueries" (5-10 semantically related expansions, ORDERED BEST-TO-WORST — genuine synonyms/category expansions of the INTENT, not just word-order variations of the same literal phrase; e.g. a doctor/diabetes moment expands to hospital, patient, medicine, blood test, healthy food, clinic, nutrition, medical examination, wellness checkup). Prefer footage that is PORTRAIT-oriented, CINEMATIC (real production value, considered framing — describe the scene with that quality in mind, not a flat generic stock phrase), and has genuine MOVEMENT/motion over a static photo — describe a scene something is actively DOING, not a still pose; reject any candidate that reads as low-production-value or amateur in your own description. Set "contentKind":"motion_graphic" instead of the default "broll" when the moment calls for an animated graphic/icon-style overlay rather than a literal filmed cutaway. Set a short "reason" explaining WHY this specific moment clears the editorial-value bar and why THIS search direction over other options. Never set resolvedAssetId/resolvedAssetUrl/resolutionNote/costUsd — resolution (including never reusing the same clip twice, and preferring the highest-quality available match) happens downstream.

TASK — MOTION / SMART ZOOMS (TASK 5): propose a zoom window when the transcript signals a moment worth pushing in on. Choose a named "style" for every zoom from this set, matched to what's actually happening — never default to the same style repeatedly:
${ZOOM_STYLE_GUIDE}
Vary both the style AND intensity (scaleTo 105-120% for most styles, keep scaleFrom around 100 except "pull_out" which reverses that) — AVOID REPETITIVE RHYTHM, both in spacing (don't zoom on a fixed interval) and in which style you reach for. Set a short "reason" naming which trigger justified this zoom AND why this style fits it. Propose 0-5 total — quality over quantity; a zoom with no real motivation is worse than no zoom at all.

TASK — TRANSITIONS: ${boundaryGuidance} Propose a transition ONLY at a genuine scene-change/beat-relevant boundary — never reflexively on every boundary. For each, set "betweenClipIds" to EXACTLY ["__scene_segment_N__", "__scene_segment_N+1__"], "type" (CROSSFADE|DISSOLVE|WIPE|SLIDE|ZOOM|FLASH — vary the TYPE across the video, don't reuse the same one boundary after boundary), "durationMs" (300-800, genuinely varied per transition — not the identical value every time), and a short "reason".

TASK — STICKERS: propose 0-3 topic-based icon overlays (health -> heart/medicine-cross, business -> money/growth-chart, tech -> chip/AI, food -> plate, travel -> plane/map-pin, education -> book) — never random decorative emoji. Set "assetQuery", startMs/endMs (0.5-2s), optional "position", and a short "reason".

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{
  "zoom": [{ "startMs": number, "endMs": number, "scaleFrom": number, "scaleTo": number, "style"?: "fast_punch"|"slow_push"|"micro"|"pull_out"|"shake_punch"|"question_zoom"|"number_zoom"|"reveal_zoom", "reason"?: string }],
  "broll": [{ "startMs": number, "endMs": number, "trackHint": "broll", "source": "stock"|"generate", "searchQuery"?: string, "searchQueries"?: string[], "generation"?: { "kind": "image"|"video", "prompt": string }, "contentKind"?: "broll"|"motion_graphic", "reason"?: string }],
  "stickers": [{ "startMs": number, "endMs": number, "assetQuery": string, "position"?: { "x": number, "y": number }, "reason"?: string }],
  "transitions": [{ "betweenClipIds": [string, string], "type": "CROSSFADE"|"DISSOLVE"|"WIPE"|"SLIDE"|"ZOOM"|"FLASH", "durationMs": number, "reason"?: string }]
}`;
}

// Agent 6 — "Audio": Music + SFX.
function buildAudioPrompt(req: ReasoningAudioRequest): string {
  const sfxVariety = req.usedSfxQueries?.length
    ? `\nAlready used this video: ${JSON.stringify(req.usedSfxQueries)} — vary your choices instead of repeating any of these.`
    : "";

  return `You are the Audio agent (Music + Sound Effects) inside an AI Video Director. SFX must feel INVISIBLE to a professional editor — an amateur should just feel the edit is energetic, never notice individual effects landing.

Finalized visual/caption timeline (for duck/sync context):
Captions: ${JSON.stringify(req.captions.map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs })))}
B-roll cuts: ${JSON.stringify(req.broll.map((b) => ({ startMs: b.startMs, endMs: b.endMs })))}
Transitions: ${JSON.stringify(req.transitions.map((t) => ({ durationMs: t.durationMs })))}
Story beats: ${JSON.stringify(req.storyBeats)}
${sfxVariety}

Source media duration: ${req.sourceDurationMs}ms.

TASK — MUSIC: propose AT MOST ONE background music bed, only if the content genuinely calls for one (a plain talking-head clip with no clear mood is a valid case for none — silence is a valid choice). Identify the CATEGORY the content fits — business, corporate, finance, motivational, healthcare, calm, podcast, minimal, comedy, fun, travel, or cinematic — driven by the content's actual emotion, topic, energy, pacing, and likely audience, then set "searchQuery" to a short mood/style/genre phrase matching that category. This bed's energy will automatically behave like a real editor's mix downstream — building, pausing at a pattern interrupt, rising again into the payoff, releasing for proof, uplifting toward the CTA — NEVER a flat, unchanging level. Pick a track whose own character can support that real movement (has genuine dynamic range in the source track itself), not one that's already maxed-out/loud throughout. Leave "duckingEnabled"/"duckingVoiceTrackHint" unset unless you have a specific reason to override the defaults (ducking auto-enabled). Set a short "reason". Never set assetId/resolvedAssetUrl/resolutionNote.

TASK — SFX (fire only on real events, use VERY sparingly — TASK 8): silence is often stronger than sound — the default answer to "should I add an SFX here" is no. Propose 0-4 short one-shot sound effects (most videos genuinely warrant 0-2, not the ceiling), EACH tied to one of exactly these timeline events — a zoom landing (whoosh/impact matching the zoom's own style), a number/statistic being said, an emoji/icon-style sticker appearing, a transition, a caption's punchy pop-in entrance, or a genuine reveal/surprise moment. Never propose one for any other reason, and never propose one just because a slot is available. NEVER SPAM; a real professional editor's SFX should feel INVISIBLE, felt more than consciously heard — if you're unsure whether a moment truly needs one, leave it out. Set "assetQuery" (e.g. "whoosh", "swipe", "click", "pop", "impact", "sparkle", "transition", "text pop"), "atMs", and a short "reason" naming which specific event above justified it and why the moment genuinely needed sound rather than silence. Never set assetId/resolvedAssetUrl/resolutionNote.

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{
  "music"?: { "searchQuery": string, "duckingEnabled"?: boolean, "duckingVoiceTrackHint"?: string, "reason"?: string },
  "sfx": [{ "assetQuery": string, "atMs": number, "reason"?: string }]
}`;
}

// Agent 7 — Quality Reviewer. Scores ONLY the 3 categories that genuinely
// require judgment (2026-08-07, TASK 10 quality-upgrade pass — narrowed
// from 4: "emotion" dropped, "zoom" moved to deterministic scoring) —
// everything structurally measurable is scored by quality-review.ts
// without any LLM call (deterministicScores is passed in purely as
// context, not something this call is asked to recompute).
function buildQualityReviewPrompt(req: ReasoningQualityReviewRequest): string {
  return `You are the Quality Reviewer agent inside an AI Video Director — the Lead Editor simulating a final review before this edit ships to Instagram Reels, YouTube Shorts, or TikTok with no further human editing. Ask, for the whole edit: "Would a professional editor approve this for publishing right now?" If ANY part of it still reads as obviously AI-generated — robotic timing, a caption sitting over the speaker's face, an SFX that draws attention to itself, a b-roll cut that adds nothing — that is a NO. Never rate generously just because the pieces are technically present; judge whether it would survive a real human's final pass.

Story: hook "${req.storySummary.hookText}", ${req.storySummary.beats.length} beats, Story agent's own retentionScore ${req.storySummary.retentionScore}.
Captions (${req.captions.length}): ${JSON.stringify(req.captions.map((c) => c.text))}
B-roll (${req.broll.length}) / Zoom (${req.zoom.length}) / Stickers (${req.stickers.length}) / Transitions (${req.transitions.length}) / SFX (${req.sfx.length}) / Music: ${req.music ? "present" : "none"}
Already-computed structural scores (0-100, for context only — do not just restate these): ${JSON.stringify(req.deterministicScores)}
Source media duration: ${req.sourceDurationMs}ms.

Score these 3 categories, each 0-100, as your own honest editorial judgment (never automatically optimistic):
- "hookScore": does the opening genuinely earn attention in the first 1-3 seconds?
- "retentionScore": your own independent estimate of how well this edit holds a viewer to the end (may differ from the Story agent's own score above — this is a fresh judgment, not a copy).
- "storyScore": does the edit actually follow through on the story rhythm (hook -> curiosity -> value -> pattern interrupt -> visual reward -> proof -> cta), or does it feel disjointed/rushed/flat?

Also set "weakCategories" — from this full list: hook, retention, captions, broll, music, sfx, zoom, story, visualVariety, editingRhythm — name every category (including ones you didn't score numerically above) you'd genuinely tell a junior editor to redo before shipping. Empty array if you'd ship this as-is.

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{ "hookScore": number, "hookNote"?: string, "retentionScore": number, "retentionNote"?: string, "storyScore": number, "storyNote"?: string, "weakCategories": string[] }`;
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

    const result = await runPlanJsonRepairLoop({
      apiKey,
      model: this.model,
      messages,
      repairMaxAttempts,
      errorPrefix: "GPT-5 reasoning",
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
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
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

  // AI Video Director (2026-08-07) — 5 new focused agent calls. Each
  // reuses the EXISTING runJsonRepairLoop (already fully generic — no new
  // "shared repair loop" needed, it already is one) rather than
  // reEdit()'s all-or-nothing gate being copied a 3rd/4th/5th time.
  // Per-item lenient validation (parsePlanOutputLeniently's own approach)
  // isn't reused here deliberately — that mechanism exists because ONE
  // combined call's bad broll item used to wipe out five OTHER unrelated
  // sections; these calls each own exactly one section, so an all-or-
  // nothing repair-and-retry is the simpler, equally-safe fit.

  async planStory(req: ReasoningStoryRequest, signal?: AbortSignal): Promise<ReasoningStoryResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("gpt5 is enabled but no API key is configured (Admin → AI Providers).");
    const repairMaxAttempts = req.repairMaxAttempts ?? DEFAULT_REPAIR_MAX_ATTEMPTS;
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a precise video-editing assistant that outputs ONLY valid JSON, exactly matching the schema you're given. Never include prose, markdown fences, or explanation outside the JSON object." },
      { role: "user", content: buildStoryPrompt(req) },
    ];
    const result = await runJsonRepairLoop({ apiKey, model: this.model, messages, schema: reasoningStoryOutputSchema, repairMaxAttempts, errorPrefix: "GPT-5 story planning", schemaFailureKind: "story", signal });
    return {
      beats: result.data.beats,
      hookText: result.data.hookText,
      hookStrengthReason: result.data.hookStrengthReason,
      retentionScore: result.data.retentionScore,
      retentionRisks: result.data.retentionRisks,
      ctaPresent: result.data.ctaPresent,
      ctaText: result.data.ctaText,
      providerRef: result.providerRef,
      usage: result.usage,
    };
  }

  async planCaptions(req: ReasoningCaptionRequest, signal?: AbortSignal): Promise<ReasoningCaptionResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("gpt5 is enabled but no API key is configured (Admin → AI Providers).");
    const repairMaxAttempts = req.repairMaxAttempts ?? DEFAULT_REPAIR_MAX_ATTEMPTS;
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a precise video-editing assistant that outputs ONLY valid JSON, exactly matching the schema you're given. Never include prose, markdown fences, or explanation outside the JSON object." },
      { role: "user", content: buildCaptionAgentPrompt(req) },
    ];
    const wrapperSchema = z.object({ captions: z.array(reasoningCaptionRawSchema) });
    const result = await runJsonRepairLoop({ apiKey, model: this.model, messages, schema: wrapperSchema, repairMaxAttempts, errorPrefix: "GPT-5 caption planning", schemaFailureKind: "captions", signal });
    return { captions: resolveCaptionTiming(result.data.captions, req.words), providerRef: result.providerRef, usage: result.usage };
  }

  async planVisuals(req: ReasoningVisualsRequest, signal?: AbortSignal): Promise<ReasoningVisualsResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("gpt5 is enabled but no API key is configured (Admin → AI Providers).");
    const repairMaxAttempts = req.repairMaxAttempts ?? DEFAULT_REPAIR_MAX_ATTEMPTS;
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a precise video-editing assistant that outputs ONLY valid JSON, exactly matching the schema you're given. Never include prose, markdown fences, or explanation outside the JSON object." },
      { role: "user", content: buildVisualsPrompt(req) },
    ];
    const result = await runJsonRepairLoop({ apiKey, model: this.model, messages, schema: reasoningVisualsOutputSchema, repairMaxAttempts, errorPrefix: "GPT-5 visuals planning", schemaFailureKind: "visuals", signal });
    return { zoom: result.data.zoom, broll: result.data.broll, stickers: result.data.stickers, transitions: result.data.transitions, providerRef: result.providerRef, usage: result.usage };
  }

  async planAudio(req: ReasoningAudioRequest, signal?: AbortSignal): Promise<ReasoningAudioResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("gpt5 is enabled but no API key is configured (Admin → AI Providers).");
    const repairMaxAttempts = req.repairMaxAttempts ?? DEFAULT_REPAIR_MAX_ATTEMPTS;
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a precise video-editing assistant that outputs ONLY valid JSON, exactly matching the schema you're given. Never include prose, markdown fences, or explanation outside the JSON object." },
      { role: "user", content: buildAudioPrompt(req) },
    ];
    const result = await runJsonRepairLoop({ apiKey, model: this.model, messages, schema: reasoningAudioOutputSchema, repairMaxAttempts, errorPrefix: "GPT-5 audio planning", schemaFailureKind: "audio", signal });
    return { music: result.data.music, sfx: result.data.sfx, providerRef: result.providerRef, usage: result.usage };
  }

  async reviewQuality(req: ReasoningQualityReviewRequest, signal?: AbortSignal): Promise<ReasoningQualityReviewResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("gpt5 is enabled but no API key is configured (Admin → AI Providers).");
    const repairMaxAttempts = req.repairMaxAttempts ?? DEFAULT_REPAIR_MAX_ATTEMPTS;
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a precise video-editing assistant that outputs ONLY valid JSON, exactly matching the schema you're given. Never include prose, markdown fences, or explanation outside the JSON object." },
      { role: "user", content: buildQualityReviewPrompt(req) },
    ];
    const result = await runJsonRepairLoop({ apiKey, model: this.model, messages, schema: reasoningQualityReviewOutputSchema, repairMaxAttempts, errorPrefix: "GPT-5 quality review", schemaFailureKind: "quality review", signal });
    return {
      hookScore: result.data.hookScore,
      hookNote: result.data.hookNote,
      retentionScore: result.data.retentionScore,
      retentionNote: result.data.retentionNote,
      storyScore: result.data.storyScore,
      storyNote: result.data.storyNote,
      weakCategories: result.data.weakCategories,
      providerRef: result.providerRef,
      usage: result.usage,
    };
  }
}
