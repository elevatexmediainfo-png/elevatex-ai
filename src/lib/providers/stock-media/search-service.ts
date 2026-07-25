import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ProviderCategory } from "@/generated/prisma/client";
import { getStorageProvider } from "@/lib/providers/storage";
import { resolveProviderCredentials } from "../credentials";
import { getStockAdapter } from "./registry";
import { generateImageThumbnail, generateVideoThumbnail } from "@/lib/video-editor/thumbnails";
import { decodeAudioToPeaks } from "@/lib/video-editor/server-waveform";
import type { StockSearchOptions, StockSearchResult } from "./types";

// Module 11 — Part A: search fan-out + materialize-on-drop. Lives beside
// registry.ts (not lib/video-editor/) since it composes provider adapters
// and credentials, the same layer registry.ts/iconscout.adapter.ts already
// occupy — keeps provider-specific imports out of lib/video-editor/.

export interface StockSearchProviderOutcome {
  providerId: string;
  results: StockSearchResult[];
  error?: string;
}

// Fans out to every ENABLED provider in this category in parallel via
// Promise.allSettled (not Promise.all) — this is what makes "one provider
// errors, others still show results" literal: a rejected provider becomes
// one outcome with `error` set, it never takes down the whole search.
export async function searchStockMedia(
  category: ProviderCategory,
  query: string,
  opts: StockSearchOptions = {}
): Promise<{ outcomes: StockSearchProviderOutcome[] }> {
  const enabledProviders = await prisma.providerConfig.findMany({
    where: { category, enabled: true },
    select: { providerId: true },
  });

  const settled = await Promise.allSettled(
    enabledProviders.map(async ({ providerId }) => {
      const config = await resolveProviderCredentials(category, providerId);
      const adapter = getStockAdapter(category, providerId, config);
      if (!adapter) throw new Error(`No adapter wired for ${providerId}.`);
      return adapter.search(query, opts);
    })
  );

  const outcomes: StockSearchProviderOutcome[] = settled.map((result, i) => {
    const providerId = enabledProviders[i]!.providerId;
    if (result.status === "fulfilled") return { providerId, results: result.value };
    return { providerId, results: [], error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
  });

  return { outcomes };
}

function mapResultKindToAssetKind(kind: StockSearchResult["kind"]): "VIDEO" | "AUDIO" | "IMAGE" | "ANIMATION" {
  if (kind === "ICON") return "IMAGE";
  return kind;
}

// Downloads a picked stock-search result's bytes ONCE and writes them to
// our own storage via storage.upload() (not storage.uploadFromUrl(), which
// would fetch internally but never hand the bytes back) — the same fetch
// also feeds thumbnail/waveform generation, avoiding a second round trip.
// This also means real byte-level caching happens even against the mock
// storage provider in dev (mock.provider.ts's upload() genuinely writes to
// local disk; only its OWN uploadFromUrl() passthrough skips a plain
// https:// URL — bypassing that method entirely sidesteps the limitation).
// Never persists the source CDN URL itself, only our own storageKey — this
// is the literal "download-and-cache, never permanent-hotlink" the spec
// asked for, applied uniformly to every provider, not just Pixabay.
export async function materializeStockAsset(
  userId: string,
  providerId: string,
  category: ProviderCategory,
  result: StockSearchResult
) {
  // A 60s timeout — without one, a slow/stalled CDN connection hangs this
  // request (and the client's materialize-then-add-clip await) forever,
  // discovered live during verification when a real Pexels video download
  // stalled with no error and no completion.
  const res = await fetch(result.downloadUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Failed to download ${providerId} asset (${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";

  const kind = mapResultKindToAssetKind(result.kind);
  const storage = await getStorageProvider();
  const safeTitle = result.title.replace(/[^\w.-]/g, "_").slice(0, 80);
  const key = `stock/${category.toLowerCase()}/${providerId}/${randomUUID()}-${safeTitle}`;
  await storage.upload({ key, data: buffer, contentType });

  const asset = await prisma.editorAsset.create({
    data: {
      userId,
      scope: "USER",
      kind,
      status: "READY",
      storageKey: key,
      originalFilename: `${result.title} (${providerId})`,
      mimeType: contentType,
      fileSizeBytes: buffer.byteLength,
      widthPx: result.widthPx,
      heightPx: result.heightPx,
      // Defense in depth (2026-07-21) — the real incident traced to
      // Coverr's adapter passing a numeric-LOOKING STRING here (fixed at
      // the source in coverr.adapter.ts too), which Prisma rejects at
      // runtime with no compile-time warning since StockSearchResult's
      // own type declares `number`. This boundary is where EVERY stock
      // adapter's result ultimately lands, so a coercion here is a real
      // backstop against the same class of bug from any other adapter,
      // not just a re-fix of the one already found.
      durationSeconds: result.durationSeconds != null ? Number(result.durationSeconds) : null,
      // Stock providers expansion (2026-07-18) — don't silently drop a
      // real attribution requirement past this point. Not yet surfaced
      // anywhere AFTER this row exists (asset library grid, clip
      // properties panel, export) — a real, flagged gap, not built here.
      attribution: result.attribution ?? null,
      attributionRequired: result.attributionRequired ?? false,
    },
  });

  // Unsplash's API Terms (distinct from Pexels/Pixabay/its own general
  // license) require pinging this endpoint whenever a photo is actually
  // USED, not just displayed in search results — this materialize step is
  // the real "used" moment (the client is about to place it on the
  // timeline). Fire-and-forget, non-fatal: same "the asset row already
  // exists and is already usable" resilience convention the thumbnail/
  // waveform generation below already follows — a tracking-ping failure
  // must never block the user from actually using the asset they picked.
  if (providerId === "unsplash") {
    const config = await resolveProviderCredentials("STOCK_MEDIA", "unsplash");
    if (config.apiKey) {
      fetch(`https://api.unsplash.com/photos/${encodeURIComponent(result.externalId)}/download`, {
        headers: { Authorization: `Client-ID ${config.apiKey}` },
      }).catch((err) => console.error(`[stock-media] Unsplash download-tracking ping failed for ${result.externalId}:`, err));
    }
  }

  // Best-effort post-processing — same resilience pattern as
  // uploadLibraryAsset(): the asset row already exists and is already
  // usable, a thumbnail/waveform failure here is logged, not thrown.
  try {
    if (kind === "IMAGE") {
      const thumb = await generateImageThumbnail(buffer);
      const thumbKey = `${key}.thumb.jpg`;
      await storage.upload({ key: thumbKey, data: thumb, contentType: "image/jpeg" });
      await prisma.editorAsset.update({ where: { id: asset.id }, data: { thumbnailKey: thumbKey } });
    } else if (kind === "VIDEO") {
      const thumb = await generateVideoThumbnail(buffer);
      const thumbKey = `${key}.thumb.jpg`;
      await storage.upload({ key: thumbKey, data: thumb, contentType: "image/jpeg" });
      await prisma.editorAsset.update({ where: { id: asset.id }, data: { thumbnailKey: thumbKey } });
    } else if (kind === "AUDIO") {
      const peaks = await decodeAudioToPeaks(buffer);
      await prisma.editorAsset.update({ where: { id: asset.id }, data: { waveformPeaks: peaks } });
    }
  } catch (err) {
    console.error(`[stock-media] thumbnail/waveform generation failed for materialized asset ${asset.id}:`, err);
  }

  const finalRow = await prisma.editorAsset.findUniqueOrThrow({ where: { id: asset.id } });
  return {
    id: finalRow.id,
    kind: finalRow.kind,
    status: finalRow.status,
    url: storage.getPublicUrl(finalRow.storageKey),
    thumbnailUrl: finalRow.thumbnailKey ? storage.getPublicUrl(finalRow.thumbnailKey) : null,
    originalFilename: finalRow.originalFilename,
    durationSeconds: finalRow.durationSeconds,
    widthPx: finalRow.widthPx,
    heightPx: finalRow.heightPx,
    waveformPeaks: (finalRow.waveformPeaks as number[] | null) ?? null,
    createdAt: finalRow.createdAt,
  };
}
