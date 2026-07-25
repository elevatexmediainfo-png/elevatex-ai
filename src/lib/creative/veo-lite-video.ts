import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { recordAsset } from "@/lib/assets/service";
import { consumeCredits, refundCredits } from "@/lib/credits/engine";
import { checkVideoActionAccess, resolveVideoProviderCredits } from "@/lib/credits/video-actions";
import { renderVideo, generateVoiceoverOrDegrade } from "@/lib/generation";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { getConfig } from "@/lib/admin/config";
import { mergeScenesViaEditor } from "@/lib/scenes/merge-via-editor";
import type { VideoRenderRequest } from "@/lib/providers/video";

// AI Video Phase 2 — Veo 3.1 Lite, single clip. Deliberately simpler than
// Phase 1's Animated Poster Video: no EditorProject/Export Engine involved
// at all, since there's nothing to composite — one real vendor call through
// the existing Generation Engine (failover/retry/health/budget all apply
// for free), upload, record.
//
// Charge-before-generation (2026-07-24) — was precheck-then-charge-after-
// success; changed so credits are reserved BEFORE the real vendor call, not
// after, so a user can't fire many real generations without ever being
// billed if something downstream fails silently. Real refund-on-failure:
// ANY failure after the reservation (render, upload, persist) refunds the
// full reserved amount via refundCredits() (grantCredits() under an
// ADMIN_ADJUSTMENT lot / REFUND transaction — the exact pattern
// GrantInput's own comment already anticipated, never previously called).
// On success, a true-up settles the reservation against the REAL final
// cost (which can differ from what was reserved — a mock-fallback costs 0,
// or the provider-selector's failover can land on a differently-priced
// provider than the one requested) — refund the difference if reserved-too-
// much, charge the difference if reserved-too-little. The true-up runs
// AFTER the asset is durably persisted, so it's only reached on full
// success; any earlier failure just gets the simpler full refund.

const VEO_LITE_ACTION_KEY = "veo_lite";
const VEO_LITE_DURATION_SECONDS = 8; // Veo 3.1 Lite's actual output length, confirmed live — not user-configurable yet

export class VeoLiteVideoError extends Error {}

export interface GenerateVeoLiteVideoInput {
  userId: string;
  prompt: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  negativePrompt?: string;
  /** An existing, owned Asset id to use as the starting frame (image-to-video). Optional — text-only when omitted. */
  startImageAssetId?: string;
  /** User-facing video-provider selector — reordered to the front of the failover chain, not a hard restriction (see renderVideo()'s own comment). */
  preferredProviderId?: string;
  /** Real voice+music support (2026-07-25) — the raw spoken line (not the assembled visual prompt, which no longer asks the video model to voice it — see quick-video-prompt.ts's own comment on why). When set, a real ElevenLabs narration is generated and dubbed over the clip via the same Editor-compositing path GENERATED's merge step uses. */
  spokenLine?: string;
  contentLanguage?: "EN" | "HI" | "HINGLISH";
}

export interface GenerateVeoLiteVideoResult {
  assetId: string;
  storageKey: string;
  creditsCharged: number;
  /** True when the Generation Engine's failover chain was exhausted and this clip is MockVideoProvider's canned placeholder, not a real Veo render — see this file's charging logic below for why that means creditsCharged is 0. */
  isMockFallback: boolean;
  /** The provider that actually rendered this clip — compare against the caller's own requested preferredProviderId to detect a real fallback happened. */
  providerId: string;
  /** Real-resilience support (2026-07-25) — non-null when speech was requested but no real VOICE provider could produce it. The video still generates with real visuals (+ background music, if configured) — this is a caller-visible, honest "narration unavailable" signal. Null when narration wasn't requested or genuinely succeeded. */
  narrationSkippedReason: string | null;
}

export async function generateVeoLiteVideo(input: GenerateVeoLiteVideoInput): Promise<GenerateVeoLiteVideoResult> {
  // Precheck — cheap, avoids reserving credits for a request that would be
  // rejected anyway; consumeCredits() below re-validates atomically.
  const { credits } = await checkVideoActionAccess(input.userId, VEO_LITE_ACTION_KEY);

  if (credits > 0) {
    await consumeCredits({ userId: input.userId, amount: credits, type: "AI_GENERATION", description: "Veo 3.1 Lite Video" });
  }

  try {
    let startImage: VideoRenderRequest["startImage"];
    if (input.startImageAssetId) {
      const imageAsset = await prisma.asset.findFirst({ where: { id: input.startImageAssetId, userId: input.userId } });
      if (!imageAsset) throw new VeoLiteVideoError("Start image asset not found.");
      const storage = await getStorageProvider();
      const buffer = await storage.download(imageAsset.storageKey);
      startImage = { mimeType: imageAsset.mimeType ?? "image/jpeg", data: buffer.toString("base64") };
    }

    const result = await renderVideo(
      {
        script: input.prompt,
        negativePrompt: input.negativePrompt,
        aspectRatio: input.aspectRatio,
        durationSeconds: VEO_LITE_DURATION_SECONDS,
        quality: "1080p",
        startImage,
      },
      "creative_video",
      { userId: input.userId },
      input.preferredProviderId
    );

    // The failover chain can silently resolve to MockVideoProvider (a canned
    // placeholder clip) once every real provider is unhealthy/over-budget —
    // that's the engine working as designed, but it must never be billed
    // identically to a real Veo render. Confirmed live: this codepath used to
    // charge the full 20 credits for a mock "flower.mp4" placeholder with no
    // visible distinction to the user.
    const isMockFallback = result.providerId === MOCK_PROVIDER_ID;
    // Charged for whichever provider actually rendered this (result.providerId),
    // not whichever the user requested — if the chosen provider was
    // unavailable and the chain fell back to a different real provider, the
    // user is billed that provider's real cost, never the one they picked but
    // didn't get.
    const actualCredits = isMockFallback ? 0 : await resolveVideoProviderCredits(credits, result.providerId);

    const { buffer, contentType } = await toBuffer(result.videoUrl);
    const storage = await getStorageProvider();
    const uploaded = await storage.upload({
      key: `creative-video/${input.userId}/${Date.now()}.mp4`,
      data: buffer,
      contentType: contentType || "video/mp4",
    });

    // Real voice+music compositing (2026-07-25) — closes the real gap the
    // founder reported live: Quick Video's own UI promises "speech and
    // sound" but the pipeline never called any VOICE provider or added
    // music at all, relying entirely on the video model's own native audio
    // (which Seedance was separately, silently suppressing — a distinct
    // bug, fixed in seedance.provider.ts). Only runs when there's actually
    // something to composite — a plain silent clip with no speech requested
    // and no admin-configured music skips this entirely, same real cost/
    // latency as before.
    //
    // Real policy change (2026-07-25) — a voice failure used to throw and
    // discard the whole (successfully rendered) video. generateVoiceoverOrDegrade()
    // never throws for a voice problem — it degrades to voice:null + a
    // human-readable reason, so the video still ships with real visuals
    // (+ music, if configured) instead of being blocked entirely just
    // because narration alone failed. What's unchanged: a mock/placeholder
    // result is still never accepted as real narration.
    let finalStorageKey = uploaded.key;
    let voiceKey: string | null = null;
    let narrationSkippedReason: string | null = null;
    if (input.spokenLine?.trim()) {
      const voiceOutcome = await generateVoiceoverOrDegrade(
        { script: input.spokenLine.trim(), contentLanguage: input.contentLanguage ?? "EN" },
        { userId: input.userId }
      );
      narrationSkippedReason = voiceOutcome.narrationSkippedReason;
      if (voiceOutcome.voice) {
        const voiceObj = await storage.uploadFromUrl({
          key: `creative-video/${input.userId}/${Date.now()}-voice.mp3`,
          sourceUrl: voiceOutcome.voice.audioUrl,
          contentType: "audio/mpeg",
        });
        voiceKey = voiceObj.key;
      }
    }
    const backgroundMusicUrl = await getConfig("DEFAULT_BACKGROUND_MUSIC_URL");

    if (voiceKey || backgroundMusicUrl) {
      const merged = await mergeScenesViaEditor({
        userId: input.userId,
        videoProjectId: `quick-video-${crypto.randomUUID()}`,
        aspectRatio: input.aspectRatio,
        finalQuality: "1080p",
        scenes: [{ videoKey: uploaded.key, durationSeconds: VEO_LITE_DURATION_SECONDS, subtitleText: null, voiceKey }],
        backgroundMusicUrl: backgroundMusicUrl || null,
      });
      finalStorageKey = merged.outputKey;
    }

    const asset = await prisma.$transaction(async (tx) =>
      recordAsset(
        { userId: input.userId, kind: "VIDEO", source: "AI_GENERATED", storageKey: finalStorageKey, label: "Veo 3.1 Lite Video" },
        tx
      )
    );

    // True-up the reservation against the real final cost — only reached on
    // full success, after the asset is durably persisted.
    if (actualCredits < credits) {
      await refundCredits({
        userId: input.userId,
        amount: credits - actualCredits,
        description: "Veo 3.1 Lite Video — refund (actual cost less than reserved)",
      });
    } else if (actualCredits > credits) {
      await consumeCredits({
        userId: input.userId,
        amount: actualCredits - credits,
        type: "AI_GENERATION",
        description: "Veo 3.1 Lite Video — additional charge (actual cost exceeded reserved)",
      });
    }

    return {
      assetId: asset.id,
      storageKey: finalStorageKey,
      creditsCharged: actualCredits,
      isMockFallback,
      providerId: result.providerId,
      narrationSkippedReason,
    };
  } catch (err) {
    if (credits > 0) {
      await refundCredits({
        userId: input.userId,
        amount: credits,
        description: "Veo 3.1 Lite Video — generation failed, refunded",
      }).catch((refundErr) => console.error("Failed to refund credits after a failed Veo Lite generation", refundErr));
    }
    throw err;
  }
}
