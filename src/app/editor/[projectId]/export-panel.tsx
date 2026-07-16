"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Download, Film, Loader2, Lock, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MotionPrimaryButton } from "./motion-primitives";
import {
  useCancelExportMutation,
  useCreateExportMutation,
  useCreateExportPresetMutation,
  useCurrentUserTierQuery,
  useDeleteExportPresetMutation,
  useExportDownloadUrlMutation,
  useExportPresetsQuery,
  useExportsQuery,
} from "./queries";
import {
  canRemoveWatermark,
  classifyAspect,
  DEFAULT_CODEC_FOR_FORMAT,
  EXPORT_FORMATS,
  EXPORT_PLATFORM_PRESETS,
  EXPORT_RESOLUTIONS,
  hasAudioTrack,
  RESOLUTION_LABEL,
  VALID_CODECS_FOR_FORMAT,
  type ExportCodec,
  type ExportFormat,
  type ExportResolution,
} from "@/lib/video-editor/export-engine";
import type { EditorExportStatus, ExportPresetView, ExportView, ProjectView } from "../types";

const FORMAT_LABEL: Record<ExportFormat, string> = { MP4: "MP4", MOV: "MOV", WEBM: "WebM", GIF: "GIF" };
const ASPECT_CLASS_LABEL = { landscape: "landscape (16:9-ish)", portrait: "vertical (9:16-ish)", square: "square (1:1)" } as const;
const STATUS_LABEL: Record<EditorExportStatus, string> = {
  QUEUED: "Queued",
  RENDERING: "Rendering",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Module 10 (Parts A/B/C) — Export settings + queue + history, all in one
// Sheet (mirrors VersionHistoryPanel's exact shell pattern). Queuing an
// export returns immediately (Part B: non-blocking — the user can keep
// editing or close this panel while the separate export queue worker
// renders it); useExportsQuery polls while anything is QUEUED/RENDERING
// for live progress, and stops polling once everything has settled.
export function ExportPanel({
  projectId,
  project,
  open,
  onOpenChange,
}: {
  projectId: string;
  project: ProjectView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const exportsQuery = useExportsQuery(projectId);
  const createMutation = useCreateExportMutation(projectId);
  const cancelMutation = useCancelExportMutation(projectId);
  const savedPresetsQuery = useExportPresetsQuery();
  const createPresetMutation = useCreateExportPresetMutation();
  const deletePresetMutation = useDeleteExportPresetMutation();
  const [savePresetName, setSavePresetName] = React.useState("");

  // Watermark tier gate (2026-07-16) — canRemoveWatermark is the exact same
  // pure rule lib/video-editor/exports.ts's createExport enforces server-
  // side; this is a UI convenience only (fails closed to "forced on" while
  // the tier is still loading/unknown, never briefly shows an unlocked
  // toggle that then locks).
  const tierQuery = useCurrentUserTierQuery();
  const canRemove = tierQuery.data !== undefined && canRemoveWatermark(tierQuery.data);

  const [format, setFormat] = React.useState<ExportFormat>("MP4");
  const [resolution, setResolution] = React.useState<ExportResolution>("R1080P");
  const [fps, setFps] = React.useState(project.fps);
  const [codec, setCodec] = React.useState<ExportCodec | null>(DEFAULT_CODEC_FOR_FORMAT.MP4);
  const [bitrateKbps, setBitrateKbps] = React.useState<string>("");
  const [watermark, setWatermark] = React.useState(false);
  const effectiveWatermark = canRemove ? watermark : true;
  // Export presets (2026-07-15) — "Custom" (null) is the default; picking a
  // platform preset prefills the fields below, which stay fully editable
  // afterward. Any MANUAL edit to one of those fields clears the selection
  // back to "Custom" rather than leaving a stale platform label attached to
  // settings the user has since changed away from that preset.
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(null);
  const selectedPreset = EXPORT_PLATFORM_PRESETS.find((p) => p.id === selectedPresetId) ?? null;
  const projectAspect = classifyAspect(project.widthPx, project.heightPx);

  function commitFormat(next: ExportFormat) {
    setFormat(next);
    setCodec(DEFAULT_CODEC_FOR_FORMAT[next]);
    setSelectedPresetId(null);
  }
  function commitResolution(next: ExportResolution) {
    setResolution(next);
    setSelectedPresetId(null);
  }
  function commitFps(next: number) {
    setFps(next);
    setSelectedPresetId(null);
  }
  function commitCodec(next: ExportCodec) {
    setCodec(next);
    setSelectedPresetId(null);
  }
  function commitBitrate(next: string) {
    setBitrateKbps(next);
    setSelectedPresetId(null);
  }
  function applyPreset(presetId: string) {
    const preset = EXPORT_PLATFORM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setFormat(preset.format);
    setResolution(preset.resolution);
    setFps(preset.fps);
    setCodec(preset.codec);
    setBitrateKbps(String(preset.bitrateKbps));
  }

  // Render Queue polish (2026-07-16) — loading a saved preset is a one-shot
  // prefill, same shape as applyPreset above, but has no persistent
  // "currently active" label to track afterward — unlike platform presets,
  // there's no aspect-mismatch check or other state that depends on which
  // saved preset (if any) is still "selected," so this doesn't touch
  // `selectedPresetId` (a platform-preset-only concept).
  function applySavedPreset(preset: ExportPresetView) {
    setFormat(preset.format);
    setResolution(preset.resolution);
    setFps(preset.fps);
    setCodec(preset.codec);
    setBitrateKbps(preset.bitrateKbps ? String(preset.bitrateKbps) : "");
    setWatermark(preset.watermark);
    setSelectedPresetId(null);
  }

  async function handleSavePreset() {
    const name = savePresetName.trim();
    if (!name) return;
    await createPresetMutation.mutateAsync({
      name,
      format,
      resolution,
      fps,
      codec: codec ?? undefined,
      bitrateKbps: bitrateKbps.trim() ? Math.max(1, Math.round(Number(bitrateKbps))) : undefined,
      watermark: effectiveWatermark,
    });
    setSavePresetName("");
  }

  async function handleExport() {
    await createMutation.mutateAsync({
      format,
      resolution,
      fps,
      codec: codec ?? undefined,
      bitrateKbps: bitrateKbps.trim() ? Math.max(1, Math.round(Number(bitrateKbps))) : undefined,
      // The server (createExport) re-derives and enforces this from the
      // user's real tier regardless of what's sent here — effectiveWatermark
      // just keeps the client's own optimistic UI honest with that outcome.
      watermark: effectiveWatermark,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Fix (2026-07-13) — premium design-token foundation: was bg-surface-0
          (the Dashboard's own shared dark-theme token); decoupled onto the
          editor's own panel token, same reasoning as layout.tsx's root. */}
      <SheetContent className="flex flex-col bg-editor-panel text-white sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Film className="size-4" />
            Export
          </SheetTitle>
          <SheetDescription className="text-neutral-400">
            Renders the SAME compositor you see in the Preview Window, frame by frame, into a downloadable file.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-b border-editor-line px-4 pb-4">
          <div className="space-y-1">
            <span className="text-caption text-neutral-500">Platform preset</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                  {selectedPreset?.label ?? "Custom"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSelectedPresetId(null)}>Custom</DropdownMenuItem>
                {EXPORT_PLATFORM_PRESETS.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => applyPreset(p.id)}>
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Recommended settings only — this never changes the project's
                own aspect ratio (that's the Preview Window's real 16:9/9:16/
                1:1 quick-switch, a separate, more consequential action). An
                honest heads-up instead of a silent mismatch. */}
            {selectedPreset && selectedPreset.recommendedAspect !== projectAspect && (
              <p className="flex items-start gap-1 text-micro text-amber-400">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                {selectedPreset.label} is typically {ASPECT_CLASS_LABEL[selectedPreset.recommendedAspect]}, but this project is{" "}
                {ASPECT_CLASS_LABEL[projectAspect]}. Change the project&apos;s aspect ratio in the Preview Window for best results, or continue as-is.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-caption text-neutral-500">Format</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                    {FORMAT_LABEL[format]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {EXPORT_FORMATS.map((f) => (
                    <DropdownMenuItem key={f} onClick={() => commitFormat(f)}>
                      {FORMAT_LABEL[f]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {!hasAudioTrack(format) && <p className="text-micro text-neutral-500">GIF has no audio track.</p>}
            </div>

            <div className="space-y-1">
              <span className="text-caption text-neutral-500">Resolution</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                    {RESOLUTION_LABEL[resolution]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {EXPORT_RESOLUTIONS.map((r) => (
                    <DropdownMenuItem key={r} onClick={() => commitResolution(r)}>
                      {RESOLUTION_LABEL[r]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1">
              <span className="text-caption text-neutral-500">FPS</span>
              <input
                type="number"
                aria-label="FPS"
                min={1}
                max={120}
                value={fps}
                onChange={(e) => commitFps(Math.max(1, Math.min(120, Number(e.target.value) || project.fps)))}
                className="h-8 w-full rounded-md border border-editor-line bg-editor-surface-1 px-2 text-caption text-neutral-100"
              />
            </div>

            {format !== "GIF" && (
              <div className="space-y-1">
                <span className="text-caption text-neutral-500">Codec</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                      {codec ?? "Default"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {VALID_CODECS_FOR_FORMAT[format].map((c) => (
                      <DropdownMenuItem key={c} onClick={() => commitCodec(c)}>
                        {c}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {format !== "GIF" && (
              <div className="space-y-1">
                <span className="text-caption text-neutral-500">Bitrate (kbps, optional)</span>
                <input
                  type="number"
                  aria-label="Bitrate (kbps)"
                  placeholder="Auto"
                  min={100}
                  value={bitrateKbps}
                  onChange={(e) => commitBitrate(e.target.value)}
                  className="h-8 w-full rounded-md border border-editor-line bg-editor-surface-1 px-2 text-caption text-neutral-100 placeholder:text-neutral-600"
                />
              </div>
            )}
          </div>

          {canRemove ? (
            <label className="flex items-center gap-2 text-caption text-neutral-300">
              <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
              Add watermark
            </label>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex w-fit cursor-not-allowed items-center gap-2 text-caption text-neutral-500">
                  <input type="checkbox" checked disabled />
                  Add watermark
                  <Lock className="size-3" />
                </label>
              </TooltipTrigger>
              <TooltipContent side="top">Requires the Premium plan — upgrade to remove the watermark from your exports.</TooltipContent>
            </Tooltip>
          )}

          {/* Render Queue polish (2026-07-16) — save/load a NAMED, reusable
              bundle of the settings above, scoped to the user (not this
              project) so it's available in every project's Export panel.
              Distinct from the built-in "Platform preset" dropdown further
              up: that's a static, non-persisted convenience table; this is
              a real save/load/delete CRUD flow. Not wired through the
              Command pattern — this is a standalone user-level resource
              like an Asset or Folder, not part of THIS project's timeline
              undo/redo history. */}
          <div className="space-y-1.5 rounded-editor-card border border-editor-line bg-editor-surface-1 p-2">
            <span className="text-caption text-neutral-500">Saved settings</span>
            <div className="flex gap-1.5">
              <input
                type="text"
                aria-label="Preset name"
                placeholder="Name this configuration…"
                value={savePresetName}
                onChange={(e) => setSavePresetName(e.target.value)}
                maxLength={60}
                className="h-8 flex-1 rounded-md border border-editor-line bg-editor-surface-2 px-2 text-caption text-neutral-100 placeholder:text-neutral-600"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!savePresetName.trim() || createPresetMutation.isPending}
                onClick={() => void handleSavePreset()}
              >
                {createPresetMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
              </Button>
            </div>
            {savedPresetsQuery.data && savedPresetsQuery.data.length > 0 && (
              <div className="space-y-1">
                {savedPresetsQuery.data.map((preset) => (
                  <div key={preset.id} className="flex items-center justify-between gap-2 rounded-md bg-editor-surface-2 px-2 py-1">
                    <button
                      type="button"
                      onClick={() => applySavedPreset(preset)}
                      className="min-w-0 flex-1 truncate text-left text-caption text-neutral-200 hover:text-white"
                      title={`Load "${preset.name}"`}
                    >
                      {preset.name}
                      <span className="ml-1.5 text-micro text-neutral-500">
                        {FORMAT_LABEL[preset.format]} · {RESOLUTION_LABEL[preset.resolution]} · {preset.fps}fps
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePresetMutation.mutate(preset.id)}
                      disabled={deletePresetMutation.isPending && deletePresetMutation.variables === preset.id}
                      className="shrink-0 text-neutral-500 hover:text-editor-danger"
                      title={`Delete "${preset.name}"`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <MotionPrimaryButton type="button" className="w-full" loading={createMutation.isPending} onClick={() => void handleExport()}>
            <Film className="size-4" />
            Start Export
          </MotionPrimaryButton>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
          <p className="pt-3 text-label-sm text-neutral-300">History</p>
          {exportsQuery.isLoading ? (
            <p className="text-caption text-neutral-500">Loading…</p>
          ) : exportsQuery.data?.length ? (
            exportsQuery.data.map((exportRow) => (
              <ExportHistoryRow
                key={exportRow.id}
                exportRow={exportRow}
                projectId={projectId}
                onCancel={() => cancelMutation.mutate(exportRow.id)}
                cancelling={cancelMutation.isPending && cancelMutation.variables === exportRow.id}
              />
            ))
          ) : (
            <p className="text-caption text-neutral-500">No exports yet.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ExportHistoryRow({
  exportRow,
  projectId,
  onCancel,
  cancelling,
}: {
  exportRow: ExportView;
  projectId: string;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const downloadMutation = useExportDownloadUrlMutation(projectId);

  async function handleDownload() {
    const { url } = await downloadMutation.mutateAsync(exportRow.id);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    // Fix (2026-07-13) — premium design-token foundation: the export-history
    // list's own row is this panel's clearest "card" surface (list-item
    // sized, not a tiny thumbnail tile) — standardized radius/shadow.
    <div className="space-y-1.5 rounded-editor-card border border-editor-line bg-editor-surface-1 px-3 py-2 shadow-editor-card">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-caption text-neutral-200">
            {exportRow.format} · {RESOLUTION_LABEL[exportRow.resolution]} · {exportRow.fps}fps
            {exportRow.watermark && " · Watermarked"}
          </p>
          <p className="text-micro text-neutral-500">{formatTimestamp(exportRow.createdAt)}</p>
        </div>
        <StatusBadge status={exportRow.status} />
      </div>

      {exportRow.status === "RENDERING" && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-editor-surface-2">
            <div className="h-full bg-editor-accent transition-all" style={{ width: `${exportRow.progress}%` }} />
          </div>
          <p className="text-micro text-neutral-500">
            {exportRow.progress}% {exportRow.totalFrames ? `(${exportRow.framesRendered}/${exportRow.totalFrames} frames)` : ""}
          </p>
        </div>
      )}

      {exportRow.status === "FAILED" && exportRow.errorMessage && (
        <p className="flex items-start gap-1 text-micro text-editor-danger">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          {exportRow.errorMessage}
        </p>
      )}

      <div className="flex justify-end gap-1.5">
        {(exportRow.status === "QUEUED" || exportRow.status === "RENDERING") && (
          <Button type="button" variant="ghost" size="sm" className="text-neutral-400 hover:text-white" disabled={cancelling} onClick={onCancel}>
            {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            Cancel
          </Button>
        )}
        {exportRow.status === "COMPLETED" && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={downloadMutation.isPending}
            onClick={() => void handleDownload()}
          >
            <Download className="size-3.5" />
            Download
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: EditorExportStatus }) {
  const color =
    status === "COMPLETED"
      ? "text-emerald-400"
      : status === "FAILED"
        ? "text-editor-danger"
        : status === "CANCELLED"
          ? "text-neutral-500"
          : "text-editor-accent";
  return (
    <span className={`flex shrink-0 items-center gap-1 text-micro ${color}`}>
      {status === "RENDERING" && <Loader2 className="size-3 animate-spin" />}
      {status === "COMPLETED" && <CheckCircle2 className="size-3" />}
      {status === "FAILED" && <AlertTriangle className="size-3" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
