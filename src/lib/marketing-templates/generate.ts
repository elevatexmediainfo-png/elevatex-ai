import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { createReadyEditorAsset } from "@/lib/video-editor/assets";
import { generateImage } from "@/lib/generation/image";
import { renderVideo } from "@/lib/generation/video";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "@/lib/video-editor/aspect-dimensions";

export class MarketingTemplateNotReadyError extends Error {}
export class MarketingTemplateMockFallbackError extends Error {}
export class MissingUserAssetError extends Error {}

export interface GenerateFromMarketingTemplateInput {
  userId: string;
  templateId: string;
  /** The user's own uploaded asset — a real, ownership-checked Asset id (same upload path AI Film's character photos use). Required whenever the template's own userAssetRequired is true. */
  userAssetId?: string;
}

export interface GenerateFromMarketingTemplateResult {
  generationId: string;
  editorAssetId: string;
  /** The provider that actually rendered this — VIDEO output only, undefined for IMAGE. */
  providerId?: string;
}

// Marketing Templates (2026-07-24, simplified in Migration v3 on 2026-08-02)
// — the real generation orchestration: resolve template -> send the Master
// Prompt verbatim (no placeholder substitution — removed in v3) -> real
// provider call (image or video, per the template's own outputType)
// conditioned on the template's own ordered reference assets AND the user's
// own uploaded asset -> real EditorAsset (not a generic Asset — see schema
// comment for why). Deliberately NOT built on generateCreativeImage()/
// CreativeProject (the existing "Universal Creative Workflow") — that
// engine AI-enhances/rewrites the prompt, and is image-only; this needs a
// literal, admin-authored prompt and image-or-video output. Reuses its
// proven PRIMITIVES instead: generateImage()'s multi-image referenceImages
// conditioning, renderVideo()'s startImage conditioning,
// createReadyEditorAsset().
export async function generateFromMarketingTemplate(
  input: GenerateFromMarketingTemplateInput
): Promise<GenerateFromMarketingTemplateResult> {
  const template = await prisma.marketingTemplate.findUnique({
    where: { id: input.templateId },
    include: { referenceAssets: { include: { asset: true }, orderBy: { position: "asc" } } },
  });
  if (!template || !template.isActive) {
    throw new MarketingTemplateNotReadyError("This template is not available.");
  }
  // Same "no fake UI" gate the gallery query applies — re-checked here too,
  // since a direct API call could otherwise bypass the gallery's own filter.
  // Reference assets are optional (per the founder's own spec) — only the
  // Master Prompt and a real, admin-locked Primary Provider are required.
  if (template.promptTemplate.trim().length === 0 || !template.primaryProviderId) {
    throw new MarketingTemplateNotReadyError("This template has no prompt or provider configured yet.");
  }

  const userAsset = input.userAssetId
    ? await prisma.asset.findFirst({ where: { id: input.userAssetId, userId: input.userId } })
    : null;

  // Migration v3 (2026-08-02) — validated here too, not just client-side
  // (generate-form.tsx's own upload gate) — never trust the client alone.
  if (template.userAssetRequired && !userAsset) {
    throw new MissingUserAssetError("This template requires you to upload your own image or video first.");
  }

  // Permanent free tier (2026-08-02) — Marketing Templates bypass the
  // credit system completely: no balance precheck, and (below) no real
  // charge, regardless of this template's own configured creditCost or
  // any admin-set VIDEO_PROVIDER_CREDIT_COSTS override a video-output
  // template's chosen provider might otherwise resolve to. `amount` is
  // still recorded on the generation row for history/analytics — it was
  // never a real deduction from this line, only informational.
  const amount = template.creditCost;

  const generation = await prisma.marketingTemplateGeneration.create({
    data: {
      userId: input.userId,
      templateId: template.id,
      // Migration v3 (2026-08-02) — the exact Master Prompt as it existed
      // at this moment, independent of any later admin edit to the
      // template. See schema.prisma's own comment on this column.
      masterPromptSnapshot: template.promptTemplate,
      userAssetId: userAsset?.id,
      status: "DRAFT",
      creditCost: amount,
    },
  });

  // Migration v3 (2026-08-02) — the user never chooses a provider.
  // allowedProviderIds restricts generateImage()/renderVideo() to EXACTLY
  // these, in this order — Primary, then Fallback if set, then a real
  // error. Never the old preferredProviderId's "reorder, then silently
  // cascade through every other enabled provider in the category" behavior.
  const allowedProviderIds = [template.primaryProviderId, template.fallbackProviderId].filter(
    (id): id is string => Boolean(id)
  );

  // Production Hardening (2026-08-03) — set the instant storage.upload()
  // below succeeds, so the catch block can compensate-delete it if
  // anything AFTER the upload (the $transaction) fails. Declared outside
  // the try so it survives into the catch's scope.
  let uploadedStorageKey: string | undefined;

  try {
    const storage = await getStorageProvider();
    const [referenceImages, userImage] = await Promise.all([
      Promise.all(
        template.referenceAssets.map(async (ref) => {
          const bytes = await storage.download(ref.asset.storageKey);
          return { mimeType: ref.asset.mimeType ?? "image/jpeg", data: bytes.toString("base64") };
        })
      ),
      userAsset
        ? storage.download(userAsset.storageKey).then((bytes) => ({ mimeType: userAsset.mimeType ?? "image/jpeg", data: bytes.toString("base64") }))
        : Promise.resolve(null),
    ]);

    let outputBuffer: Buffer;
    let contentType: string;
    let editorAssetKind: "IMAGE" | "VIDEO";
    let widthPx: number | undefined;
    let heightPx: number | undefined;
    let durationSeconds: number | undefined;
    let resultProviderId: string | undefined;

    if (template.outputType === "IMAGE") {
      // Every curated reference asset, in admin-set order, plus the user's
      // own upload last — multi-image conditioning (2026-07-24 extension).
      const allImages = userImage ? [...referenceImages, userImage] : referenceImages;

      // Removed from Marketing Templates entirely (2026-08-04) — "imagen"
      // (src/lib/providers/image/imagen.provider.ts) is a deprecated
      // Google endpoint (shutting down 2026-08-17, per that file's own
      // comment) with zero reference-image handling, confirmed the real
      // root cause of production still calling
      // models/imagen-4.0-generate-001. The admin API
      // (api/admin/marketing-templates) now rejects "imagen" for NEW
      // primary/fallback choices, but any EXISTING template saved before
      // that validation existed is remapped here, at generation time,
      // rather than thrown as an error — it keeps working immediately,
      // with no admin action required. Scoped to this IMAGE branch only;
      // imagen.provider.ts and its registration in
      // lib/providers/image/index.ts are completely untouched, so every
      // other feature can still use it, and VIDEO's allowedProviderIds
      // (a different provider set, e.g. "veo") is unaffected below.
      const remapImagenToGemini = (id: string | null) => (id === "imagen" ? "gemini_images" : id);
      const imagePrimaryProviderId = remapImagenToGemini(template.primaryProviderId);
      const imageFallbackProviderId = remapImagenToGemini(template.fallbackProviderId);

      // Requirement (2026-08-04) — a template requiring the user's own
      // identity-preserving upload (userAssetRequired) must never fail
      // over to an IMAGE provider that can't use a reference image at
      // all. openai_images (src/lib/providers/image/
      // openai-images.provider.ts) has zero referenceImage/
      // referenceImages handling — confirmed by reading its generate()
      // implementation in full — so it would silently produce a
      // completely unrelated face if it ever ran for one of these
      // templates.
      const IMAGE_PROVIDERS_WITHOUT_REFERENCE_IMAGE_SUPPORT = ["openai_images"];
      // De-duplicated — if both primary and fallback were "imagen", they'd
      // both remap to "gemini_images"; runGeneration() doesn't need the
      // same provider id twice in its chain.
      const rawImageAllowedProviderIds = Array.from(
        new Set([imagePrimaryProviderId, imageFallbackProviderId].filter((id): id is string => Boolean(id)))
      );
      const imageAllowedProviderIds = template.userAssetRequired
        ? rawImageAllowedProviderIds.filter((id) => !IMAGE_PROVIDERS_WITHOUT_REFERENCE_IMAGE_SUPPORT.includes(id))
        : rawImageAllowedProviderIds;

      const result = await generateImage(
        { prompt: template.promptTemplate, aspectRatio: template.aspectRatio, referenceImages: allImages },
        "creative_image",
        { userId: input.userId },
        imagePrimaryProviderId ?? undefined,
        imageAllowedProviderIds
      );
      resultProviderId = result.providerId;
      if (result.providerId === MOCK_PROVIDER_ID) {
        throw new MarketingTemplateMockFallbackError(
          "Generation used the placeholder provider, not a real one — neither the Primary nor Fallback provider is currently enabled and reachable."
        );
      }
      ({ buffer: outputBuffer, contentType } = await toBuffer(result.imageUrl));
      editorAssetKind = "IMAGE";
      const dims = EDITOR_DIMENSIONS_BY_ASPECT[template.aspectRatio];
      widthPx = dims.widthPx;
      heightPx = dims.heightPx;
    } else {
      // Real narrowing, not a cast — AspectRatio was widened to 8 values
      // for the IMAGE output type (2026-08-03), but VIDEO output was
      // deliberately kept at the original 2 (ASPECT_RATIOS_BY_OUTPUT_TYPE.
      // VIDEO, enforced by the admin API's own validation). A VIDEO
      // template can never actually carry one of the 5 new values, but
      // TypeScript can't know that from the DB row's type alone — this
      // guard makes the video provider call's narrower aspectRatio type
      // correct without a cast, and fails loudly (not silently) in the
      // impossible case of a template that somehow got misconfigured.
      const { aspectRatio } = template;
      if (aspectRatio !== "RATIO_9_16" && aspectRatio !== "RATIO_16_9") {
        throw new MarketingTemplateNotReadyError(
          `This template's aspect ratio (${aspectRatio}) isn't supported for video output.`
        );
      }

      // Video conditioning only supports one startImage — the template's
      // own first curated reference (admin-set order) takes priority
      // (keeps the template's visual style/scene intact); the user's own
      // upload is used only when the template has no reference asset at
      // all, never silently dropped either way.
      const result = await renderVideo(
        {
          script: template.promptTemplate,
          aspectRatio,
          durationSeconds: 8,
          quality: "1080p",
          startImage: referenceImages[0] ?? userImage ?? undefined,
        },
        "creative_video",
        { userId: input.userId },
        template.primaryProviderId,
        undefined,
        allowedProviderIds
      );
      if (result.providerId === MOCK_PROVIDER_ID) {
        throw new MarketingTemplateMockFallbackError(
          "Generation used the placeholder provider, not a real one — neither the Primary nor Fallback provider is currently enabled and reachable."
        );
      }
      const { buffer, contentType: videoContentType } = await toBuffer(result.videoUrl);
      outputBuffer = buffer;
      contentType = videoContentType;
      editorAssetKind = "VIDEO";
      durationSeconds = result.durationSeconds;
      const dims = EDITOR_DIMENSIONS_BY_ASPECT[template.aspectRatio];
      widthPx = dims.widthPx;
      heightPx = dims.heightPx;
      resultProviderId = result.providerId;
    }

    const uploaded = await storage.upload({
      key: `marketing-templates/generations/${generation.id}/output.${editorAssetKind === "IMAGE" ? "jpg" : "mp4"}`,
      data: outputBuffer,
      contentType,
    });
    uploadedStorageKey = uploaded.key;

    const { editorAsset } = await prisma.$transaction(async (tx) => {
      const editorAsset = await createReadyEditorAsset(
        {
          userId: input.userId,
          kind: editorAssetKind,
          storageKey: uploaded.key,
          originalFilename: `${template.name}.${editorAssetKind === "IMAGE" ? "jpg" : "mp4"}`,
          mimeType: contentType,
          fileSizeBytes: outputBuffer.byteLength,
          widthPx,
          heightPx,
          durationSeconds,
        },
        tx
      );
      // Permanent free tier (2026-08-02) — no consumeCredits() call here,
      // ever, regardless of the template's own configured creditCost —
      // Marketing Templates never actually charge.
      // Debugging (2026-08-04) — resultProviderId is now persisted for
      // BOTH output types (previously computed in memory but never
      // written to the database for either, and never even assigned at
      // all for IMAGE) so which provider (primary vs. fallback) served a
      // given generation is a queryable, durable fact.
      await tx.marketingTemplateGeneration.update({
        where: { id: generation.id },
        data: { status: "COMPLETED", resultEditorAssetId: editorAsset.id, resultProviderId },
      });
      return { editorAsset };
    });

    return { generationId: generation.id, editorAssetId: editorAsset.id, providerId: resultProviderId };
  } catch (err) {
    // Production Hardening (2026-08-03) — the upload above can succeed and
    // then the $transaction (EditorAsset creation / credit charge / status
    // update) can still fail — without this, that real, already-billed
    // storage object would be orphaned forever (nothing in the DB ever
    // points at it, since the generation row below only gets marked
    // FAILED, never given a resultEditorAssetId). Best-effort: a cleanup
    // failure must never replace or hide the original error.
    if (uploadedStorageKey) {
      const storage = await getStorageProvider();
      await storage.delete(uploadedStorageKey);
    }
    const message = err instanceof Error ? err.message : "Generation failed for an unknown reason.";
    await prisma.marketingTemplateGeneration.update({ where: { id: generation.id }, data: { status: "FAILED", errorMessage: message } });
    throw err;
  }
}
