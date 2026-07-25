"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

// Filters — advanced/global filter controls meant to refine results across
// every content section (Stock Videos/Images/Music/etc.). UI only: toggling
// a checkbox updates local state but nothing queries against it yet, since
// there's no real content API to filter.
interface FilterGroup {
  label: string;
  options: string[];
}

const FILTER_GROUPS: FilterGroup[] = [
  { label: "Duration", options: ["Under 15s", "15–60s", "Over 60s"] },
  { label: "Orientation", options: ["Landscape", "Portrait", "Square"] },
  { label: "Resolution", options: ["HD", "Full HD", "4K"] },
  { label: "License", options: ["Free", "Premium"] },
  { label: "Color", options: ["Warm", "Cool", "Black & White"] },
];

export function FiltersSection() {
  const [checked, setChecked] = React.useState<Set<string>>(new Set());

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-editor-line p-3">
        <h2 className="text-label-sm text-neutral-200">Filters</h2>
        {checked.size > 0 && (
          <button type="button" className="text-caption text-neutral-400 hover:text-white" onClick={() => setChecked(new Set())}>
            Clear ({checked.size})
          </button>
        )}
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-3 [scrollbar-gutter:stable]">
        {FILTER_GROUPS.map((group) => (
          <section key={group.label}>
            <p className="mb-2 text-caption text-neutral-500">{group.label}</p>
            <div className="space-y-2">
              {group.options.map((option) => {
                const key = `${group.label}:${option}`;
                return (
                  <label key={key} className="flex items-center gap-2 text-body-sm text-neutral-300">
                    <Checkbox checked={checked.has(key)} onCheckedChange={() => toggle(key)} />
                    {option}
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="border-t border-editor-line p-3">
        <Button type="button" variant="secondary" size="sm" className="w-full" disabled={checked.size === 0}>
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
