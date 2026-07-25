"use client";

import { Wand2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  onEditIdea: () => void;
  generateLabel?: string;
}

// Milestone 15 — the "review and edit the enhanced prompt before
// generating" step, extracted out of the AI Image wizard so it's shared
// (not copy-pasted) across the AI Image / Social Media / Marketing
// Creative studios.
export function PromptEditor({ value, onChange, onGenerate, onEditIdea, generateLabel = "Generate Image" }: PromptEditorProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-md text-neutral-700">Your enhanced prompt — feel free to edit it</p>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} className="text-body-md" />
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="primary" size="lg" disabled={!value.trim()} onClick={onGenerate}>
          <Wand2 className="size-4" /> {generateLabel}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onEditIdea}>
          <Pencil className="size-4" /> Edit Prompt
        </Button>
      </div>
    </div>
  );
}
