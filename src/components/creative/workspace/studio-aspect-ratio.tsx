"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PRESETS_BY_KIND } from "@/lib/validations/creative";
import type { AspectRatioValue } from "@/components/creative/aspect-ratio-selector";

type Kind = keyof typeof PRESETS_BY_KIND;

const MIN_DIMENSION = 256;
const MAX_DIMENSION = 2048;

interface StudioAspectRatioProps {
  kind: Kind;
  value: AspectRatioValue;
  onChange: (value: AspectRatioValue) => void;
}

function clamp(n: number) {
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(n)));
}

// Dark-theme version of AspectRatioSelector — same data + logic as the
// existing component, restyled for the workspace's dark surface.
export function StudioAspectRatio({ kind, value, onChange }: StudioAspectRatioProps) {
  const presets = PRESETS_BY_KIND[kind];
  const selected = presets.find((p) => p.key === value.presetKey);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = p.key === value.presetKey;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange({ presetKey: p.key, customWidth: value.customWidth, customHeight: value.customHeight })}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-[12px] border px-3 py-2 text-left transition-all duration-150",
                active
                  ? "border-transparent text-white"
                  : "border-white/[0.09] bg-white/[0.03] text-white/50 hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white/80",
              )}
              style={
                active
                  ? {
                      background: "linear-gradient(135deg, rgba(124,58,237,0.85) 0%, rgba(37,99,235,0.85) 100%)",
                      boxShadow: "0 2px 10px rgba(124,58,237,0.22)",
                    }
                  : undefined
              }
            >
              <span className="text-[12px] font-medium">{p.label}</span>
              {p.targetWidth && p.targetHeight && (
                <span className={`text-[10.5px] ${active ? "text-white/60" : "text-white/25"}`}>
                  {p.targetWidth}×{p.targetHeight}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected?.isCustom && (
        <div className="mt-3 flex items-center gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-white/35">Width</label>
            <input
              type="number"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              value={value.customWidth ?? ""}
              onChange={(e) => onChange({ ...value, customWidth: clamp(Number(e.target.value) || MIN_DIMENSION) })}
              className="h-9 w-24 rounded-[10px] border border-white/[0.09] bg-white/[0.04] px-3 text-[13px] text-white/80 outline-none transition-colors duration-150 focus:border-violet-500/40 [appearance:textfield]"
            />
          </div>
          <span className="mt-4 text-white/25">×</span>
          <div>
            <label className="mb-1 block text-[11px] text-white/35">Height</label>
            <input
              type="number"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              value={value.customHeight ?? ""}
              onChange={(e) => onChange({ ...value, customHeight: clamp(Number(e.target.value) || MIN_DIMENSION) })}
              className="h-9 w-24 rounded-[10px] border border-white/[0.09] bg-white/[0.04] px-3 text-[13px] text-white/80 outline-none transition-colors duration-150 focus:border-violet-500/40 [appearance:textfield]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
