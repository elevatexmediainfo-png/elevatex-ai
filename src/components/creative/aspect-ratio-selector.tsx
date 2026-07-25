"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PRESETS_BY_KIND } from "@/lib/validations/creative";

type Kind = keyof typeof PRESETS_BY_KIND;

export interface AspectRatioValue {
  presetKey: string;
  customWidth?: number;
  customHeight?: number;
}

interface AspectRatioSelectorProps {
  kind: Kind;
  value: AspectRatioValue;
  onChange: (value: AspectRatioValue) => void;
}

const MIN_DIMENSION = 256;
const MAX_DIMENSION = 2048;

// Milestone 15 — replaces the bare "Format" label grid with a richer
// platform-aware picker: every named preset shows its exact pixel
// dimensions (when it has one), and "Custom" collects width/height
// directly, clamped to a sane range. Shared across all three studios
// (AI Image / Social Media / Marketing Creative) via the `kind` prop.
export function AspectRatioSelector({ kind, value, onChange }: AspectRatioSelectorProps) {
  const presets = PRESETS_BY_KIND[kind];
  const selected = presets.find((p) => p.key === value.presetKey);

  return (
    <div>
      <p className="mb-2 text-label-md text-neutral-700">Format</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange({ presetKey: p.key, customWidth: value.customWidth, customHeight: value.customHeight })}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
              p.key === value.presetKey
                ? "border-brand-navy bg-brand-navy-light text-brand-navy"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-navy/40"
            )}
          >
            <span className="text-label-sm">{p.label}</span>
            {p.targetWidth && p.targetHeight && (
              <span className="text-label-sm text-neutral-400">
                {p.targetWidth}×{p.targetHeight}
              </span>
            )}
          </button>
        ))}
      </div>

      {selected?.isCustom && (
        <div className="mt-3 flex items-center gap-3">
          <div>
            <label className="mb-1 block text-label-sm text-neutral-500">Width (px)</label>
            <Input
              type="number"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              value={value.customWidth ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  customWidth: clamp(Number(e.target.value) || MIN_DIMENSION),
                })
              }
              className="h-10 w-28 text-body-md"
            />
          </div>
          <span className="mt-5 text-neutral-400">×</span>
          <div>
            <label className="mb-1 block text-label-sm text-neutral-500">Height (px)</label>
            <Input
              type="number"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              value={value.customHeight ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  customHeight: clamp(Number(e.target.value) || MIN_DIMENSION),
                })
              }
              className="h-10 w-28 text-body-md"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(n: number): number {
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(n)));
}
