import type { ProviderRuntimeConfig } from "../credentials";
import type { ImageGenerateRequest, ImageGenerateResult, ImageProvider } from "./types";
import { NonRetryableProviderError } from "@/lib/generation/types";

// Gemini has no separate width/height parameter for image generation (unlike
// OpenAI) — aspect ratio is steered via prompt phrasing, folded in below.
const ASPECT_HINT: Record<ImageGenerateRequest["aspectRatio"], string> = {
  RATIO_1_1: "a square 1:1 image",
  RATIO_4_5: "a vertical 4:5 portrait image",
  RATIO_3_4: "a vertical 3:4 portrait image",
  RATIO_2_3: "a vertical 2:3 portrait image",
  RATIO_9_16: "a vertical 9:16 portrait image",
  RATIO_16_9: "a horizontal 16:9 landscape image",
  RATIO_3_2: "a horizontal 3:2 landscape image",
  RATIO_4_3: "a horizontal 4:3 landscape image",
};

// "Nano Banana Pro" — Google's current image-generation model (as of this
// integration, 2026-07). Admin can override via ProviderConfig.
const DEFAULT_MODEL = "gemini-3-pro-image";

interface InteractionContentPart {
  mime_type?: string;
  data?: string;
}

interface InteractionStep {
  content?: InteractionContentPart[];
}

interface InteractionResponse {
  steps?: InteractionStep[];
}

// Real adapter — gemini-3-pro-image is served via Google's newer
// /v1beta/interactions API (client.interactions.create() in the official
// Python SDK), NOT the classic :generateContent endpoint this codebase's
// gemini.provider.ts (LLM) uses — confirmed via a real successful call
// (200, real image returned) after an initial attempt against
// generateContent only got as far as validating the request shape before
// being blocked by free-tier quota. Auth is a header (x-goog-api-key), not
// the ?key= query param the older endpoint uses. Image output arrives as
// base64 inside the last step's content array, not a hosted URL —
// converted to a data: URI here, same convention as every other adapter
// in this directory.
export class GeminiImagesProvider implements ImageProvider {
  readonly id = "gemini_images";
  readonly category = "IMAGE" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generate(req: ImageGenerateRequest, signal?: AbortSignal): Promise<ImageGenerateResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error(
        "gemini_images is enabled but no API key is configured (Admin → AI Providers)."
      );
    }

    // AI Film character variations — text-and-image-to-image editing input,
    // confirmed against Google's own docs (ai.google.dev/gemini-api/docs/
    // image-generation): the interactions API's `input` field accepts an
    // array of {type: "text"|"image", ...} parts instead of a bare string
    // when a reference image is attached, up to 4 images for character
    // consistency. Falls back to the plain string shape (unchanged from
    // before) when no reference image is given — every other caller of this
    // provider (Marketing Creative, AI Image, etc.) is unaffected.
    //
    // Marketing Templates (2026-07-24) — referenceImages (plural) merges in
    // ahead of the single referenceImage, so a caller needing BOTH a
    // template's own curated reference style AND the user's uploaded logo
    // can send both in one real call, up to Google's own documented 4-image
    // ceiling — not a new mechanism, just no longer artificially capped at 1.
    const referenceImages = req.referenceImages?.length ? req.referenceImages : req.referenceImage ? [req.referenceImage] : [];

    // Real bug fix (2026-07-25) — a Marketing Template's generated output
    // was confirmed live to completely ignore its own reference image (2
    // real back-to-back generations from the identical template+reference:
    // one rendered a totally different subject matching only the text
    // prompt, the other rendered yet another different, unrelated scene) —
    // the images WERE genuinely reaching this request (confirmed via a real
    // captured request), so the gap wasn't wiring, it was framing: the raw
    // image bytes were appended with zero textual anchor telling the model
    // what they were FOR, competing against an exhaustive, fully
    // self-contained text prompt with nothing pointing the model back at the
    // attachments. Google's own docs (ai.google.dev/gemini-api/docs/
    // image-generation) confirm this is the documented failure mode and its
    // fix: "explicitly anchor each reference to its specific purpose in your
    // text prompt" (e.g. "Take the first image of the woman... add the logo
    // from the second image...") rather than relying on the model to infer
    // unlabeled images matter. This explicit anchor is prepended ahead of
    // the caller's own prompt text for every request that carries a
    // reference image — every current caller (AI Film variations, Marketing
    // Templates, Marketing Creative) benefits, none had this anchor before.
    // Real regression fix (2026-07-25, same day as the anchor-text fix
    // above) — the original wording here asked the model to "preserve its
    // distinguishing visual details (face, features, styling, mood)
    // closely," which live-confirmed (5 real consecutive attempts, same
    // template/reference/logo that had succeeded moments before this
    // wording shipped) started reliably tripping Gemini's own safety/policy
    // filter — every one of those 5 attempts came back a real 400 with
    // "prompt_feedback.block_reason:OTHER" instead of generating anything,
    // a hard regression from the pre-anchor behavior (which at least
    // produced AN image, just not a well-conditioned one). Explicit "match
    // this face/features closely" language pointed at an uploaded photo of
    // a real, identifiable person reads as a likeness/identity-reproduction
    // instruction, which is exactly the class of request these models'
    // safety layers are strictest about — independent of whether the
    // underlying use case (matching a template's style) had nothing to do
    // with identity at all. Reworded to anchor the same "don't ignore the
    // reference, don't invent an unrelated scene" fix around STYLE (mood,
    // lighting, palette, composition, subject type) instead of identity/
    // facial fidelity — keeps the original bug fixed without asking the
    // model to do the one thing that gets requests blocked.
    const referenceInstruction =
      referenceImages.length > 1
        ? "You are given reference image(s) below, after this text. Use the FIRST reference image as the primary visual/style basis for this render — match its overall mood, lighting, color palette, composition, and subject type, rendered according to the instructions below, rather than inventing an unrelated scene that ignores it. Treat any ADDITIONAL reference image(s) after the first (e.g. a logo or brand mark) as a graphic element to naturally incorporate into that same scene."
        : referenceImages.length === 1
          ? "A reference image is given below, after this text. Use it as the primary visual/style basis for this render — match its overall mood, lighting, color palette, composition, and subject type, rendered according to the instructions below, rather than inventing an unrelated scene that ignores it."
          : null;

    const inputParts = [
      referenceInstruction,
      req.prompt,
      `Render this as ${ASPECT_HINT[req.aspectRatio]}.`,
      req.negativePrompt?.trim() ? `Avoid the following: ${req.negativePrompt.trim()}` : null,
    ].filter(Boolean);
    const textInput = inputParts.join("\n\n");

    const input = referenceImages.length
      ? [
          { type: "text", text: textInput },
          ...referenceImages.map((img) => ({ type: "image", data: img.data, mime_type: img.mimeType })),
        ]
      : textInput;

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model.startsWith("models/") ? this.model : `models/${this.model}`,
        input,
        generation_config: { temperature: 1, image_config: { image_size: "1K" } },
        response_modalities: ["image", "text"],
      }),
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const message = `Gemini Images request failed (${res.status}): ${body.slice(0, 300)}`;

      // Real bug fix (2026-07-25) — a deterministic rejection (a 400, or a
      // content-policy block regardless of status) was being retried a
      // second time anyway and coming back byte-for-byte identical, 4 real
      // times in one day — wasted latency, and it wrongly counted toward
      // this provider's health/circuit-breaker as if it were an
      // availability problem. Classify and throw NonRetryableProviderError
      // for these so runGeneration() (engine.ts) stops after one attempt and
      // excludes it from health tracking; genuine transient failures (5xx,
      // network errors, timeouts) are untouched and keep retrying as before.
      let errorCode: unknown;
      try {
        errorCode = JSON.parse(body)?.error?.code;
      } catch {
        // Non-JSON body (e.g. an HTML error page from a proxy/gateway) —
        // fall through, the status-only check below still applies.
      }
      const isDeterministic =
        res.status === 400 || (typeof errorCode === "string" && errorCode.startsWith("prompt_feedback.block_reason"));

      throw isDeterministic ? new NonRetryableProviderError(message) : new Error(message);
    }

    const json: InteractionResponse = await res.json();
    const steps = json.steps ?? [];
    const lastStep = steps[steps.length - 1];
    const imagePart = lastStep?.content?.find((c) => c.mime_type?.startsWith("image/"));
    if (!imagePart?.data || !imagePart.mime_type) {
      throw new Error("Gemini Images response contained no image data.");
    }

    return { imageUrl: `data:${imagePart.mime_type};base64,${imagePart.data}`, usage: { images: 1 } };
  }
}
