"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CaseSensitive } from "lucide-react";

import { PanelHeader } from "../shared/panel-header";
import { AssetList } from "../shared/asset-list";
import { EmptyState } from "../shared/empty-state";
import { useEditorAssetsQuery, useEditorFontsQuery, useEditorProjectQuery, useUpdateClipMutation } from "../../queries";
import { useEditorStore } from "../../store";
import { customFontFamily } from "../../custom-font-faces";
import { createUpdateContentCommand, type ClipCommandDeps } from "../../commands";
import type { ListAssetItem } from "../types";

// Module 11 — Part C: the smallest part, since Google Fonts (Module 7) and
// Brand Fonts (Milestone 24/7's FONT-kind EditorAsset upload, already
// wired in brand-kit-section.tsx) both already exist end-to-end. This is
// UI wiring only — click a row to apply it to the currently-selected TEXT/
// SUBTITLE clip, reusing text-properties-group.tsx's EXACT
// createUpdateContentCommand call and ClipCommandDeps-stub pattern
// (right-properties-panel.tsx:63-76 is the established precedent for
// constructing a deps object where only `updateClip` is real) rather than
// a second font-application code path. Fonts apply to a selection, they
// don't drop onto the timeline — no drag affordance here, click-only.
export function FontsSection() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [search, setSearch] = React.useState("");

  const fontsQuery = useEditorFontsQuery();
  const assetsQuery = useEditorAssetsQuery();
  const { data } = useEditorProjectQuery(projectId);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const updateClipMutation = useUpdateClipMutation(projectId);

  const commandDeps: ClipCommandDeps = React.useMemo(
    () => ({
      updateClip: (input) => updateClipMutation.mutateAsync(input),
      deleteClip: () => Promise.resolve(),
      addClip: () => Promise.reject(new Error("not used")),
      splitClip: () => Promise.reject(new Error("not used")),
      rippleDeleteClip: () => Promise.reject(new Error("not used")),
      duplicateClip: () => Promise.reject(new Error("not used")),
      replaceClipSource: () => Promise.reject(new Error("not used")),
      groupClips: () => Promise.reject(new Error("not used")),
      ungroupClips: () => Promise.reject(new Error("not used")),
      restoreTransition: () => Promise.reject(new Error("not used")),
    }),
    [updateClipMutation]
  );

  const clips = data?.clips ?? [];
  const selectedTextClip = clips.find((c) => selectedClipIds.has(c.id) && c.content?.text !== undefined) ?? null;

  const googleFonts: ListAssetItem[] = (fontsQuery.data?.fonts ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    fontFamily: f.family,
  }));
  const brandFonts: ListAssetItem[] = (assetsQuery.data ?? [])
    .filter((a) => a.kind === "FONT" && a.status === "READY")
    .map((a) => ({ id: a.id, label: a.originalFilename, meta: "Brand font", fontFamily: customFontFamily(a.id) }));

  const allFonts = [...brandFonts, ...googleFonts];
  const items = search.trim()
    ? allFonts.filter((f) => f.label.toLowerCase().includes(search.trim().toLowerCase()))
    : allFonts;

  function applyFont(item: ListAssetItem) {
    if (!selectedTextClip || !item.fontFamily) return;
    const previous = selectedTextClip.content ?? null;
    const next = { ...(previous ?? {}), fontFamily: item.fontFamily };
    void createUpdateContentCommand(commandDeps, selectedTextClip.id, previous, next).execute();
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Fonts" searchValue={search} onSearchChange={setSearch} />
      {!selectedTextClip && (
        <p className="border-b border-editor-line px-3 py-2 text-caption text-neutral-500">
          Select a text clip on the timeline to apply a font.
        </p>
      )}
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {items.length === 0 ? (
          <EmptyState icon={CaseSensitive} title="No fonts found" description="Try a different search term." />
        ) : (
          <AssetList items={items} onRowClick={selectedTextClip ? applyFont : undefined} />
        )}
      </div>
    </div>
  );
}
