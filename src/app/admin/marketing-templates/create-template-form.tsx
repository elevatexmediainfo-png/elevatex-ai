"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASPECT_RATIOS_BY_OUTPUT_TYPE } from "@/lib/marketing-templates/aspect-ratios";
import { OUTPUT_TYPE_OPTIONS, type AspectRatio, type OutputType } from "./types";

interface NewTemplateInput {
  name: string;
  category: string | null;
  outputType: OutputType;
  aspectRatio: AspectRatio;
}

const EMPTY_FORM = { name: "", category: "", outputType: "IMAGE" as OutputType, aspectRatio: "RATIO_1_1" as AspectRatio };

// Step 1 — "Create New Template". Only the fields needed to create a bare
// row; everything else is filled in on the card that appears immediately
// below once created (see TemplateCard).
export function CreateTemplateForm({ onCreate }: { onCreate: (input: NewTemplateInput) => Promise<string | null> }) {
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [creating, setCreating] = React.useState(false);

  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error("A name is required.");
      return;
    }
    setCreating(true);
    try {
      const id = await onCreate({
        name: form.name.trim(),
        category: form.category.trim() || null,
        outputType: form.outputType,
        aspectRatio: form.aspectRatio,
      });
      if (id) {
        toast.success("Template created — fill in the Prompt Template and Primary Provider below.");
        setForm(EMPTY_FORM);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="mb-3 text-label-lg text-neutral-900">Create New Template</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label className="text-label-sm text-neutral-600">Name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <Label className="text-label-sm text-neutral-600">Category</Label>
          <Input
            placeholder="e.g. Product Launch"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-label-sm text-neutral-600">Output Type</Label>
          <Select
            value={form.outputType}
            onValueChange={(v) => {
              const outputType = v as OutputType;
              setForm((f) => ({
                ...f,
                outputType,
                aspectRatio: ASPECT_RATIOS_BY_OUTPUT_TYPE[outputType].includes(f.aspectRatio)
                  ? f.aspectRatio
                  : ASPECT_RATIOS_BY_OUTPUT_TYPE[outputType][0],
              }));
            }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-label-sm text-neutral-600">Aspect Ratio</Label>
          <Select value={form.aspectRatio} onValueChange={(v) => setForm((f) => ({ ...f, aspectRatio: v as AspectRatio }))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS_BY_OUTPUT_TYPE[form.outputType].map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="button" variant="primary" size="sm" className="mt-3" disabled={creating} onClick={handleCreate}>
        {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Create Template
      </Button>
    </div>
  );
}
