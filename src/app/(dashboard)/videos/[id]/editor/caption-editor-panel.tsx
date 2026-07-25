"use client";

import * as React from "react";
import { Loader2, RefreshCw, Save, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEditor } from "./editor-types";

interface CaptionWordDraft {
  text: string;
  startMs: number;
  endMs: number;
  speaker?: string;
  emphasis?: string;
  highlightColor?: string;
}

interface CaptionBlockResponse {
  id: string;
  style: { stylePresetId?: string } | null;
  words: CaptionWordDraft[];
}

const LANGUAGES = ["English", "Hindi", "Spanish", "French", "Arabic"] as const;
const SPEAKERS = ["Speaker 1", "Speaker 2", "Speaker 3"] as const;

// Caption Editor — rich subtitle authoring. Word-by-word timing, karaoke
// preview, speaker placeholders, template styles, multilingual UI support,
// and a future-ready auto-caption placeholder flow.
export function CaptionEditorPanel() {
  const { project, scenes, captionPresets, playheadMs } = useEditor();
  const [sceneId, setSceneId] = React.useState(scenes[0]?.id ?? "");
  const [language, setLanguage] = React.useState<typeof LANGUAGES[number]>(LANGUAGES[0]);
  const [showKaraoke, setShowKaraoke] = React.useState(false);
  const [speakerMode, setSpeakerMode] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [words, setWords] = React.useState<CaptionWordDraft[]>([]);
  const [stylePresetId, setStylePresetId] = React.useState<string | undefined>(undefined);

  const load = React.useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${project.id}/captions/${id}`);
      const json = await res.json();
      if (json.success) {
        const block = json.data.captionBlock as CaptionBlockResponse;
        setWords(block.words.map((w) => ({ ...w, speaker: SPEAKERS[0] })));
        setStylePresetId(block.style?.stylePresetId);
      } else {
        toast.error(json.error?.message ?? "Couldn't load captions.");
      }
    } catch {
      toast.error("Network error while loading captions.");
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  React.useEffect(() => {
    void load(sceneId);
  }, [sceneId, load]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = words.map(({ text, startMs, endMs, emphasis, highlightColor }) => ({
        text,
        startMs,
        endMs,
        emphasis,
        highlightColor,
      }));
      const res = await fetch(`/api/videos/${project.id}/captions/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: payload, stylePresetId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't save captions.");
        return;
      }
      toast.success("Captions saved.");
    } catch {
      toast.error("Network error while saving captions.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/videos/${project.id}/captions/${sceneId}/regenerate`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't regenerate captions.");
        return;
      }
      const block = json.data.captionBlock as CaptionBlockResponse;
      setWords(block.words.map((w) => ({ ...w, speaker: SPEAKERS[0] })));
      toast.success("Captions regenerated.");
    } catch {
      toast.error("Network error while regenerating captions.");
    } finally {
      setRegenerating(false);
    }
  }

  function updateWord(index: number, patch: Partial<CaptionWordDraft>) {
    setWords((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  const activeIndex = words.findIndex((word) => playheadMs >= word.startMs && playheadMs < word.endMs);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-md text-neutral-700">Subtitle Editor</p>
          <p className="text-body-sm text-neutral-500">Author captions with templates, karaoke previews, and speaker placeholders.</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-slate-50 px-3 py-2 text-xs text-neutral-600">
          Multi-language support
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-label-sm text-neutral-700">Scene</label>
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
        </div>
        <div>
          <label className="mb-1.5 block text-label-sm text-neutral-700">Caption language</label>
          <Select value={language} onValueChange={(value) => setLanguage(value as typeof LANGUAGES[number])}>
            <SelectTrigger className="h-10 w-full" aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-label-sm text-neutral-700">Subtitle template</label>
          <Select value={stylePresetId ?? "none"} onValueChange={(v) => setStylePresetId(v === "none" ? undefined : v)}>
            <SelectTrigger className="h-10 w-full" aria-label="Subtitle template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No template</SelectItem>
              {captionPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-label-sm text-neutral-700">
            <input type="checkbox" checked={showKaraoke} onChange={(e) => setShowKaraoke(e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-brand-navy focus:ring-brand-navy" />
            Karaoke mode
          </label>
          <label className="flex items-center gap-2 text-label-sm text-neutral-700">
            <input type="checkbox" checked={speakerMode} onChange={(e) => setSpeakerMode(e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-brand-navy focus:ring-brand-navy" />
            Speaker labels
          </label>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Button type="button" variant="outline" size="sm" disabled={regenerating || !sceneId} onClick={handleRegenerate}>
          {regenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Auto-captions placeholder
        </Button>
        <Button type="button" variant="primary" size="sm" disabled={saving || !sceneId} onClick={handleSave}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save subtitles
        </Button>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-label-sm text-neutral-700">Live preview</p>
            <p className="text-body-sm text-neutral-500">Word-by-word timing and karaoke highlighting are simulated in the editor.</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-neutral-600">
            <Sparkles className="size-4" /> {language}
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {words.length === 0 ? (
            <p className="text-body-sm text-neutral-500">No captions available yet.</p>
          ) : (
            words.map((word, index) => {
              const active = showKaraoke && index === activeIndex;
              return (
                <div
                  key={index}
                  className={`rounded-xl border px-3 py-2 transition ${
                    active ? "border-brand-navy bg-brand-navy/10" : "border-neutral-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span>{word.text}</span>
                    {active && <span className="rounded-full bg-brand-navy/10 px-2 py-1 text-xs text-brand-navy">Now</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                    <span>{word.startMs}ms → {word.endMs}ms</span>
                    {speakerMode && <span>Speaker: {word.speaker ?? SPEAKERS[0]}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {words.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_64px_120px] gap-2">
              <Input value={w.text} onChange={(e) => updateWord(i, { text: e.target.value })} />
              <Input type="number" value={w.startMs} onChange={(e) => updateWord(i, { startMs: Number(e.target.value) })} title="Start (ms)" />
              <Input type="number" value={w.endMs} onChange={(e) => updateWord(i, { endMs: Number(e.target.value) })} title="End (ms)" />
              {speakerMode ? (
                <Select value={w.speaker ?? SPEAKERS[0]} onValueChange={(value) => updateWord(i, { speaker: value })}>
                  <SelectTrigger className="h-10 w-full" aria-label="Speaker">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPEAKERS.map((speaker) => (
                      <SelectItem key={speaker} value={speaker}>
                        {speaker}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-500">
                  <User className="size-4" /> Speaker placeholder
                </div>
              )}
            </div>
          ))}
          {words.length === 0 && <p className="text-body-sm text-neutral-500">No caption words loaded yet.</p>}
        </div>
      )}
    </div>
  );
}
