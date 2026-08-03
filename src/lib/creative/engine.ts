import { prisma } from "@/lib/prisma";
import { traceStep } from "@/lib/observability/production-trace";
import { generateImage } from "@/lib/generation/image";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { getStorageProvider } from "@/lib/providers/storage";
import { recordAsset } from "@/lib/assets/service";
import { getCreditBalance, consumeCredits, InsufficientCreditsError } from "@/lib/credits/engine";
import { PRESET_PROMPT_PREFIX, PRESETS_BY_KIND, nearestAspectRatioBucket } from "@/lib/validations/creative";
import type { CreateCreativeProjectInput } from "@/lib/validations/creative";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { resizeToTarget, normalizeToJpeg } from "@/lib/image/resize";
import { compositeLogo } from "@/lib/image/composite-logo";
import { getConfig } from "@/lib/admin/config";
import { buildPosterPrompt, INDUSTRY_POSTER_META } from "@/lib/creative/poster-prompt";
import { getIndustryStyleGuidance } from "@/lib/admin/reference-library";
import { composeMarketingPoster } from "@/lib/creative/compose-marketing-poster";
import { detectIntent, type DetectedIntent } from "@/lib/creative/intent-detector";
import { validatePromptSafety, type SafetyResult } from "@/lib/creative/prompt-safety";
import { evaluateImageQuality, type QualityResult } from "@/lib/creative/quality-evaluator";

// Milestone 14 — the shared generation path for AI Image, Social Media, and
// Marketing Creative. All three are mechanically identical (one prompt in,
// one image out, no render queue), differing only in their preset list and
// which CreativeTool row supplies cost/prompt-prefix/preferred provider —
// so this is ONE engine, not three, exactly mirroring the reasoning that
// kept CreativeProject a single model with a `kind` discriminator.
//
// Charge order mirrors renderTalkingHeadScene() (lib/render/pipeline.ts):
// cheap pre-check balance -> generate -> upload + recordAsset -> atomically
// consumeCredits() + mark COMPLETED. Never charges before a successful
// generation.

export const TOOL_KEY_BY_KIND: Record<CreateCreativeProjectInput["kind"], string> = {
  AI_IMAGE: "ai_image",
  SOCIAL_MEDIA: "social_media",
  MARKETING_CREATIVE: "marketing_creative",
};

export class CreativeToolDisabledError extends Error {
  constructor(toolKey: string) {
    super(`Creative tool "${toolKey}" is currently disabled.`);
    this.name = "CreativeToolDisabledError";
  }
}

export interface GenerateCreativeImageResult {
  project: Awaited<ReturnType<typeof prisma.creativeProject.findUniqueOrThrow>>;
  assetId: string;
  qualityResult: QualityResult | null;
}

export async function generateCreativeImage(
  userId: string,
  input: CreateCreativeProjectInput,
  // TEMPORARY — PRODUCTION_TRACE (2026-08-03), optional so no other caller
  // needs updating. See src/lib/observability/production-trace.ts.
  traceId?: string
): Promise<GenerateCreativeImageResult> {
  const startTime = Date.now();
  const trace = (step: string, status: "PASS" | "FAIL", durationMs: number, detail?: unknown) => {
    if (traceId) traceStep(traceId, step, status, durationMs, detail);
  };
  const universalPromptData = input.universalPrompt as { creative_type?: string } | undefined;
  const intent = detectIntent(input.prompt, universalPromptData?.creative_type);

  const toolKey = TOOL_KEY_BY_KIND[input.kind];
  const tool = await prisma.creativeTool.findUnique({ where: { key: toolKey } });
  trace("4_DATABASE", tool?.enabled ? "PASS" : "FAIL", Date.now() - startTime, { toolKey, found: !!tool, enabled: tool?.enabled });
  if (!tool || !tool.enabled) throw new CreativeToolDisabledError(toolKey);

  // Permanent free tier (2026-08-02) — AI Image is free for every
  // authenticated user, unconditionally, regardless of the ai_image
  // CreativeTool row's own configured creditCostEstimate (an admin
  // changing that field must never accidentally re-introduce a charge
  // here). Social Media and Marketing Creative — the other two kinds this
  // same shared engine serves — are completely unaffected; they still
  // read their real cost from `tool.creditCostEstimate` below.
  const amount = input.kind === "AI_IMAGE" ? 0 : tool.creditCostEstimate;
  if (amount > 0) {
    const balance = await getCreditBalance(userId);
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
  }

  const preset = PRESETS_BY_KIND[input.kind].find((p) => p.key === input.presetKey);
  if (!preset) throw new Error(`Unknown preset "${input.presetKey}" for kind "${input.kind}"`);

  // Milestone 15 — exact platform pixel dimensions (when present) determine
  // the generation aspect-ratio bucket too, not just the post-process crop
  // target, so the "Custom" preset and any future named preset stay
  // consistent without manually-curated aspectRatio values.
  const targetWidth = input.targetWidth ?? preset.targetWidth;
  const targetHeight = input.targetHeight ?? preset.targetHeight;
  const aspectRatio = targetWidth && targetHeight ? nearestAspectRatioBucket(targetWidth, targetHeight) : preset.aspectRatio;

  // Ownership-check both optional asset references before persisting them —
  // an unowned id is silently dropped rather than stored as a dangling
  // pointer to another user's asset.
  const [referenceAsset, logoAssetForCreate, posterProfile, posterBrandKit] = await Promise.all([
    input.referenceAssetId ? prisma.asset.findFirst({ where: { id: input.referenceAssetId, userId } }) : null,
    input.logoAssetId ? prisma.asset.findFirst({ where: { id: input.logoAssetId, userId } }) : null,
    input.kind === "MARKETING_CREATIVE" ? prisma.profile.findUnique({ where: { userId } }) : null,
    input.kind === "MARKETING_CREATIVE" ? prisma.brandKit.findUnique({ where: { userId } }) : null,
  ]);

  // Part B — Reference Library. Depends on posterProfile.businessVertical
  // (resolved just above), so it can't join the Promise.all before it.
  // Returns null when the industry has no active analyzed samples and no
  // guidance note, which buildPosterPrompt() treats as "nothing to add."
  const posterStyleGuidance =
    input.kind === "MARKETING_CREATIVE" && posterProfile?.businessVertical
      ? await getIndustryStyleGuidance(posterProfile.businessVertical)
      : null;

  const stylePrefix = PRESET_PROMPT_PREFIX[input.presetKey];
  // M5 — validate + lightly clean the user's raw idea before it enters the
  // generation path. For enhanced prompts (promptEnhanced=true) the pipeline
  // already produced an optimised prompt; for MARKETING_CREATIVE the prompt is
  // fully rebuilt by buildPosterPrompt — so only the plain direct-generation
  // path (AI_IMAGE / SOCIAL_MEDIA, non-enhanced) substitutes the cleaned copy.
  const safetyResult = validatePromptSafety(input.prompt);
  const safeUserPrompt = safetyResult.cleanedPrompt;

  // Advertisement Poster mode (Step 2) — MARKETING_CREATIVE wants the
  // opposite of the essay/NO-TEXT pipeline: a direct instruction to render a
  // complete poster WITH real headline/benefit/contact text in the image,
  // built from the user's saved Profile + BrandKit so the model never
  // invents contact details. AI_IMAGE and SOCIAL_MEDIA are untouched below.
  //
  // promptEnhanced=true means input.prompt already went through the full
  // enhance-prompt pipeline, so re-wrapping it with tool.promptTemplate/
  // stylePrefix here would pollute an already-optimized prompt — send it
  // through verbatim instead. Only a caller that never enhanced the prompt
  // (promptEnhanced defaults false) gets the template+prefix wrap.
  const finalPrompt =
    input.kind === "MARKETING_CREATIVE"
      ? buildPosterPrompt({
          userPrompt: input.prompt,
          presetLabel: preset.label,
          businessName: posterProfile?.businessName ?? null,
          industryLabel: posterProfile?.businessVertical ? INDUSTRY_POSTER_META[posterProfile.businessVertical].label : null,
          cta: posterProfile?.businessVertical
            ? INDUSTRY_POSTER_META[posterProfile.businessVertical].cta
            : INDUSTRY_POSTER_META.OTHER.cta,
          contactPhone: posterBrandKit?.contactPhone ?? null,
          contactWhatsapp: posterBrandKit?.contactWhatsapp ?? null,
          addressLine: posterBrandKit?.addressLine ?? null,
          websiteOrSocial: posterBrandKit?.websiteOrSocial ?? null,
          styleGuidance: posterStyleGuidance,
          contentLanguage: input.contentLanguage,
        })
      : input.promptEnhanced
        ? input.prompt
        : [tool.promptTemplate, stylePrefix, safeUserPrompt].filter(Boolean).join(" ");
  trace("5_PROMPT_COMPILER", "PASS", Date.now() - startTime, { finalPromptLength: finalPrompt.length, promptEnhanced: input.promptEnhanced });

  // Milestone 16 — Universal JSON Prompt's negative_constraints feed the
  // SAME structured negativePrompt channel generateImage() already exposes
  // (ImageGenerateRequest.negativePrompt), alongside whatever the user typed
  // into the wizard's own "Avoid" field — the one channel providers like
  // Flux actually consume (lib/prompt-os/adapters/flux.adapter.ts
  // deliberately omits negative constraints from its prompt TEXT, relying on
  // this merge instead; OpenAI's adapter folds them into the text too, since
  // its provider has no separate channel at all — harmless overlap, not a
  // conflict).
  const negativeConstraints = (input.universalPrompt as { negative_constraints?: string[] } | undefined)
    ?.negative_constraints;
  const mergedNegativePrompt =
    [input.negativePrompt, ...(negativeConstraints ?? [])].filter(Boolean).join(", ") || undefined;

  const project = await prisma.creativeProject.create({
    data: {
      userId,
      kind: input.kind,
      preset: input.presetKey,
      title: input.title,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt || undefined,
      universalPrompt: (input.universalPrompt as object | undefined) ?? undefined,
      aspectRatio,
      contentLanguage: input.contentLanguage,
      status: "DRAFT",
      creditCost: amount,
      referenceAssetId: referenceAsset?.id,
      logoAssetId: logoAssetForCreate?.id,
      targetWidth,
      targetHeight,
    },
  });

  try {
    const storage = await getStorageProvider();
    let buffer: Buffer;
    let contentType: string;

    // Canvas-compositor Step 3 — real blueprint copy/layout composited onto
    // a clean AI background, replacing buildPosterPrompt's "AI draws the
    // text itself" approach for MARKETING_CREATIVE. Never a single point of
    // failure: any error anywhere in this chain (blueprint re-derivation,
    // clean-background generation, logo fetch, compositing) is caught here,
    // logged, and falls through to today's exact buildPosterPrompt path
    // below — the user always gets a poster, never a hard error.
    const composited =
      input.kind === "MARKETING_CREATIVE"
        ? await composeMarketingPoster({
            userId,
            rawIdea: input.rawIdea?.trim() || input.prompt,
            presetKey: input.presetKey,
            industry: posterProfile?.businessVertical ?? null,
            logoStorageKey: logoAssetForCreate?.storageKey ?? null,
            contactPhone: posterBrandKit?.contactPhone ?? null,
            contactWhatsapp: posterBrandKit?.contactWhatsapp ?? null,
            addressLine: posterBrandKit?.addressLine ?? null,
            websiteOrSocial: posterBrandKit?.websiteOrSocial ?? null,
          }).catch((err) => {
            console.error(`[compose-marketing-poster] failed for project ${project.id}, falling back to buildPosterPrompt`, err);
            return null;
          })
        : null;

    if (composited) {
      buffer = composited;
      contentType = "image/jpeg";
    } else {
      // Fixed 2026-07-19 — referenceAsset was fetched and stored on the
      // project (above) but never actually passed to generateImage(),
      // so an attached product/logo reference photo had zero effect on
      // the output — the root cause of the long-standing "product/logo
      // preservation" gap. Wired the same way AI Film's character-
      // variation route already does (variations/route.ts): real bytes,
      // base64-encoded, on ImageGenerateRequest.referenceImage. Only
      // genuinely reference-conditioned on providers that support it
      // (gemini_images) — others silently ignore the field, same
      // "unsupported where absent" contract negativePrompt already has.
      const referenceImage = referenceAsset
        ? {
            mimeType: referenceAsset.mimeType ?? "image/jpeg",
            data: (await storage.download(referenceAsset.storageKey)).toString("base64"),
          }
        : undefined;

      trace("6_PROVIDER_SELECTION", "PASS", 0, { preferredProviderId: tool.defaultProviderId });
      const providerCallStart = Date.now();
      let result;
      try {
        result = await generateImage(
          { prompt: finalPrompt, negativePrompt: mergedNegativePrompt, aspectRatio, referenceImage },
          "creative_image",
          { userId, creativeProjectId: project.id },
          tool.defaultProviderId ?? undefined
        );
        trace("7_8_PROVIDER_REQUEST_RESPONSE", "PASS", Date.now() - providerCallStart, { providerId: result.providerId });
      } catch (providerErr) {
        // Real, unsanitized error — never replaced with a generic message here.
        const detail = providerErr instanceof Error ? providerErr.message : String(providerErr);
        trace("7_8_PROVIDER_REQUEST_RESPONSE", "FAIL", Date.now() - providerCallStart, detail);
        throw providerErr;
      }

      // Fixed (2026-07-24) — the Universal Creative Workflow (AI Image /
      // Social Media / Marketing Creative's non-compositor path) never
      // checked for a mock-fallback result — a real IMAGE provider outage
      // would silently persist MockImageProvider's canned sample as the
      // user's "generated" image/social post/poster, reported COMPLETED.
      // Thrown before any upload/resize/composite/persist step; the
      // existing catch block below already marks the project FAILED with
      // this message and re-throws, no new error-handling path needed.
      if (result.providerId === MOCK_PROVIDER_ID) {
        throw new Error(
          "Generation used the placeholder provider, not a real one — no IMAGE provider is currently enabled and reachable. Check Admin → AI Providers, then try again."
        );
      }

      ({ buffer, contentType } = await toBuffer(result.imageUrl));

      if (targetWidth && targetHeight) {
        buffer = await resizeToTarget(buffer, targetWidth, targetHeight);
        contentType = "image/jpeg";
      } else {
        // Presets with no fixed pixel dimensions (square/portrait/landscape,
        // poster/flyer, facebook_post, twitter_post, etc.) previously uploaded
        // the provider's raw bytes unconverted under the hardcoded `.jpg` key
        // below — see normalizeToJpeg()'s comment for why that broke
        // rendering whenever the actual bytes weren't already a real JPEG.
        buffer = await normalizeToJpeg(buffer);
        contentType = "image/jpeg";
      }

      if (logoAssetForCreate) {
        const logoBuffer = await storage.download(logoAssetForCreate.storageKey);
        const [position, scalePercent] = await Promise.all([
          getConfig("CREATIVE_LOGO_POSITION"),
          getConfig("CREATIVE_LOGO_SCALE_PERCENT"),
        ]);
        buffer = await compositeLogo(buffer, logoBuffer, { position, scalePercent, marginPercent: 4 });
        contentType = "image/jpeg";
      }
    }

    const storageStart = Date.now();
    const uploaded = await storage.upload({
      key: `creative/${project.id}/image.jpg`,
      data: buffer,
      contentType,
    });
    trace("9_STORAGE", "PASS", Date.now() - storageStart, { key: uploaded.key });

    const dbSaveStart = Date.now();
    const { completed, assetId } = await prisma.$transaction(async (tx) => {
      const asset = await recordAsset(
        {
          userId,
          kind: "IMAGE",
          source: "AI_GENERATED",
          storageKey: uploaded.key,
          label: input.title,
          creativeProjectId: project.id,
        },
        tx
      );
      if (amount > 0) {
        await consumeCredits(
          { userId, amount, type: "AI_GENERATION", description: `${tool.label} generation`, creativeProjectId: project.id },
          tx
        );
      }
      const completed = await tx.creativeProject.update({
        where: { id: project.id },
        data: { status: "COMPLETED", resultAssetId: asset.id },
      });
      return { completed, assetId: asset.id };
    });
    trace("10_DATABASE_SAVE", "PASS", Date.now() - dbSaveStart, { creativeProjectId: completed.id, assetId });

    // M5 — quality evaluation: sharp pixel analysis, no API cost, non-blocking.
    const qualityResult = await evaluateImageQuality(buffer).catch(() => null);

    // M5 — persist intent + safety + timing + quality into the existing
    // universalPrompt JSON column (_meta key) without a schema change.
    // Fire-and-forget: never delays the response.
    void storeGenerationMetadata(
      completed.id,
      completed.universalPrompt,
      intent,
      safetyResult,
      Date.now() - startTime,
      qualityResult
    );

    return { project: completed, assetId, qualityResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed for an unknown reason.";
    trace("11_FINAL_RESPONSE", "FAIL", Date.now() - startTime, message);
    await prisma.creativeProject.update({ where: { id: project.id }, data: { status: "FAILED", errorMessage: message } });
    throw err;
  }
}

// Merges M5 metadata into the existing universalPrompt JSON column — no new
// columns, no migration. The `_meta` key is reserved for engine-level signals
// and is never sent to the AI; existing universalPrompt contents are spread
// first so they are preserved exactly.
async function storeGenerationMetadata(
  projectId: string,
  existingUniversalPrompt: unknown,
  intent: DetectedIntent,
  safetyResult: SafetyResult,
  generationTimeMs: number,
  qualityResult: QualityResult | null
): Promise<void> {
  try {
    const existing =
      typeof existingUniversalPrompt === "object" && existingUniversalPrompt !== null
        ? (existingUniversalPrompt as Record<string, unknown>)
        : {};

    await prisma.creativeProject.update({
      where: { id: projectId },
      data: {
        universalPrompt: ({
          ...existing,
          _meta: {
            detectedCategory: intent.category,
            intentConfidence: intent.confidence,
            intentSignals: intent.signals,
            generationTimeMs,
            promptSafetyWarnings: safetyResult.warnings.length > 0 ? safetyResult.warnings : undefined,
            promptWasModified: safetyResult.wasModified ? true : undefined,
            quality: qualityResult ?? undefined,
          },
        }) as object,
      },
    });
  } catch (err) {
    console.error("[engine] storeGenerationMetadata failed silently", err);
  }
}
