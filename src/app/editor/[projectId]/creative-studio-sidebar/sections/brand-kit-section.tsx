"use client";

import * as React from "react";
import { ImagePlus, Loader2, Palette, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDeleteEditorAssetMutation, useEditorAssetsQuery, useUploadEditorAssetMutation } from "../../queries";
import { customFontFamily } from "../../custom-font-faces";

// Brand Kit — Logo/Palette/"Set up Brand Kit" stay placeholder-only (no
// BrandKit data wired here yet, out of this module's scope). The Fonts
// slot is now real (Module 7): lists every uploaded FONT-kind EditorAsset
// and lets the user upload a brand font file, which becomes selectable in
// the Text Editor's font picker via customFontFamily(asset.id) — see
// custom-font-faces.tsx for how the actual @font-face rule gets injected.
const PLACEHOLDER_PALETTE = ["#1a3c6e", "#f97316", "#15803d", "#dc2626", "#0f172a", "#f8fafc"];

export function BrandKitSection() {
  const assetsQuery = useEditorAssetsQuery();
  const upload = useUploadEditorAssetMutation();
  const remove = useDeleteEditorAssetMutation();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const fontAssets = (assetsQuery.data ?? []).filter((a) => a.kind === "FONT");

  function handleFontFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) upload.mutate({ file, kind: "FONT" });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-editor-line p-3">
        <h2 className="text-label-sm text-neutral-200">Brand Kit</h2>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-3 [scrollbar-gutter:stable]">
        <section>
          <p className="mb-2 text-caption text-neutral-500">Logo</p>
          <button
            type="button"
            className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-editor-line text-neutral-500 hover:border-editor-border-hover hover:text-neutral-300"
          >
            <ImagePlus className="size-6" />
          </button>
        </section>

        <section>
          <p className="mb-2 text-caption text-neutral-500">Color palette</p>
          <div className="grid grid-cols-6 gap-1.5">
            {PLACEHOLDER_PALETTE.map((hex) => (
              <div key={hex} className="aspect-square rounded-md border border-editor-line" style={{ backgroundColor: hex }} title={hex} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-caption text-neutral-500">Custom fonts</p>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Upload a brand font (woff2/woff/ttf/otf)"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
              multiple
              hidden
              onChange={(e) => {
                handleFontFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {fontAssets.length === 0 ? (
            <p className="rounded-md border border-dashed border-editor-line px-3 py-2 text-caption text-neutral-500">
              No custom fonts uploaded yet — click Upload to add a brand font. It&apos;ll appear in the Text Editor&apos;s font picker.
            </p>
          ) : (
            <div className="space-y-1.5">
              {fontAssets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between rounded-md border border-editor-line bg-editor-surface-1 px-3 py-2">
                  <p className="truncate text-body-sm text-neutral-200" style={{ fontFamily: customFontFamily(asset.id) }} title={asset.originalFilename}>
                    {asset.originalFilename}
                  </p>
                  <button
                    type="button"
                    className="shrink-0 text-neutral-500 hover:text-editor-danger"
                    title="Remove"
                    onClick={() => remove.mutate(asset.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <Button type="button" variant="outline" size="sm" className="w-full border-editor-line text-neutral-200 hover:bg-editor-surface-2">
          <Palette className="size-4" />
          Set up Brand Kit
        </Button>
      </div>
    </div>
  );
}
