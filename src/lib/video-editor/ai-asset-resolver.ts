import { getConfig } from "@/lib/admin/config";
import { logger } from "@/lib/observability/logger";
import { searchStockMedia, materializeStockAsset } from "@/lib/providers/stock-media/search-service";
import { pickBestStockResult, persistGeneratedMediaAsset } from "./ai-broll-resolver";
import type { AIMusic, AISfx, AISticker } from "@/lib/validations/ai-timeline";

// Phase 12 Module 6 (AI Auto-Editor) — resolves stickers, music, and sfx
// slots GPT-5.x proposed (gpt5.provider.ts's TASK 4/5) into real,
// placeable EditorAssets. Reuses ai-broll-resolver.ts's own
// pickBestStockResult (one scoring rule for every section, not a
// parallel reimplementation per section — the ORIGINAL version of this
// file had its own separate, genuinely broken scoring expression; fixed
// by deleting it and reusing the one broll already got right) and
// persistGeneratedMediaAsset (download-a-URL-or-data-uri-and-persist,
// shared with curated-library materialization below).
//
// Every resolution is independently try/caught, exactly matching broll's
// own convention: one item failing (no curated match, no stock result,
// a materialize error) never blocks another item or the whole job, and
// is recorded via `resolutionNote` (never a forced placeholder) so the
// review UI can flag it distinctly.

export interface TimelineAssetResolutionContext {
  userId: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
}

// Milestone 9's STOCK_ASSET_LIBRARY (Admin Panel, `lib/admin/config.ts`)
// — "Media Library's Stock assets tab and the Video Editor's Sticker
// layer both read this same curated list" per its own doc comment. Real,
// pre-existing, admin-curated content; this is the "curated library"
// the founder's own brief referred to for sticker resolution, checked
// BEFORE falling back to a live stock icon search — a curated match is
// free (no vendor call) and admin-vetted, so it's the higher-priority
// path when the query genuinely matches an entry's label.
async function findCuratedSticker(query: string): Promise<{ id: string; label: string; url: string } | null> {
  const library = await getConfig("STOCK_ASSET_LIBRARY");
  const needle = query.trim().toLowerCase();
  const match = library.find((entry) => entry.kind === "STICKER" && entry.label.toLowerCase().includes(needle));
  return match ? { id: match.id, label: match.label, url: match.url } : null;
}

async function resolveSticker(item: AISticker, ctx: TimelineAssetResolutionContext): Promise<AISticker> {
  if (item.assetId) return item; // already resolved (not produced by GPT today, but a valid pass-through)
  if (!item.assetQuery) return { ...item, resolutionNote: "No assetQuery was provided." };

  try {
    const curated = await findCuratedSticker(item.assetQuery);
    if (curated) {
      // Curated entries are static URLs, not EditorAssets yet — the SAME
      // download-and-cache step generated-media output already goes
      // through (a curated sticker is conceptually "pre-generated
      // content," not a live vendor search result).
      const asset = await persistGeneratedMediaAsset(ctx.userId, "IMAGE", curated.url);
      return { ...item, assetId: asset.id, resolvedAssetUrl: asset.thumbnailUrl ?? asset.url };
    }

    const [iconOutcomes, imageOutcomes] = await Promise.all([
      searchStockMedia("ICON", item.assetQuery, { type: "icon", perPage: 5 }),
      searchStockMedia("STOCK_MEDIA", item.assetQuery, { type: "image", perPage: 5 }),
    ]);
    const picked = pickBestStockResult([...iconOutcomes.outcomes, ...imageOutcomes.outcomes], "ICON", item.assetQuery);
    if (!picked) return { ...item, resolutionNote: `No curated sticker or stock icon/image match for "${item.assetQuery}".` };

    const category = picked.result.kind === "ICON" ? "ICON" : "STOCK_MEDIA";
    const materialized = await materializeStockAsset(ctx.userId, picked.providerId, category, picked.result);
    return { ...item, assetId: materialized.id, resolvedAssetUrl: materialized.thumbnailUrl ?? materialized.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sticker resolution failed.";
    logger.error({ err, item }, "[ai asset resolver] sticker resolution failed");
    return { ...item, resolutionNote: message };
  }
}

async function resolveStockAudio(query: string, ctx: TimelineAssetResolutionContext): Promise<{ id: string; url: string; thumbnailUrl: string | null } | null> {
  const { outcomes } = await searchStockMedia("STOCK_MEDIA", query, { type: "audio", perPage: 5 });
  const picked = pickBestStockResult(outcomes, "AUDIO", query);
  if (!picked) return null;
  const materialized = await materializeStockAsset(ctx.userId, picked.providerId, "STOCK_MEDIA", picked.result);
  return materialized;
}

// CRITICAL per the founder's own instruction: this function only ever
// resolves `assetId` — duckingEnabled/duckingVoiceTrackHint pass through
// UNTOUCHED, exactly as GPT proposed them (schema default duckingEnabled:
// true when GPT omits it). ai-timeline-translator.ts's own translateMusic
// (Module 1, never modified since) is what actually turns
// duckingVoiceTrackHint into real duckingVoiceTrackIds and writes the
// real EditorTrack.ducking* fields — that logic already exists and is
// already correct; this resolver's only job is finding the audio.
async function resolveMusic(item: AIMusic | undefined, ctx: TimelineAssetResolutionContext): Promise<AIMusic | undefined> {
  if (!item) return undefined;
  if (item.assetId) return item;
  if (!item.searchQuery) return { ...item, resolutionNote: "No searchQuery was provided." };

  try {
    const resolved = await resolveStockAudio(item.searchQuery, ctx);
    if (!resolved) return { ...item, resolutionNote: `No stock audio match for "${item.searchQuery}".` };
    return { ...item, assetId: resolved.id, resolvedAssetUrl: resolved.thumbnailUrl ?? resolved.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Music resolution failed.";
    logger.error({ err, item }, "[ai asset resolver] music resolution failed");
    return { ...item, resolutionNote: message };
  }
}

async function resolveSfxItem(item: AISfx, ctx: TimelineAssetResolutionContext): Promise<AISfx> {
  if (item.assetId) return item;
  if (!item.assetQuery) return { ...item, resolutionNote: "No assetQuery was provided." };

  try {
    const resolved = await resolveStockAudio(item.assetQuery, ctx);
    if (!resolved) return { ...item, resolutionNote: `No stock audio match for "${item.assetQuery}".` };
    return { ...item, assetId: resolved.id, resolvedAssetUrl: resolved.thumbnailUrl ?? resolved.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SFX resolution failed.";
    logger.error({ err, item }, "[ai asset resolver] sfx resolution failed");
    return { ...item, resolutionNote: message };
  }
}

export async function resolveStickers(items: AISticker[], ctx: TimelineAssetResolutionContext): Promise<AISticker[]> {
  return Promise.all(items.map((item) => resolveSticker(item, ctx)));
}

export async function resolveSfx(items: AISfx[], ctx: TimelineAssetResolutionContext): Promise<AISfx[]> {
  return Promise.all(items.map((item) => resolveSfxItem(item, ctx)));
}

export { resolveMusic };

export async function resolveTimelinePlanAssets(
  input: { stickers: AISticker[]; music?: AIMusic; sfx: AISfx[] },
  ctx: TimelineAssetResolutionContext
): Promise<{ stickers: AISticker[]; music?: AIMusic; sfx: AISfx[] }> {
  const [stickers, sfx, music] = await Promise.all([resolveStickers(input.stickers, ctx), resolveSfx(input.sfx, ctx), resolveMusic(input.music, ctx)]);
  return { stickers, music, sfx };
}
