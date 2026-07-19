"use client";

import * as React from "react";
import Link from "next/link";
import { Download, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { useEditor } from "./editor-types";

const RESOLUTIONS = [
  { value: "R720P", label: "720p" },
  { value: "R1080P", label: "1080p" },
  { value: "R4K", label: "4K" },
] as const;

const CODECS = [
  { value: "H264", label: "H.264" },
  { value: "H265", label: "H.265" },
  { value: "VP9", label: "VP9" },
] as const;

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "neutral",
  PROCESSING: "warning",
  COMPLETED: "success",
  FAILED: "error",
};

interface ExportRow {
  id: string;
  resolution: string;
  codec: string;
  watermark: boolean;
  status: string;
  url: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const POLL_MS = 4000;

// Export System — 720p/1080p/4K, watermark on/off, codec choice. Creates a
// RenderJob through lib/export/service.ts's createExport(), processed by
// the SAME render queue worker as scene renders (Background Rendering) —
// this panel just creates the job and polls for the result.
export function ExportPanel() {
  const { project } = useEditor();
  const [resolution, setResolution] = React.useState<(typeof RESOLUTIONS)[number]["value"]>("R1080P");
  const [codec, setCodec] = React.useState<(typeof CODECS)[number]["value"]>("H264");
  const [watermark, setWatermark] = React.useState(true);
  const [exports, setExports] = React.useState<ExportRow[]>([]);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/videos/${project.id}/exports`);
    const json = await res.json();
    if (json.success) setExports(json.data.exports);
  }, [project.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const hasPending = exports.some((e) => e.status === "PENDING" || e.status === "PROCESSING");
    if (!hasPending) return;
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [exports, load]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-md text-neutral-700">Export</p>

      {/* Fixed 2026-07-19 — this panel's own export path (lib/export/
          service.ts -> processExportJob -> composeTimeline()) always falls
          back to MockVideoProvider's canned placeholder: every real video
          provider (Veo/Kling/Hailuo/Seedance/Sora/Runway) deliberately
          throws on composeTimeline() rather than faking a merge capability
          none of them actually offer. Disabled here rather than silently
          producing the wrong video — the real, working download for this
          exact video already exists on its own detail page (produced by
          the automatic real merge that runs after scene rendering, via the
          Cloud Video Editor's own Export Engine, not this panel). */}
      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-light px-4 py-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-body-sm text-warning">
          This panel&apos;s export is temporarily unavailable — it can currently only produce a placeholder video, not
          your real content. A real, downloadable version of this video is already available from{" "}
          <Link href={`/videos/${project.id}`} className="font-medium underline">
            its video page
          </Link>
          .
        </p>
      </div>

      <div className="pointer-events-none flex flex-col gap-4 opacity-50">
        <div>
          <label className="mb-1.5 block text-label-sm text-neutral-700">Resolution</label>
          <Select value={resolution} onValueChange={(v) => setResolution(v as typeof resolution)} disabled>
            <SelectTrigger className="h-10 w-full" aria-label="Resolution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-label-sm text-neutral-700">Codec</label>
          <Select value={codec} onValueChange={(v) => setCodec(v as typeof codec)} disabled>
            <SelectTrigger className="h-10 w-full" aria-label="Codec">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODECS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 text-body-sm text-neutral-700">
          <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} disabled />
          Watermark
        </label>
      </div>

      <Button type="button" variant="primary" size="sm" disabled title="Temporarily unavailable — see notice above">
        Start export
      </Button>

      <div className="border-t border-neutral-100 pt-3">
        <p className="text-label-sm text-neutral-700">History</p>
        <div className="mt-2 flex flex-col gap-2">
          {exports.length === 0 && <p className="text-body-sm text-neutral-500">No exports yet.</p>}
          {exports.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2">
              <div>
                <p className="text-label-sm text-neutral-800">
                  {RESOLUTIONS.find((r) => r.value === e.resolution)?.label ?? e.resolution} · {e.codec}
                  {e.watermark ? "" : " · no watermark"}
                </p>
                {e.errorMessage && <p className="text-body-sm text-error">{e.errorMessage}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[e.status] ?? "neutral"} size="sm" outline>
                  {e.status}
                </Badge>
                {e.status === "COMPLETED" && e.url && (
                  <a href={e.url} download target="_blank" rel="noreferrer">
                    <Button type="button" variant="ghost" size="icon-sm" title="Download">
                      <Download className="size-4" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
