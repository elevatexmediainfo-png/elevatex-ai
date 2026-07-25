import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { createReadyEditorAsset } from "@/lib/video-editor/assets";
import { generateImage } from "@/lib/generation/image";
import { renderVideo } from "@/lib/generation/video";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { getCreditBalance, consumeCredits, InsufficientCreditsError } from "@/lib/credits/engine";
import { resolveVideoProviderCredits } from "@/lib/credits/video-actions";
import { fillPromptTemplate, MissingPlaceholderValuesError } from "./placeholders";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "@/lib/video-editor/aspect-dimensions";

export class MarketingTemplateNotReadyError extends Error {}
export class MarketingTemplateMockFallbackError extends Error {}

export interface GenerateFromMarketingTemplateInput {
  userId: string;
  templateId: string;
  filledFields: Record<string, string>;
  /** The user's own uploaded logo/image — a real, ownership-checked Asset id (same upload path AI Film's character photos use). */
  logoAssetId?: string;
  /** User-facing video-provider selector (VIDEO output type only) — takes precedence over the template's own admin-set preferredProviderId when both are given. */
  preferredProviderId?: string;
}

export interface GenerateFromMarketingTemplateResult {
  generationId: string;
  editorAssetId: string;
  /** The provider that actually rendered this — VIDEO output only, undefined for IMAGE. Compare against the caller's own requested preferredProviderId to detect a real fallback happened. */
  providerId?: string;
}

// Marketing Templates (2026-07-24) — the real generation orchestration:
// resolve template -> substitute {{placeholders}} -> real provider call
// (image or video, per the template's own outputType) conditioned on BOTH
// the template's curated reference media AND the user's own uploaded logo
// -> real EditorAsset (not a generic Asset — see schema comment for why).
// Deliberately NOT built on generateCreativeImage()/CreativeProject (the
// existing "Universal Creative Workflow") — that engine AI-enhances/
// rewrites the prompt and has no named-placeholder substitution, and is
// image-only; this needs literal substitution and image-or-video output.
// Reuses its proven PRIMITIVES instead: generateImage()'s referenceImage(s)
// conditioning, renderVideo()'s startImage conditioning, compositeLogo-
// adjacent multi-image conditioning, createReadyEditorAsset().
export async function generateFromMarketingTemplate(
  input: GenerateFromMarketingTemplateInput
): Promise<GenerateFromMarketingTemplateResult> {
  const template = await prisma.marketingTemplate.findUnique({
    where: { id: input.templateId },
    include: { referenceMediaAsset: true },
  });
  if (!template || !template.isActive) {
    throw new MarketingTemplateNotReadyError("This template is not available.");
  }
  // Same "no fake UI" gate the gallery query applies — re-checked here too,
  // since a direct API call could otherwise bypass the gallery's own filter.
  if (!template.referenceMediaAssetId || !template.referenceMediaAsset || template.promptTemplate.trim().length === 0) {
    throw new MarketingTemplateNotReadyError("This template has no reference media or prompt configured yet.");
  }

  const finalPrompt = fillPromptTemplate(template.promptTemplate, input.filledFields); // throws MissingPlaceholderValuesError

  const logoAsset = input.logoAssetId
    ? await prisma.asset.findFirst({ where: { id: input.logoAssetId, userId: input.userId } })
    : null;

  const amount = template.creditCost;
  if (amount > 0) {
    const balance = await getCreditBalance(input.userId);
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
  }

  const generation = await prisma.marketingTemplateGeneration.create({
    data: {
      userId: input.userId,
      templateId: template.id,
      filledFields: input.filledFields,
      logoAssetId: logoAsset?.id,
      status: "DRAFT",
      creditCost: amount,
    },
  });

  try {
    const storage = await getStorageProvider();
    const [referenceBytes, logoBytes] = await Promise.all([
      storage.download(template.referenceMediaAsset.storageKey),
      logoAsset ? storage.download(logoAsset.storageKey) : Promise.resolve(null),
    ]);
    const referenceImage = { mimeType: template.referenceMediaAsset.mimeType ?? "image/jpeg", data: referenceBytes.toString("base64") };
    const logoImage = logoBytes && logoAsset ? { mimeType: logoAsset.mimeType ?? "image/jpeg", data: logoBytes.toString("base64") } : null;

    let outputBuffer: Buffer;
    let contentType: string;
    let editorAssetKind: "IMAGE" | "VIDEO";
    let widthPx: number | undefined;
    let heightPx: number | undefined;
    let durationSeconds: number | undefined;
    // Real charge — starts as the precheck estimate, replaced with the
    // provider-resolved amount once the VIDEO branch knows which provider
    // actually served the request. IMAGE never touches this (provider-cost
    // overrides are VIDEO-only scope) — stays the template's own flat cost.
    let finalAmount = amount;
    let resultProviderId: string | undefined;

    if (template.outputType === "IMAGE") {
      // Both conditioning images together — template style AND the user's
      // real logo — via the multi-image referenceImages extension (2026-07-24).
      const referenceImages = logoImage ? [referenceImage, logoImage] : [referenceImage];
      const result = await generateImage(
        { prompt: finalPrompt, aspectRatio: template.aspectRatio, referenceImages },
        "creative_image",
        { userId: input.userId },
        template.preferredProviderId ?? undefined
      );
      if (result.providerId === MOCK_PROVIDER_ID) {
        throw new MarketingTemplateMockFallbackError(
          "Generation used the placeholder provider, not a real one — no IMAGE provider is currently enabled and reachable."
        );
      }
      ({ buffer: outputBuffer, contentType } = await toBuffer(result.imageUrl));
      editorAssetKind = "IMAGE";
      const dims = EDITOR_DIMENSIONS_BY_ASPECT[template.aspectRatio];
      widthPx = dims.widthPx;
      heightPx = dims.heightPx;
    } else {
      // Video conditioning only supports one startImage — the template's
      // own curated reference takes priority (keeps the template's visual
      // style/scene intact); the user's logo is used only when the
      // template has somehow lost its own reference (shouldn't happen,
      // isReady already gates on it), never silently dropped either way.
      //
      // Provider preference (2026-07-24): the user's own explicit choice
      // (input.preferredProviderId) takes precedence over the template's
      // admin-set default (template.preferredProviderId) when both exist —
      // also the real fix for a pre-existing gap found during investigation:
      // template.preferredProviderId was already a real schema field and
      // admin-editable, but was NEVER passed into renderVideo() at all (only
      // the IMAGE branch above ever read it) — a dead knob until now.
      const result = await renderVideo(
        {
          script: finalPrompt,
          aspectRatio: template.aspectRatio,
          durationSeconds: 8,
          quality: "1080p",
          startImage: referenceImage ?? logoImage ?? undefined,
        },
        "creative_video",
        { userId: input.userId },
        input.preferredProviderId ?? template.preferredProviderId ?? undefined
      );
      if (result.providerId === MOCK_PROVIDER_ID) {
        throw new MarketingTemplateMockFallbackError(
          "Generation used the placeholder provider, not a real one — no VIDEO provider is currently enabled and reachable."
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
      // Charged for whichever provider actually rendered this
      // (result.providerId), not necessarily the one requested — see
      // veo-lite-video.ts's identical comment/reasoning.
      finalAmount = await resolveVideoProviderCredits(amount, result.providerId);
      resultProviderId = result.providerId;
    }

    const uploaded = await storage.upload({
      key: `marketing-templates/generations/${generation.id}/output.${editorAssetKind === "IMAGE" ? "jpg" : "mp4"}`,
      data: outputBuffer,
      contentType,
    });

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
      if (finalAmount > 0) {
        await consumeCredits(
          { userId: input.userId, amount: finalAmount, type: "AI_GENERATION", description: `Marketing template: ${template.name}` },
          tx
        );
      }
      await tx.marketingTemplateGeneration.update({
        where: { id: generation.id },
        data: { status: "COMPLETED", resultEditorAssetId: editorAsset.id },
      });
      return { editorAsset };
    });

    return { generationId: generation.id, editorAssetId: editorAsset.id, providerId: resultProviderId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed for an unknown reason.";
    await prisma.marketingTemplateGeneration.update({ where: { id: generation.id }, data: { status: "FAILED", errorMessage: message } });
    throw err;
  }
}

export { MissingPlaceholderValuesError };
