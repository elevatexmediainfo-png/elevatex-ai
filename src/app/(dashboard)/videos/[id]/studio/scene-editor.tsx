"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Image as ImageIcon, Loader2, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUndoRedo } from "./use-undo-redo";
import type { MusicOption, VoiceOption } from "./studio-client";

export interface SceneView {
  id: string;
  order: number;
  status: string;
  prompt: string;
  imagePrompt: string | null;
  videoPrompt: string | null;
  negativePrompt: string | null;
  subtitleText: string | null;
  durationSeconds: number;
  transition: string;
  voiceId: string | null;
  backgroundMusicUrl: string | null;
  errorMessage: string | null;
}

type TextField = "prompt" | "imagePrompt" | "videoPrompt" | "negativePrompt" | "subtitleText";

const TRANSITIONS = ["CUT", "FADE", "DISSOLVE", "SLIDE"] as const;

const STATUS_BADGE: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  PENDING: "neutral",
  RENDERING: "warning",
  COMPLETED: "success",
  FAILED: "error",
  CANCELLED: "neutral",
};

const SAVE_DEBOUNCE_MS = 900;

export function SceneEditor({
  videoProjectId,
  scenes,
  onScenesChange,
  thumbnailSceneId,
  onThumbnailChange,
  availableVoices,
  musicLibrary,
  editable,
}: {
  videoProjectId: string;
  scenes: SceneView[];
  onScenesChange: (scenes: SceneView[]) => void;
  thumbnailSceneId: string | null;
  onThumbnailChange: (sceneId: string) => void;
  availableVoices: VoiceOption[];
  musicLibrary: MusicOption[];
  editable: boolean;
}) {
  const [adding, setAdding] = React.useState(false);
  const [savingSceneId, setSavingSceneId] = React.useState<string | null>(null);
  const history = useUndoRedo();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const sceneTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const ordered = React.useMemo(() => [...scenes].sort((a, b) => a.order - b.order), [scenes]);

  function patchSceneLocal(sceneId: string, patch: Partial<SceneView>) {
    onScenesChange(scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)));
  }

  async function persistSceneField(sceneId: string, field: TextField, value: string | null) {
    setSavingSceneId(sceneId);
    try {
      const res = await fetch(`/api/videos/${videoProjectId}/scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value ?? "" }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't save that change.");
      }
    } catch {
      toast.error("Network error while saving.");
    } finally {
      setSavingSceneId(null);
    }
  }

  async function persistSceneImmediate(sceneId: string, patch: Record<string, unknown>) {
    setSavingSceneId(sceneId);
    try {
      const res = await fetch(`/api/videos/${videoProjectId}/scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't save that change.");
      }
    } catch {
      toast.error("Network error while saving.");
    } finally {
      setSavingSceneId(null);
    }
  }

  function applyTextField(sceneId: string, field: TextField, value: string | null) {
    patchSceneLocal(sceneId, { [field]: value } as Partial<SceneView>);
    void persistSceneField(sceneId, field, value);
  }

  function handleTextFieldChange(sceneId: string, field: TextField, previous: string | null, next: string) {
    patchSceneLocal(sceneId, { [field]: next } as Partial<SceneView>);
    const timerKey = `${sceneId}:${field}`;
    if (sceneTimers.current[timerKey]) clearTimeout(sceneTimers.current[timerKey]);
    sceneTimers.current[timerKey] = setTimeout(() => {
      history.push({
        undo: () => applyTextField(sceneId, field, previous),
        redo: () => applyTextField(sceneId, field, next),
      });
      void persistSceneField(sceneId, field, next);
    }, SAVE_DEBOUNCE_MS);
  }

  function currentValueFor(sceneId: string, field: TextField): string | null {
    const scene = scenes.find((s) => s.id === sceneId);
    return scene ? (scene[field] as string | null) : null;
  }

  async function handleAddScene() {
    setAdding(true);
    try {
      const res = await fetch(`/api/videos/${videoProjectId}/scenes`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't add a scene.");
        return;
      }
      onScenesChange([...scenes, { ...json.data.scene, errorMessage: json.data.scene.errorMessage ?? null }]);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteScene(sceneId: string) {
    if (!window.confirm("Delete this scene? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/videos/${videoProjectId}/scenes/${sceneId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't delete that scene.");
        return;
      }
      onScenesChange(
        scenes
          .filter((s) => s.id !== sceneId)
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({ ...s, order: i }))
      );
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function handleSetThumbnail(sceneId: string) {
    try {
      const res = await fetch(`/api/videos/${videoProjectId}/thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't set thumbnail.");
        return;
      }
      onThumbnailChange(sceneId);
      toast.success("Thumbnail updated.");
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((s) => s.id === active.id);
    const newIndex = ordered.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(ordered, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }));
    onScenesChange(reordered);

    try {
      const res = await fetch(`/api/videos/${videoProjectId}/scenes/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneIds: reordered.map((s) => s.id) }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't save the new order.");
        onScenesChange(ordered);
      }
    } catch {
      toast.error("Network error while reordering.");
      onScenesChange(ordered);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-label-md text-neutral-700">
          {ordered.length} scene{ordered.length === 1 ? "" : "s"}
          {savingSceneId && <span className="text-neutral-400"> · saving…</span>}
        </p>
        <div className="flex gap-1.5">
          <Button type="button" variant="ghost" size="sm" disabled={!history.canUndo} onClick={history.undo}>
            <Undo2 className="size-4" /> Undo
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={!history.canRedo} onClick={history.redo}>
            <Redo2 className="size-4" /> Redo
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ordered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 flex flex-col gap-3">
            {ordered.map((scene, index) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                index={index}
                editable={editable}
                isThumbnail={thumbnailSceneId === scene.id}
                availableVoices={availableVoices}
                musicLibrary={musicLibrary}
                onTextFieldChange={(field, next) =>
                  handleTextFieldChange(scene.id, field, currentValueFor(scene.id, field), next)
                }
                onImmediateChange={(patch) => {
                  patchSceneLocal(scene.id, patch as Partial<SceneView>);
                  void persistSceneImmediate(scene.id, patch);
                }}
                onDelete={() => handleDeleteScene(scene.id)}
                onSetThumbnail={() => handleSetThumbnail(scene.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editable && (
        <Button type="button" variant="outline" size="sm" className="mt-4" disabled={adding} onClick={handleAddScene}>
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add scene
        </Button>
      )}
    </div>
  );
}

function SceneRow({
  scene,
  index,
  editable,
  isThumbnail,
  availableVoices,
  musicLibrary,
  onTextFieldChange,
  onImmediateChange,
  onDelete,
  onSetThumbnail,
}: {
  scene: SceneView;
  index: number;
  editable: boolean;
  isThumbnail: boolean;
  availableVoices: VoiceOption[];
  musicLibrary: MusicOption[];
  onTextFieldChange: (field: TextField, next: string) => void;
  onImmediateChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onSetThumbnail: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
    disabled: !editable,
  });
  const [expanded, setExpanded] = React.useState(index === 0);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const canEditScene = editable && (scene.status === "DRAFT" || scene.status === "FAILED");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border bg-white",
        isThumbnail ? "border-brand-navy" : "border-neutral-200"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {editable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-neutral-400 hover:text-neutral-600"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <button
          type="button"
          className="flex-1 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <p className="text-label-md text-neutral-900">Scene {index + 1}</p>
          <p className="line-clamp-1 text-body-sm text-neutral-500">{scene.prompt}</p>
        </button>
        <Badge variant={STATUS_BADGE[scene.status] ?? "neutral"} outline size="sm">
          {scene.status}
        </Badge>
        {isThumbnail && <Badge variant="brand" size="sm">Thumbnail</Badge>}
        {editable && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} title="Delete scene">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-neutral-100 px-4 py-4">
          {scene.errorMessage && (
            <p className="rounded-lg bg-error-light px-3 py-2 text-body-sm text-error">{scene.errorMessage}</p>
          )}

          <Field label="Script (this scene's narration)">
            <Textarea
              defaultValue={scene.prompt}
              rows={3}
              disabled={!canEditScene}
              onChange={(e) => onTextFieldChange("prompt", e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Image prompt (optional override)">
              <Textarea
                defaultValue={scene.imagePrompt ?? ""}
                rows={2}
                disabled={!canEditScene}
                placeholder="Falls back to the script above"
                onChange={(e) => onTextFieldChange("imagePrompt", e.target.value)}
              />
            </Field>
            <Field label="Video prompt (optional override)">
              <Textarea
                defaultValue={scene.videoPrompt ?? ""}
                rows={2}
                disabled={!canEditScene}
                placeholder="Falls back to the script above"
                onChange={(e) => onTextFieldChange("videoPrompt", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Negative prompt">
            <Input
              defaultValue={scene.negativePrompt ?? ""}
              disabled={!canEditScene}
              onChange={(e) => onTextFieldChange("negativePrompt", e.target.value)}
            />
          </Field>

          <Field label="Subtitle text">
            <Textarea
              defaultValue={scene.subtitleText ?? ""}
              rows={2}
              disabled={!canEditScene}
              onChange={(e) => onTextFieldChange("subtitleText", e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (seconds)">
              <Input
                type="number"
                min={3}
                max={120}
                defaultValue={scene.durationSeconds}
                disabled={!canEditScene}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 3) onImmediateChange({ durationSeconds: n });
                }}
              />
            </Field>
            <Field label="Transition">
              <Select
                value={scene.transition}
                onValueChange={(v) => onImmediateChange({ transition: v })}
                disabled={!canEditScene}
              >
                <SelectTrigger className="h-10 w-full" aria-label="Transition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSITIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Voice">
              <Select
                value={scene.voiceId ?? "default"}
                onValueChange={(v) => onImmediateChange({ voiceId: v === "default" ? "" : v })}
                disabled={!canEditScene}
              >
                <SelectTrigger className="h-10 w-full" aria-label="Voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Background music">
              <Select
                value={scene.backgroundMusicUrl ?? "none"}
                onValueChange={(v) => onImmediateChange({ backgroundMusicUrl: v === "none" ? "" : v })}
                disabled={!canEditScene}
              >
                <SelectTrigger className="h-10 w-full" aria-label="Background music">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {musicLibrary.map((m) => (
                    <SelectItem key={m.id} value={m.url}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {!isThumbnail && (
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={onSetThumbnail}>
              <ImageIcon className="size-4" /> Use as thumbnail
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-label-sm text-neutral-700">{label}</label>
      {children}
    </div>
  );
}
