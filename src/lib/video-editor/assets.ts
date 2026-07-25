import { Prisma } from "@/generated/prisma/client";
import type { EditorAssetKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { InvalidStateError, UploadIntegrityError } from "./errors";

// Media Library backing store for the Cloud Video Editor (Milestone 24).
// Deliberately a new EditorAsset model rather than reusing the existing
// Asset table (Milestone 8) — that one defaults to AI_GENERATED and is
// wired to VideoProject/Scene/CreativeProject; this one only ever comes
// from a user upload via the presigned-URL flow (mirrors
// lib/assets/service.ts's createPendingAsset/confirmAssetUpload shape) and
// has zero AI/Scene coupling. Reuses the existing, fully generic
// StorageProvider as-is — no second storage mechanism.

type Db = Prisma.TransactionClient | typeof prisma;

export interface CreatePendingEditorAssetInput {
  userId: string;
  // Fix (2026-07-12) — the Uploads panel's own uploads now belong to the
  // project they were made in (see EditorAsset.projectId's own schema doc
  // comment). Optional: this function's other caller path (Brand Kit's
  // font-upload slot, via the same upload-url route) deliberately creates
  // project-independent FONT assets — see useUploadEditorAssetMutation's
  // own doc comment in queries.ts for why that stays unscoped.
  projectId?: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE" | "FONT";
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
}

export async function createPendingEditorAsset(input: CreatePendingEditorAssetInput, db: Db = prisma) {
  return db.editorAsset.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      kind: input.kind,
      status: "PENDING_UPLOAD",
      storageKey: input.storageKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
    },
  });
}

export interface CreateReadyEditorAssetInput {
  userId: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE" | "FONT";
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  widthPx?: number;
  heightPx?: number;
  durationSeconds?: number;
}

// AI Video Phase 1 — the one bridge point between the platform's Asset
// table (Milestone 8, AI-generated content: posters, etc.) and this
// module's upload-only EditorAsset. Points at the SAME storageKey as the
// source Asset — no bytes re-uploaded, no second copy in storage — and
// skips straight to READY since the file already exists, unlike
// createPendingEditorAsset()'s PENDING_UPLOAD/confirm dance built for a
// browser upload that hasn't finished yet. Width/height are passed in
// explicitly (the platform Asset table has no such columns of its own) —
// callers resolve them from the source content's own known preset/aspect
// ratio, not from probing the file.
export async function createReadyEditorAsset(input: CreateReadyEditorAssetInput, db: Db = prisma) {
  return db.editorAsset.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      status: "READY",
      storageKey: input.storageKey,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      durationSeconds: input.durationSeconds,
    },
  });
}

export interface ConfirmEditorAssetUploadInput {
  durationSeconds?: number;
  widthPx?: number;
  heightPx?: number;
  // Module 8 — computePeaksFromChannelData()'s output, client-computed at
  // confirm time same as duration/width/height above.
  waveformPeaks?: number[];
}

export async function confirmEditorAssetUpload(
  assetId: string,
  userId: string,
  patch: ConfirmEditorAssetUploadInput,
  db: Db = prisma
) {
  const asset = await db.editorAsset.findFirst({ where: { id: assetId, userId, scope: "USER" } });
  if (!asset) throw new InvalidStateError("Asset not found.");
  // Upload normalization (2026-07-19) — also short-circuits mid-pipeline
  // states (a retried/duplicate confirm-upload call must never re-enqueue
  // an asset that's already queued or actively being transcoded).
  if (asset.status === "READY" || asset.status === "QUEUED_FOR_NORMALIZATION" || asset.status === "NORMALIZING") return asset;

  const storage = await getStorageProvider();

  // Fix (2026-07-13) — the actual root cause of "audio doesn't play": a
  // silently-truncated upload (a proxy/middleware body-size cap cutting a
  // PUT off mid-transfer, confirmed live against a real 168MB upload cut to
  // exactly 10MB) used to sail straight through to READY with no error
  // anywhere, since a completed PUT response only proves the REQUEST
  // finished, not that every byte arrived. This is the general-case fix,
  // not a one-off: compares the object's real stored size against what the
  // client declared at upload-url time, for every upload, regardless of
  // which limit (this one, or any future one) might truncate it.
  if (asset.fileSizeBytes !== null) {
    const actualSize = await storage.getObjectSize(asset.storageKey);
    if (actualSize === null) {
      await db.editorAsset.update({ where: { id: assetId }, data: { status: "FAILED" } });
      throw new UploadIntegrityError("The uploaded file could not be found in storage. Please try uploading again.");
    }
    if (actualSize !== asset.fileSizeBytes) {
      await db.editorAsset.update({ where: { id: assetId }, data: { status: "FAILED" } });
      throw new UploadIntegrityError(
        `The uploaded file is incomplete (expected ${asset.fileSizeBytes} bytes, received ${actualSize}). Please try uploading again.`
      );
    }
  }

  const durationSeconds = patch.durationSeconds ?? asset.durationSeconds;

  // Upload normalization (2026-07-19) — a VIDEO asset no longer goes
  // straight to READY here. It's handed to asset-normalize-worker.ts
  // (QUEUED_FOR_NORMALIZATION -> claimed -> NORMALIZING -> READY/FAILED),
  // which probes the real codec/fps/bitrate, transcodes to H.264/AAC only
  // if the source actually needs it, generates the filmstrip AFTER
  // normalization (so it reflects the file every future playback
  // actually decodes, not a possibly-since-replaced source), then flips
  // to READY. See normalization.ts's header comment for why this exists:
  // a real file (100fps, PCM/"twos" audio, 83Mbps) broke both live
  // playback smoothness and audio entirely, independent of any app code.
  // Filmstrip generation is intentionally NOT done here anymore (it used
  // to be, synchronously, inline) — doing it before normalization would
  // waste the work if the source gets re-encoded moments later.
  if (asset.kind === "VIDEO") {
    return db.editorAsset.update({
      where: { id: assetId },
      data: {
        status: "QUEUED_FOR_NORMALIZATION",
        durationSeconds,
        widthPx: patch.widthPx ?? asset.widthPx,
        heightPx: patch.heightPx ?? asset.heightPx,
      },
    });
  }

  return db.editorAsset.update({
    where: { id: assetId },
    data: {
      status: "READY",
      durationSeconds,
      widthPx: patch.widthPx ?? asset.widthPx,
      heightPx: patch.heightPx ?? asset.heightPx,
      waveformPeaks: patch.waveformPeaks ?? (asset.waveformPeaks === null ? Prisma.JsonNull : (asset.waveformPeaks as Prisma.InputJsonValue)),
    },
  });
}

export interface EditorAssetView {
  id: string;
  // Milestone 26 — widened to the full EditorAssetKind (not just this
  // file's user-upload-only literal union) purely so this view type stays
  // structurally compatible with a real DB row. In practice a USER-scope
  // row (the only kind this function ever returns — see the scope: "USER"
  // filter below) is never ANIMATION; only the Admin Asset Library
  // (lib/video-editor/asset-library.ts) creates those.
  kind: EditorAssetKind;
  // Upload normalization (2026-07-19) — QUEUED_FOR_NORMALIZATION and
  // NORMALIZING only ever appear for VIDEO-kind rows, between confirm-
  // upload and the asset-normalize-worker flipping it to READY/FAILED.
  status: "PENDING_UPLOAD" | "QUEUED_FOR_NORMALIZATION" | "NORMALIZING" | "READY" | "FAILED";
  url: string;
  originalFilename: string;
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  createdAt: Date;
  waveformPeaks: number[] | null;
  // 2026-07-12 visual-fidelity pass — surfaces the already-existing
  // `thumbnailKey` column so ClipBlock can tile a real frame across a
  // clip's rendered width. Only ever populated for admin-library/stock-
  // materialized assets (see thumbnails.ts's two call sites); a plain
  // "Upload media" row never generates one, so this is `null` for most
  // real user clips — a known, documented gap, not a bug.
  thumbnailUrl: string | null;
  // Fix (2026-07-13) — the real Timeline filmstrip (see filmstrip.ts +
  // assets.ts's confirmEditorAssetUpload). Unlike thumbnailUrl above, this
  // IS populated for plain "Upload media" VIDEO uploads — the gap that
  // comment describes is specifically closed by this field. Null for
  // non-VIDEO kinds, for pre-existing rows uploaded before this field
  // existed, and if the best-effort generation step itself failed.
  filmstripUrl: string | null;
  filmstripFrameCount: number | null;
}

export async function listEditorAssets(
  userId: string,
  kind: "VIDEO" | "AUDIO" | "IMAGE" | "FONT" | undefined,
  limit = 200,
  // Fix (2026-07-12) — optional, not required: this function has a second
  // caller (timeline-panel.tsx's own asset lookups, used to resolve an
  // already-placed clip's thumbnail/label and to populate "Replace
  // source"'s candidate list) that must stay unfiltered by project on
  // purpose — a clip can legitimately reference an asset uploaded through a
  // DIFFERENT project (including, today, every asset uploaded before this
  // fix shipped, back when uploads were global), and a user replacing a
  // clip's source reasonably expects to see everything they've ever
  // uploaded, not just this project's. Only the Uploads *tab* passes this.
  projectId?: string
): Promise<EditorAssetView[]> {
  const storage = await getStorageProvider();
  // Milestone 26 — scope: "USER" is explicit and defensive, not just
  // implied by the userId match: an admin who has personally uploaded both
  // their own private assets AND admin-library assets (same userId on both,
  // library rows keep the uploader's id as attribution) must never see
  // library rows mixed into their own private Media Library here.
  const rows = await prisma.editorAsset.findMany({
    where: { userId, scope: "USER", ...(kind ? { kind } : {}), ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    url: storage.getPublicUrl(row.storageKey),
    originalFilename: row.originalFilename,
    durationSeconds: row.durationSeconds,
    widthPx: row.widthPx,
    heightPx: row.heightPx,
    createdAt: row.createdAt,
    waveformPeaks: (row.waveformPeaks as number[] | null) ?? null,
    thumbnailUrl: row.thumbnailKey ? storage.getPublicUrl(row.thumbnailKey) : null,
    filmstripUrl: row.filmstripKey ? storage.getPublicUrl(row.filmstripKey) : null,
    filmstripFrameCount: row.filmstripFrameCount,
  }));
}

// Clips referencing this asset have their assetId cleared (schema
// onDelete: SetNull) rather than being deleted — removing a Media Library
// item shouldn't silently remove the clip placements a user already made.
export async function deleteEditorAsset(userId: string, assetId: string, db: Db = prisma): Promise<void> {
  const claim = await db.editorAsset.deleteMany({ where: { id: assetId, userId, scope: "USER" } });
  if (claim.count === 0) throw new InvalidStateError("Asset not found.");
}

// Real bug fix (2026-07-24, found live during the codebase health check) —
// local-instant-preview (queries.ts's useInstantAddVideoClip) places a
// real, persisted clip against a still-uploading asset immediately; if the
// background PUT itself fails (network drop — never reaches confirm-upload,
// the only OTHER place that can mark an asset FAILED, see its own
// integrity-guard comment), the asset silently stayed PENDING_UPLOAD
// forever with a real clip pointing at it that would never become
// exportable and looked completely healthy in both the Uploads panel and
// the timeline. Scoped to PENDING_UPLOAD only (a conditional updateMany,
// not a blind update) so this can never clobber a legitimately-progressed
// upload if the client's failure callback happens to race a real
// confirm-upload success landing around the same time.
export async function markEditorAssetUploadFailed(userId: string, assetId: string, db: Db = prisma): Promise<void> {
  await db.editorAsset.updateMany({
    where: { id: assetId, userId, scope: "USER", status: "PENDING_UPLOAD" },
    data: { status: "FAILED" },
  });
}
