"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEditor, type ClipView } from "./editor-types";
import { getPresetById, MOTION_PRESETS, type MotionKeyframe } from "@/lib/motion/engine";

const MOTION_PARAMETERS = ["position", "scale", "rotation", "opacity", "blur", "crop", "mask", "motionPath"] as const;
const MOTION_EASINGS = ["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_OUT", "BEZIER"] as const;

export function MotionEditorPanel() {
  const { tracks, clips, selectedClipId, setSelectedClipId, updateClip, addTrack, addClip, fonts } = useEditor();
  const textTracks = tracks.filter((t) => t.kind === "TEXT" || t.kind === "STICKER");
  const selectedClip = clips.find((c) => c.id === selectedClipId);
  const editingClip = selectedClip && textTracks.some((t) => t.id === selectedClip.trackId) ? selectedClip : null;

  const [draftKeyframes, setDraftKeyframes] = React.useState<MotionKeyframe[]>(editingClip?.content?.motionKeyframes ?? []);
  const [presetId, setPresetId] = React.useState(editingClip?.content?.motionPresetId ?? "");

  React.useEffect(() => {
    setDraftKeyframes(editingClip?.content?.motionKeyframes ?? []);
    setPresetId(editingClip?.content?.motionPresetId ?? "");
  }, [editingClip?.id]);

  function patchContent(patch: Partial<NonNullable<ClipView["content"]>>) {
    if (!editingClip) return;
    const nextContent = { ...(editingClip.content ?? {}), ...patch };
    void updateClip(editingClip.id, { content: nextContent });
    if (patch.motionKeyframes) setDraftKeyframes(patch.motionKeyframes as MotionKeyframe[]);
    if (patch.motionPresetId !== undefined) setPresetId(patch.motionPresetId as string);
  }

  function applyPreset(id: string) {
    if (!editingClip) return;
    const preset = getPresetById(id);
    if (!preset) return;
    const durationMs = editingClip.durationMs;
    const keyframes = preset.keyframes(durationMs);
    patchContent({ motionPresetId: id, motionKeyframes: keyframes });
  }

  function addKeyframe() {
    if (!editingClip) return;
    const next: MotionKeyframe = {
      id: `kf-${Date.now()}`,
      parameter: "position",
      timeMs: 0,
      value: { x: 0.5, y: 0.5 },
      easing: "EASE_IN_OUT",
    };
    const combined = [...draftKeyframes, next];
    patchContent({ motionKeyframes: combined });
  }

  function updateKeyframe(id: string, patch: Partial<MotionKeyframe>) {
    const next = draftKeyframes.map((kf) => (kf.id === id ? { ...kf, ...patch } : kf));
    patchContent({ motionKeyframes: next });
  }

  function removeKeyframe(id: string) {
    const next = draftKeyframes.filter((kf) => kf.id !== id);
    patchContent({ motionKeyframes: next });
  }

  if (!editingClip) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-label-md text-neutral-700">Motion</p>
          <p className="text-body-sm text-neutral-500">Select a text or sticker clip to add motion presets and keyframes.</p>
        </div>
        {textTracks.length === 0 ? (
          <p className="text-body-sm text-neutral-500">No editable text or sticker layers exist yet. Add one in the Layers panel.</p>
        ) : (
          <Button type="button" variant="primary" size="sm" onClick={() => setSelectedClipId(textTracks[0].id)}>
            Select first text/sticker layer
          </Button>
        )}
      </div>
    );
  }

  const motionKeyframes = draftKeyframes;
  const selectedPreset = motionKeyframes.length === 0 ? null : getPresetById(presetId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-label-md text-neutral-700">Motion</p>
            <p className="text-body-sm text-neutral-500">Define animated movement, opacity, blur, and more for the selected clip.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addKeyframe}>
            <Plus className="size-4" /> Add keyframe
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-3">
        <div className="grid gap-2">
          <label className="text-label-sm text-neutral-700">Motion preset</label>
          <Select value={presetId} onValueChange={(value) => applyPreset(value)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Choose a preset" />
            </SelectTrigger>
            <SelectContent>
              {MOTION_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPreset ? (
            <p className="text-body-sm text-neutral-500">Applied preset: {selectedPreset.label}</p>
          ) : (
            <p className="text-body-sm text-neutral-500">No preset selected.</p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-label-sm text-neutral-700">Motion keyframes</label>
          {motionKeyframes.length === 0 ? (
            <p className="text-body-sm text-neutral-500">No keyframes added yet. Use a preset or add one manually.</p>
          ) : (
            <div className="space-y-3">
              {motionKeyframes.map((keyframe) => (
                <div key={keyframe.id} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-800">{keyframe.parameter}</p>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeKeyframe(keyframe.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-label-sm text-neutral-700">Parameter</label>
                      <Select value={keyframe.parameter} onValueChange={(value) => updateKeyframe(keyframe.id, { parameter: value as typeof MOTION_PARAMETERS[number] })}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOTION_PARAMETERS.map((parameter) => (
                            <SelectItem key={parameter} value={parameter}>
                              {parameter}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-label-sm text-neutral-700">Time (ms)</label>
                      <Input
                        type="number"
                        min={0}
                        max={editingClip.durationMs}
                        value={keyframe.timeMs}
                        onChange={(event) => updateKeyframe(keyframe.id, { timeMs: Number(event.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-label-sm text-neutral-700">Easing</label>
                      <Select value={typeof keyframe.easing === "string" ? keyframe.easing : "BEZIER"} onValueChange={(value) => updateKeyframe(keyframe.id, { easing: value === "BEZIER" ? { type: "BEZIER", x1: 0.2, y1: 0.0, x2: 0.2, y2: 1.0 } : (value as "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_OUT") })}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOTION_EASINGS.map((easing) => (
                            <SelectItem key={easing} value={easing}>
                              {easing}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-label-sm text-neutral-700">Value</label>
                      <Textarea
                        rows={3}
                        value={typeof keyframe.value === "string" ? keyframe.value : JSON.stringify(keyframe.value)}
                        onChange={(event) => {
                          try {
                            const parsed = JSON.parse(event.target.value);
                            updateKeyframe(keyframe.id, { value: parsed });
                          } catch {
                            // ignore invalid JSON until the user fixes it
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
