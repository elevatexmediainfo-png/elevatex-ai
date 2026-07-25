"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reusable style-chip selector used in the hero prompt box and create pages.
// value=null means nothing selected. Clicking an active chip deselects it.
// Performance: memo + stable handler via useCallback prevent re-renders when
// the parent re-renders for unrelated state (e.g. textarea onChange).

export type StyleChip = {
  id: string;
  label: string;
  emoji?: string;
};

interface StyleChipSelectorProps {
  chips: StyleChip[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}

export const StyleChipSelector = React.memo(function StyleChipSelector({
  chips,
  value,
  onChange,
  className,
}: StyleChipSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Style preset"
      className={cn(
        "flex gap-2 overflow-x-auto pb-0.5 scrollbar-none",
        className,
      )}
    >
      {chips.map((chip) => {
        const active = chip.id === value;
        return (
          <StyleChipItem
            key={chip.id}
            chip={chip}
            active={active}
            onSelect={onChange}
          />
        );
      })}
    </div>
  );
});

// Extracted so each chip is a stable component that only re-renders when
// its own `active` state changes — not when a sibling is selected.
const StyleChipItem = React.memo(function StyleChipItem({
  chip,
  active,
  onSelect,
}: {
  chip: StyleChip;
  active: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1, scale: 1.025 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
      onClick={() => onSelect(active ? null : chip.id)}
      aria-pressed={active}
      className={cn(
        "flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full",
        "text-[12.5px] font-medium transition-colors duration-200 border whitespace-nowrap",
        active
          ? "text-white border-transparent"
          : [
              "text-dash-ink/50 border-dash-ink/[0.09] bg-dash-ink/[0.03]",
              "hover:text-dash-ink/80 hover:border-dash-ink/[0.16] hover:bg-dash-ink/[0.06]",
            ],
      )}
      style={
        active
          ? {
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.9) 0%, rgba(37,99,235,0.9) 100%)",
              boxShadow: "0 2px 12px rgba(124,58,237,0.28)",
            }
          : undefined
      }
    >
      {chip.emoji && <span aria-hidden>{chip.emoji}</span>}
      {chip.label}
    </motion.button>
  );
});
