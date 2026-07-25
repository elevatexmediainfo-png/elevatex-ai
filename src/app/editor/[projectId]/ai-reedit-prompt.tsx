"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useAddTransitionMutation,
  useDeleteClipMutation,
  useAddClipMutation,
  useRemoveTransitionMutation,
  useReeditClipMutation,
  useReplaceClipSourceMutation,
  useUpdateClipMutation,
} from "./queries";
import { useEditorStoreApi } from "./store";
import { mapReeditResponseToCommand } from "./ai-reedit-command-map";
import type { ClipCommandDeps, TransitionCommandDeps } from "./commands";
import type { ClipView, TransitionView } from "../types";

// Phase 12 Module 9 — Prompt-based re-edit. Scoped to exactly ONE
// selected clip (the panel that mounts this only renders it in the
// single-select branch — see right-properties-panel.tsx) since none of
// the 5 supported operations make sense for zero or multiple clips; that
// scoping happens at the MOUNT point, not inside this component.
//
// Builds its OWN ClipCommandDeps/TransitionCommandDeps rather than
// reusing right-properties-panel.tsx's own `commandDeps` — that one
// deliberately stubs `deleteClip` (delete happens elsewhere in that
// panel's own flow), which would silently break this component's
// "delete_clip" operation. Only the mutations this component's 5
// operations actually touch are wired for real (updateClip/deleteClip/
// addClip/replaceClipSource, addTransition/removeTransition); everything
// else stays a rejecting stub, same "wire only what's used, matching the
// existing per-component convention (PreviewWindow's own commandDeps
// does the same).
export function AiReeditPrompt({ projectId, clip, transitions }: { projectId: string; clip: ClipView; transitions: TransitionView[] }) {
  const [instruction, setInstruction] = React.useState("");
  const [message, setMessage] = React.useState<{ kind: "error" | "info"; text: string } | null>(null);
  const reeditMutation = useReeditClipMutation(projectId);
  const storeApi = useEditorStoreApi();

  const updateClipMutation = useUpdateClipMutation(projectId);
  const deleteClipMutation = useDeleteClipMutation(projectId);
  const addClipMutation = useAddClipMutation(projectId);
  const replaceSourceMutation = useReplaceClipSourceMutation(projectId);
  const addTransitionMutation = useAddTransitionMutation(projectId);
  const removeTransitionMutation = useRemoveTransitionMutation(projectId);

  const clipDeps: ClipCommandDeps = React.useMemo(
    () => ({
      updateClip: (input) => updateClipMutation.mutateAsync(input),
      deleteClip: (clipId) => deleteClipMutation.mutateAsync(clipId),
      addClip: (patch) => addClipMutation.mutateAsync(patch),
      replaceClipSource: (input) => replaceSourceMutation.mutateAsync(input),
      splitClip: () => Promise.reject(new Error("not used")),
      rippleDeleteClip: () => Promise.reject(new Error("not used")),
      duplicateClip: () => Promise.reject(new Error("not used")),
      groupClips: () => Promise.reject(new Error("not used")),
      ungroupClips: () => Promise.reject(new Error("not used")),
      restoreTransition: () => Promise.reject(new Error("not used")),
    }),
    [updateClipMutation, deleteClipMutation, addClipMutation, replaceSourceMutation]
  );

  const transitionDeps: TransitionCommandDeps = React.useMemo(
    () => ({
      addTransition: (patch) => addTransitionMutation.mutateAsync(patch),
      removeTransition: (transitionId) => removeTransitionMutation.mutateAsync(transitionId),
      updateTransition: () => Promise.reject(new Error("not used")),
    }),
    [addTransitionMutation, removeTransitionMutation]
  );

  async function handleSubmit() {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    setMessage(null);
    try {
      const result = await reeditMutation.mutateAsync({ clipId: clip.id, instruction: trimmed });
      const mapped = mapReeditResponseToCommand(result, clip, transitions, clipDeps, transitionDeps);
      if ("error" in mapped) {
        setMessage({ kind: "error", text: mapped.error });
        return;
      }
      await storeApi.getState().runCommand(mapped.command);
      setMessage({ kind: "info", text: "Done." });
      setInstruction("");
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const isBusy = reeditMutation.isPending;

  return (
    <div className="space-y-1.5 border-t border-editor-line pt-3" data-ai-reedit-prompt data-ai-reedit-clip-id={clip.id}>
      <span className="flex items-center gap-1 text-caption text-neutral-500">
        <Sparkles className="size-3" /> AI re-edit
      </span>
      <div className="flex gap-1.5">
        <Input
          data-ai-reedit-input
          placeholder='e.g. "remove the zoom", "make this bigger"'
          value={instruction}
          disabled={isBusy}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
          }}
          className="h-8 flex-1 bg-editor-surface-1 text-caption text-neutral-100"
        />
        <Button type="button" size="sm" data-ai-reedit-submit disabled={!instruction.trim() || isBusy} onClick={() => void handleSubmit()}>
          {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Go"}
        </Button>
      </div>
      {message && (
        <p data-ai-reedit-message data-ai-reedit-message-kind={message.kind} className={cn("text-micro", message.kind === "error" ? "text-editor-danger" : "text-emerald-400")}>
          {message.text}
        </p>
      )}
    </div>
  );
}
