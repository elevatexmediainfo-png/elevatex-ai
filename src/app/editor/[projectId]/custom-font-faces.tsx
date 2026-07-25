"use client";

import * as React from "react";
import { useEditorAssetsQuery } from "./queries";

// Module 7 — a custom-uploaded brand font (Brand Kit sidebar) becomes
// usable as `content.fontFamily` by storing this exact CSS family name
// (derived from the asset's own id, so it's always unique and needs no
// separate name-collision handling) and injecting a matching @font-face
// rule for every FONT-kind asset the user has uploaded. Mounted once at
// the workspace root (editor-workspace.tsx) so the font is available
// regardless of which panel (Properties, Timeline, Preview) references it.
export function customFontFamily(assetId: string): string {
  return `editor-font-${assetId}`;
}

export function CustomFontFaces() {
  const assetsQuery = useEditorAssetsQuery();
  const fontAssets = (assetsQuery.data ?? []).filter((a) => a.kind === "FONT" && a.status === "READY");

  if (fontAssets.length === 0) return null;

  const css = fontAssets
    .map((asset) => `@font-face { font-family: "${customFontFamily(asset.id)}"; src: url("${asset.url}"); font-display: swap; }`)
    .join("\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
