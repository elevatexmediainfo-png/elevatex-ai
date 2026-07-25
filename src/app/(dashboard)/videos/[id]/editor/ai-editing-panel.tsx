"use client";

import * as React from "react";
import { Loader2, RefreshCw, Repeat, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEditor } from "./editor-types";

type Busy = "regenerate" | "voice" | "replace" | null;

// AI Editing panel — Replace scene, Regenerate scene, Regenerate voice,
// Change image/video prompt (folded into "Regenerate scene": see
// lib/render/pipeline.ts's regenerateScene for why a prompt change can't go
// through the Studio's PATCH route once a scene is COMPLETED). "Regenerate
// subtitles" lives in the Captions panel (word-level data belongs with the
// word-level editor) — this panel links there instead of duplicating it.
export function AiEditingPanel() {
  const { project, scenes, patchScene, setRightTab } = useEditor();
  const [sceneId, setSceneId] = React.useState(scenes[0]?.id ?? "");
  const scene = scenes.find((s) => s.id === sceneId);

  const [imagePrompt, setImagePrompt] = React.useState(scene?.imagePrompt ?? "");
  const [videoPrompt, setVideoPrompt] = React.useState(scene?.videoPrompt ?? "");
  const [replaceWithId, setReplaceWithId] = React.useState<string>("");
  const [busy, setBusy] = React.useState<Busy>(null);

  React.useEffect(() => {
    setImagePrompt(scene?.imagePrompt ?? "");
    setVideoPrompt(scene?.videoPrompt ?? "");
  }, [sceneId, scene?.imagePrompt, scene?.videoPrompt]);

  async function handleRegenerateScene() {
    if (!sceneId) return;
    setBusy("regenerate");
    try {
      const res = await fetch(`/api/videos/${project.id}/scenes/${sceneId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePrompt, videoPrompt }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't regenerate this scene.");
        return;
      }
      patchScene(sceneId, { imagePrompt: imagePrompt || null, videoPrompt: videoPrompt || null });
      toast.success("Scene queued for regeneration.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRegenerateVoice() {
    if (!sceneId) return;
    setBusy("voice");
    try {
      const res = await fetch(`/api/videos/${project.id}/scenes/${sceneId}/regenerate-voice`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't regenerate the voiceover.");
        return;
      }
      toast.success("Voiceover queued for regeneration.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReplaceScene() {
    if (!sceneId || !replaceWithId) return;
    setBusy("replace");
    try {
      const res = await fetch(`/api/videos/${project.id}/scenes/${sceneId}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: replaceWithId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't replace this scene.");
        return;
      }
      toast.success("Every clip referencing this scene was repointed.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-md text-neutral-700">AI Editing</p>

      <Select value={sceneId} onValueChange={setSceneId}>
        <SelectTrigger className="h-10 w-full" aria-label="Scene">
          <SelectValue placeholder="Choose a scene" />
        </SelectTrigger>
        <SelectContent>
          {scenes.map((s, i) => (
            <SelectItem key={s.id} value={s.id}>
              Scene {i + 1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {scene && (
        <>
          <div>
            <label className="mb-1.5 block text-label-sm text-neutral-700">Image prompt</label>
            <Textarea rows={2} value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder={scene.prompt} />
          </div>
          <div>
            <label className="mb-1.5 block text-label-sm text-neutral-700">Video prompt</label>
            <Textarea rows={2} value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} placeholder={scene.prompt} />
          </div>

          <Button type="button" variant="primary" size="sm" disabled={busy !== null} onClick={handleRegenerateScene}>
            {busy === "regenerate" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Regenerate scene with this prompt
          </Button>

          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={handleRegenerateVoice}>
            {busy === "voice" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Regenerate voice only
          </Button>

          <Button type="button" variant="ghost" size="sm" onClick={() => setRightTab("captions")}>
            Regenerate subtitles →
          </Button>

          <div className="mt-2 border-t border-neutral-100 pt-3">
            <p className="text-label-sm text-neutral-700">Replace scene</p>
            <p className="mt-1 text-body-sm text-neutral-500">
              Repoints every clip on the Timeline that references this scene at a different one.
            </p>
            <div className="mt-2 flex gap-2">
              <Select value={replaceWithId} onValueChange={setReplaceWithId}>
                <SelectTrigger className="h-10 flex-1" aria-label="Replace with">
                  <SelectValue placeholder="Replace with…" />
                </SelectTrigger>
                <SelectContent>
                  {scenes
                    .filter((s) => s.id !== sceneId)
                    .map((s, i) => (
                      <SelectItem key={s.id} value={s.id}>
                        Scene {i + 1}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" disabled={busy !== null || !replaceWithId} onClick={handleReplaceScene}>
                {busy === "replace" ? <Loader2 className="size-4 animate-spin" /> : <Repeat className="size-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
