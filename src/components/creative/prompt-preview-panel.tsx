"use client";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { UniversalPrompt } from "@/lib/prompt-os/schema";
import type { CreativeBrief } from "@/lib/prompt-os/creative-director";

interface PromptPreviewPanelProps {
  universalPrompt: UniversalPrompt | undefined;
  enhancedPrompt: string;
}

function Field({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <p className="text-body-sm text-neutral-600">
      <span className="font-medium text-neutral-800">{label}:</span> {value}
    </p>
  );
}

// Phase 2.3 — Universal Prompt Intelligence: a debugging/transparency
// surface, collapsed by default (Accordion starts with no value open) so it
// never intrudes on the normal "type a sentence, get a result" flow —
// advanced users expand it to see exactly what fed the generation. Every
// section reads from data CreativeStudio already has in state; no new
// fetches, no new API calls.
export function PromptPreviewPanel({ universalPrompt, enhancedPrompt }: PromptPreviewPanelProps) {
  if (!universalPrompt) return null;

  const marketing = universalPrompt.marketing;
  const style = universalPrompt.style;
  // Phase 2.4 — echoed straight through from the Creative Director step;
  // `unknown` at the schema level (see schema.ts), narrowed here for display.
  const creativeBrief = universalPrompt.creativeBrief as CreativeBrief | undefined;

  return (
    <Accordion type="single" collapsible className="rounded-lg border border-neutral-200 px-3">
      <AccordionItem value="prompt-intelligence">
        <AccordionTrigger className="text-label-sm text-neutral-600">Prompt Intelligence (advanced)</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4">
          {creativeBrief && (
            <div>
              <p className="text-label-sm mb-1 text-neutral-800">Creative Brief</p>
              <Field label="Marketing objective" value={creativeBrief.marketingObjective} />
              <Field label="Creative objective" value={creativeBrief.creativeObjective} />
              <Field label="Target audience" value={creativeBrief.targetAudience} />
              <Field label="Brand personality" value={creativeBrief.brandPersonality} />
              <Field label="Visual direction" value={creativeBrief.visualStrategy?.visualDirection} />
              <Field label="Primary message" value={creativeBrief.messagingStrategy?.primaryMessage} />
              <Field label="Call to action" value={creativeBrief.callToAction} />
              <Field label="Attention hook" value={creativeBrief.attentionHook} />
              <Field label="Confidence" value={creativeBrief.creativeConfidence} />
            </div>
          )}

          <div>
            <p className="text-label-sm mb-1 text-neutral-800">Marketing Strategy</p>
            <Field label="Industry" value={universalPrompt.industry} />
            <Field label="Goal" value={marketing.goal} />
            <Field label="Target audience" value={marketing.targetAudience} />
            <Field label="Psychology hooks" value={marketing.psychologyHooks?.join(", ")} />
          </div>

          <div>
            <p className="text-label-sm mb-1 text-neutral-800">Creative Summary</p>
            <Field label="Type" value={universalPrompt.creative_type} />
            <Field label="Platform" value={universalPrompt.platform} />
            <Field label="Mood" value={style.mood} />
            <Field label="Aesthetic" value={style.aesthetic} />
            <Field label="Layout" value={universalPrompt.layout.composition} />
            <Field label="Colors" value={universalPrompt.colors.palette?.join(", ")} />
          </div>

          <div>
            <p className="text-label-sm mb-1 text-neutral-800">Universal JSON</p>
            <pre className="max-h-64 overflow-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">
              {JSON.stringify(universalPrompt, null, 2)}
            </pre>
          </div>

          <div>
            <p className="text-label-sm mb-1 text-neutral-800">Provider Prompt</p>
            <p className="text-body-sm whitespace-pre-wrap text-neutral-600">{enhancedPrompt || "—"}</p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
