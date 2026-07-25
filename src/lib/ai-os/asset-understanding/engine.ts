import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import type { AssetAnalysisResult } from "@/lib/design-intelligence/schema";
import type { CreativeRequest, AssetIntelligence, BrandContext } from "../types";
import { analyzeReferenceImage } from "./analyzers/reference-image";
import { analyzeBrandKit } from "./analyzers/brand-kit";
import { analyzeLogo } from "./analyzers/logo";
// Phase 3.5: static import replaces the dynamic import anti-pattern identified in the
// architecture audit. There is no circular dependency — the audit confirmed this.
import { mapToReferenceIntelligence } from "./analyzers/reference-image-cache";

// Phase 3 — Asset Understanding Engine.
// Single responsibility: resolve every uploaded asset in a CreativeRequest
// into a unified, structured AssetIntelligence object.
//
// Phase 1 created a thin façade over design-intelligence/. Phase 3 replaces
// the lightweight analysis with an expanded one that covers 50+ fields per
// reference image, plus dedicated analyzers for logos and brand kits.
//
// The existing AssetAnalysisResult shape is PRESERVED alongside the new
// ReferenceImageIntelligence shape in the returned AssetIntelligence object —
// the Creative Brain and Creative Director still receive referenceAnalysis
// in the existing format, unchanged.

/** Thrown when a requested asset does not exist or is not owned by the user. */
export class AssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Asset not found or not owned by user: ${assetId}`);
    this.name = "AssetNotFoundError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB cache helpers
// ─────────────────────────────────────────────────────────────────────────────

function mergeAssetAnalysis(row: {
  industry: string | null;
  category: string | null;
  style: string | null;
  mood: string | null;
  platform: string | null;
  details: unknown;
}): AssetAnalysisResult {
  return {
    ...(row.details as Record<string, unknown>),
    industry: row.industry ?? undefined,
    category: row.category ?? undefined,
    style: row.style ?? undefined,
    mood: row.mood ?? undefined,
    platform: row.platform ?? undefined,
  } as AssetAnalysisResult;
}

function isMeaningful(row: { style: string | null; industry: string | null; mood: string | null }): boolean {
  return !!(row.style || row.industry || row.mood);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference image resolution
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedReference {
  legacyResult: AssetAnalysisResult;
  intelligence: AssetIntelligence["reference"];
}

async function resolveReferenceAsset(
  referenceAssetId: string,
  userId: string
): Promise<ResolvedReference> {
  const asset = await prisma.asset.findFirst({
    where: { id: referenceAssetId, userId },
    include: { analysis: true },
  });
  if (!asset) throw new AssetNotFoundError(referenceAssetId);

  // CACHE FIX (Phase 3.5): Use _aiOsVersion as the Phase 3 sentinel — it is always
  // written by our code (not LLM-dependent), so it reliably distinguishes a Phase 3
  // cache entry from a Phase 1 entry. The previous creativeDNA sentinel was fragile
  // because it was never stored in `details` (legacy splitAssetAnalysis only stored
  // the 25 AssetAnalysisResult fields). Now that details contains the full expanded raw
  // including _aiOsVersion, this sentinel works correctly.
  const cachedMeaningful = asset.analysis && isMeaningful(asset.analysis);
  const cachedHasPhase3 = !!(asset.analysis?.details as Record<string, unknown> | null)?._aiOsVersion;

  if (cachedMeaningful && cachedHasPhase3) {
    const legacyResult = mergeAssetAnalysis(asset.analysis!);
    const intelligence = mapToReferenceIntelligence(asset.analysis!.details as Record<string, unknown>);
    return { legacyResult, intelligence };
  }

  // Fresh or upgrade analysis — runs the expanded Phase 3 LLM call.
  const storage = await getStorageProvider();
  const analysis = await analyzeReferenceImage(storage.getPublicUrl(asset.storageKey), userId);

  // Persist to DB (same schema as before — no migration needed).
  if (isMeaningful({ style: analysis.indexed.style, industry: analysis.indexed.industry, mood: analysis.indexed.mood })) {
    await prisma.assetAnalysis.upsert({
      where: { assetId: asset.id },
      create: { assetId: asset.id, ...analysis.indexed, details: analysis.details as object },
      update: { ...analysis.indexed, details: analysis.details as object },
    });
  }

  return { legacyResult: analysis.legacyResult, intelligence: analysis.intelligence };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo resolution
// ─────────────────────────────────────────────────────────────────────────────

async function resolveLogoAsset(
  logoAssetId: string,
  userId: string
): Promise<AssetIntelligence["logo"]> {
  const asset = await prisma.asset.findFirst({ where: { id: logoAssetId, userId } });
  if (!asset) return undefined; // Logo not found — soft fail (not critical to pipeline)

  const storage = await getStorageProvider();
  try {
    return await analyzeLogo(storage.getPublicUrl(asset.storageKey), userId);
  } catch {
    return undefined; // Logo analysis failure is non-fatal
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand context (Phase 1 backward compat + Phase 3 BrandKitIntelligence)
// ─────────────────────────────────────────────────────────────────────────────

async function resolveBrandAssets(userId: string): Promise<{
  brandContext: BrandContext | undefined;
  brandKit: AssetIntelligence["brandKit"];
}> {
  const record = await prisma.brandKit.findUnique({ where: { userId } });
  if (!record) return { brandContext: undefined, brandKit: undefined };

  const brandContext: BrandContext = {
    primaryColor: record.primaryColor,
    secondaryColor: record.secondaryColor,
    fontFamily: record.fontFamily,
  };
  const brandKit = analyzeBrandKit(record);

  return { brandContext, brandKit };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/** Resolves all asset-level inputs for a CreativeRequest into a unified
 *  AssetIntelligence object. Throws AssetNotFoundError only for the primary
 *  reference asset — logo failures are soft (non-fatal). */
export async function resolveAssetIntelligence(
  request: CreativeRequest,
  userId: string
): Promise<AssetIntelligence> {
  const [referenceResult, { brandContext, brandKit }, logoIntelligence] = await Promise.all([
    request.referenceAssetId
      ? resolveReferenceAsset(request.referenceAssetId, userId)
      : Promise.resolve(undefined),
    resolveBrandAssets(userId),
    request.logoAssetId
      ? resolveLogoAsset(request.logoAssetId, userId)
      : Promise.resolve(undefined),
  ]);

  return {
    // Phase 1 backward-compat fields
    referenceAnalysis: referenceResult?.legacyResult,
    brandContext,
    logoAssetId: request.logoAssetId,
    // Phase 3 rich intelligence
    reference: referenceResult?.intelligence,
    logo: logoIntelligence,
    brandKit,
  };
}
