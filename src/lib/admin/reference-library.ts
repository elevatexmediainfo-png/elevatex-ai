import { prisma } from "@/lib/prisma";
import { getStorageProvider, type StorageProvider } from "@/lib/providers/storage";
import { resolveAbsoluteUrl } from "@/lib/providers/storage/absolute-url";
import { analyzeAssetForLibrary } from "@/lib/design-intelligence/analyze-asset";
import type { AssetAnalysisResult } from "@/lib/design-intelligence/schema";
import { INDUSTRY_POSTER_META } from "@/lib/creative/poster-prompt";
import type { BusinessVertical } from "@/generated/prisma/enums";

// Admin Reference Library, Part A — service layer. Keeps the API routes
// thin, mirroring lib/brand-kit/identity-engine.ts's separation.
// getIndustryStyleGuidance (below) is Part B — the one place this data
// actually reaches poster generation.

export interface IndustryReferenceView {
  id: string;
  industry: BusinessVertical;
  url: string;
  mimeType: string | null;
  label: string | null;
  analysisStatus: string;
  isActive: boolean;
  createdAt: Date;
}

function toView(
  row: Awaited<ReturnType<typeof prisma.industryReference.findFirstOrThrow>>,
  storage: StorageProvider
): IndustryReferenceView {
  return {
    id: row.id,
    industry: row.industry,
    url: storage.getPublicUrl(row.storageKey),
    mimeType: row.mimeType,
    label: row.label,
    analysisStatus: row.analysisStatus,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function listIndustryReferences(industry?: BusinessVertical): Promise<IndustryReferenceView[]> {
  const storage = await getStorageProvider();
  const rows = await prisma.industryReference.findMany({
    where: industry ? { industry } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => toView(row, storage));
}

export async function createIndustryReference(input: {
  industry: BusinessVertical;
  storageKey: string;
  mimeType: string;
  label?: string;
  uploadedByUserId: string;
}): Promise<IndustryReferenceView> {
  const row = await prisma.industryReference.create({
    data: {
      industry: input.industry,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      label: input.label,
      uploadedByUserId: input.uploadedByUserId,
      analysisStatus: "PENDING",
    },
  });
  return toView(row, await getStorageProvider());
}

// Runs analyzeAssetForLibrary() against an already-created reference and
// persists the result. Failure doesn't throw — the reference row survives
// with analysisStatus FAILED so the admin can retry, rather than losing the
// upload because the vision-LLM call had a bad day.
export async function runReferenceAnalysis(referenceId: string, adminUserId: string): Promise<IndustryReferenceView> {
  const reference = await prisma.industryReference.findUniqueOrThrow({ where: { id: referenceId } });
  const storage = await getStorageProvider();
  const imageUrl = resolveAbsoluteUrl(storage.getPublicUrl(reference.storageKey));

  try {
    const analysis = await analyzeAssetForLibrary(imageUrl, adminUserId);
    const updated = await prisma.industryReference.update({
      where: { id: referenceId },
      data: { analysis: analysis as object, analysisStatus: "READY" },
    });
    return toView(updated, storage);
  } catch (err) {
    console.error(`Reference analysis failed for ${referenceId}`, err);
    const updated = await prisma.industryReference.update({
      where: { id: referenceId },
      data: { analysisStatus: "FAILED" },
    });
    return toView(updated, storage);
  }
}

export async function updateIndustryReference(
  id: string,
  data: { label?: string | null; isActive?: boolean }
): Promise<IndustryReferenceView> {
  const row = await prisma.industryReference.update({ where: { id }, data });
  return toView(row, await getStorageProvider());
}

// Deletes the DB row only — StorageProvider has no delete() method anywhere
// in this codebase (checked: upload/uploadFromUrl/getPublicUrl/
// getSignedDownloadUrl/createSignedUploadUrl/download, no delete), so the
// underlying object is orphaned in storage. Matches the existing app-wide
// limitation, not a new gap introduced here.
export async function deleteIndustryReference(id: string): Promise<void> {
  await prisma.industryReference.delete({ where: { id } });
}

export interface GuidanceNoteView {
  industry: BusinessVertical;
  label: string;
  notes: string;
}

export async function listGuidanceNotes(): Promise<GuidanceNoteView[]> {
  const rows = await prisma.industryGuidanceNote.findMany();
  const byIndustry = new Map(rows.map((r) => [r.industry, r.notes]));
  return (Object.keys(INDUSTRY_POSTER_META) as BusinessVertical[]).map((industry) => ({
    industry,
    label: INDUSTRY_POSTER_META[industry].label,
    notes: byIndustry.get(industry) ?? "",
  }));
}

export async function upsertGuidanceNote(industry: BusinessVertical, notes: string): Promise<GuidanceNoteView> {
  const row = await prisma.industryGuidanceNote.upsert({
    where: { industry },
    create: { industry, notes },
    update: { notes },
  });
  return { industry: row.industry, label: INDUSTRY_POSTER_META[row.industry].label, notes: row.notes };
}

// Recursive, key-order-independent serialization — used to deduplicate
// analysis JSONs (plain JSON.stringify would treat two objects with the
// same fields in a different key order as distinct).
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function mostCommon(values: (string | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

function topColors(colorLists: (string[] | undefined)[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const colors of colorLists) {
    for (const c of colors ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => c);
}

const GUIDANCE_NOTE_MAX_LENGTH = 500;

// Shared by getIndustryStyleGuidance() and getIndustryVisualStyle() — both
// need the same deduplicated analyses + guidance note, they just compose
// different final sentences from them (one includes layout, one doesn't).
//
// Analyses are deduplicated (via stableStringify) before computing mode/
// count — repeat uploads of the same sample image would otherwise inflate
// "N approved ads" and look like convergence across samples that are
// really just one signal.
async function fetchDistinctAnalysesAndNote(
  industry: BusinessVertical
): Promise<{ distinctAnalyses: AssetAnalysisResult[]; note: string | null }> {
  const [references, noteRow] = await Promise.all([
    prisma.industryReference.findMany({
      where: { industry, isActive: true, analysisStatus: "READY" },
      select: { analysis: true },
    }),
    prisma.industryGuidanceNote.findUnique({ where: { industry } }),
  ]);

  const seen = new Set<string>();
  const distinctAnalyses: AssetAnalysisResult[] = [];
  for (const row of references) {
    if (!row.analysis) continue;
    const key = stableStringify(row.analysis);
    if (seen.has(key)) continue;
    seen.add(key);
    distinctAnalyses.push(row.analysis as AssetAnalysisResult);
  }

  return { distinctAnalyses, note: noteRow?.notes.trim() || null };
}

// The guidance note is injected close to verbatim (capped at
// GUIDANCE_NOTE_MAX_LENGTH) in both callers below — deliberately NOT
// sanitized. Stray content (e.g. a non-English draft fragment) is the
// admin's to fix in the UI, not something to silently filter here. It's
// also not split into style-vs-layout — it's free text with no reliable
// separation short of another LLM call, and worst case an admin's stray
// layout comment is just a harmless wasted phrase to the photo generator,
// since the compositor's renderPlan controls final layout regardless of
// what the photo prompt says.
function appendGuidanceNote(parts: string[], note: string | null): void {
  if (note) parts.push(`Additional guidance from the brand team: ${note.slice(0, GUIDANCE_NOTE_MAX_LENGTH)}`);
}

// Part B — the one function that reads Part A's curated data for the
// buildPosterPrompt() fallback path (nothing else in poster-prompt.ts/
// engine.ts touches IndustryReference or IndustryGuidanceNote for that
// path). Returns a single compact, ready-to-inject string, or null when
// there's nothing to say for this industry (buildPosterPrompt() omits the
// block entirely in that case — graceful fallback, byte-identical to
// pre-Part-B output).
//
// Only actionable-for-a-poster fields are pulled (visualLanguage,
// headline/CTA/logo position, top-3 colors) — the other 18+ descriptive
// fields in AssetAnalysisResult (lens, depth, texture...) matter for photo
// realism, not poster layout, and dumping them would reintroduce the
// prompt-bloat problem this feature line already fixed.
export async function getIndustryStyleGuidance(industry: BusinessVertical): Promise<string | null> {
  const { distinctAnalyses, note } = await fetchDistinctAnalysesAndNote(industry);

  const parts: string[] = [];

  if (distinctAnalyses.length > 0) {
    const visualLanguage = mostCommon(distinctAnalyses.map((a) => a.visualLanguage));
    const headlinePos = mostCommon(distinctAnalyses.map((a) => a.headlinePosition));
    const ctaPos = mostCommon(distinctAnalyses.map((a) => a.ctaPosition));
    const logoPos = mostCommon(distinctAnalyses.map((a) => a.logoPosition));
    const colors = topColors(distinctAnalyses.map((a) => a.colorPalette), 3);

    const layoutBits = [
      headlinePos ? `headline near the ${headlinePos}` : null,
      ctaPos ? `call-to-action near the ${ctaPos}` : null,
      logoPos ? `logo near the ${logoPos}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const count = distinctAnalyses.length;
    parts.push(
      `Proven visual style for ${INDUSTRY_POSTER_META[industry].label} advertisements (learned from ${count} approved reference ad${count === 1 ? "" : "s"} for this industry)${visualLanguage ? `: ${visualLanguage}` : ""}.` +
        (layoutBits ? ` Typical layout: ${layoutBits}.` : "") +
        (colors.length ? ` Palette: ${colors.join(", ")}.` : "")
    );
  }

  appendGuidanceNote(parts, note);

  return parts.length ? parts.join(" ") : null;
}

// Canvas-compositor Problem 3 fix — the compositor poster path generates a
// clean background PHOTO (buildCleanBackgroundPrompt), not an AI-drawn
// full poster, so getIndustryStyleGuidance()'s layout clause ("headline
// near the upper third...") is meaningless there — the compositor's
// renderPlan places headline/benefits/CTA/logo deterministically,
// regardless of what the photo contains. This variant drops that clause
// and keeps only what a photo generator can actually act on: visual style
// (mood/lighting/editorial feel via visualLanguage) and color palette.
// Same graceful-null convention as getIndustryStyleGuidance — an industry
// with no active curated samples and no guidance note returns null, and
// the caller omits the block entirely.
export async function getIndustryVisualStyle(industry: BusinessVertical): Promise<string | null> {
  const { distinctAnalyses, note } = await fetchDistinctAnalysesAndNote(industry);

  const parts: string[] = [];

  if (distinctAnalyses.length > 0) {
    const visualLanguage = mostCommon(distinctAnalyses.map((a) => a.visualLanguage));
    const colors = topColors(distinctAnalyses.map((a) => a.colorPalette), 3);

    const count = distinctAnalyses.length;
    parts.push(
      `Proven visual style for ${INDUSTRY_POSTER_META[industry].label} advertisements (learned from ${count} approved reference ad${count === 1 ? "" : "s"} for this industry)${visualLanguage ? `: ${visualLanguage}` : ""}.` +
        (colors.length ? ` Palette: ${colors.join(", ")}.` : "")
    );
  }

  appendGuidanceNote(parts, note);

  return parts.length ? parts.join(" ") : null;
}
