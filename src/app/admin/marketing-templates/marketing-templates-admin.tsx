"use client";

import * as React from "react";

import { CreateTemplateForm } from "./create-template-form";
import { TemplateCard } from "./template-card";
import { useMarketingTemplates } from "./use-marketing-templates";

// New Marketing Templates admin page (2026-08-03 rewrite) — replaces the
// previous single ~600-line component. Split into four focused pieces:
// types.ts (shared shapes), use-marketing-templates.ts (all data/mutation
// logic), create-template-form.tsx (Step 1), template-card.tsx (Step 2 —
// every field always visible, no accordion/second page/modal). This file
// is purely the orchestrator: owns the scroll-to-and-focus-the-new-card
// behavior after create, nothing else.
//
// Every call goes through the existing, unmodified backend APIs — no new
// routes, no schema change, no generation-logic change.
export function MarketingTemplatesAdmin() {
  const {
    templates,
    providersByType,
    createTemplate,
    patchTemplate,
    deleteTemplate,
    uploadAndAttachReferenceAsset,
    removeReferenceAsset,
    setReferenceAssetRole,
    moveReferenceAsset,
  } = useMarketingTemplates();

  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const cardRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const promptRefs = React.useRef<Map<string, HTMLTextAreaElement>>(new Map());
  // Set the instant a create succeeds, before the refreshed template list
  // re-renders — the effect below fires once the corresponding card's ref
  // actually exists (React has committed it), so "insert immediately,
  // scroll to it, open it" happens reliably regardless of network timing.
  const pendingFocusId = React.useRef<string | null>(null);

  React.useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    const card = cardRefs.current.get(id);
    if (!card) return;
    pendingFocusId.current = null;

    card.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedId(id);
    promptRefs.current.get(id)?.focus();

    const timer = setTimeout(() => {
      setHighlightedId((current) => (current === id ? null : current));
    }, 2500);
    return () => clearTimeout(timer);
  }, [templates]);

  async function handleCreate(input: Parameters<typeof createTemplate>[0]) {
    const id = await createTemplate(input);
    if (id) pendingFocusId.current = id;
    return id;
  }

  if (!templates) {
    return <p className="text-body-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <CreateTemplateForm onCreate={handleCreate} />

      {templates.length === 0 ? (
        <p className="text-body-sm text-neutral-500">No marketing templates yet.</p>
      ) : (
        templates
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              providerOptions={providersByType[template.outputType]}
              highlighted={highlightedId === template.id}
              cardRef={(el) => {
                if (el) cardRefs.current.set(template.id, el);
                else cardRefs.current.delete(template.id);
              }}
              promptRef={(el) => {
                if (el) promptRefs.current.set(template.id, el);
                else promptRefs.current.delete(template.id);
              }}
              onPatch={patchTemplate}
              onDelete={deleteTemplate}
              onUploadReferenceAsset={uploadAndAttachReferenceAsset}
              onRemoveReferenceAsset={removeReferenceAsset}
              onSetReferenceAssetRole={setReferenceAssetRole}
              onMoveReferenceAsset={moveReferenceAsset}
            />
          ))
      )}
    </div>
  );
}
