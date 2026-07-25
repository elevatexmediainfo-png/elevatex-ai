"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Redo2, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Container } from "@/components/shared/container";
import { SCRIPT_TONES } from "@/lib/validations/video";
import { CONTENT_LANGUAGES } from "@/lib/validations/onboarding";
import { useUndoRedo } from "./use-undo-redo";
import { SceneEditor, type SceneView } from "./scene-editor";
import { AssetLibrary } from "./asset-library";
import { VersionHistory } from "./version-history";
import { useVideoProviders, VideoProviderSelect } from "@/components/video/video-provider-select";

export interface VoiceOption {
  id: string;
  label: string;
  gender: "MALE" | "FEMALE" | "NEUTRAL";
}

export interface MusicOption {
  id: string;
  label: string;
  url: string;
}

export interface ProjectView {
  id: string;
  title: string;
  status: string;
  generatedScript: string | null;
  contentLanguage: string;
  /** Real per-scene render cost (VIDEO_ACTION_CREDIT_COSTS.veo_lite.credits) — multiply by scene count for the honest total estimate; render itself charges this exact amount per scene, not a flat project fee. */
  perSceneCredits: number;
  templateName: string | null;
  templateDurationSeconds: number | null;
  thumbnailSceneId: string | null;
}

const TONE_LABELS: Record<(typeof SCRIPT_TONES)[number], string> = {
  FRIENDLY: "Friendly",
  PROFESSIONAL: "Professional",
  PLAYFUL: "Playful",
  URGENT: "Urgent",
  LUXURY: "Luxury",
  INSPIRATIONAL: "Inspirational",
  BOLD: "Bold",
};

const LANGUAGE_LABELS: Record<(typeof CONTENT_LANGUAGES)[number], string> = {
  EN: "English",
  HI: "Hindi",
  HINGLISH: "Hinglish",
};

const SAVE_DEBOUNCE_MS = 900;

export function StudioClient({
  initialProject,
  initialScenes,
  availableVoices,
  musicLibrary,
}: {
  initialProject: ProjectView;
  initialScenes: SceneView[];
  availableVoices: VoiceOption[];
  musicLibrary: MusicOption[];
}) {
  const router = useRouter();
  const [project, setProject] = React.useState(initialProject);
  const [scenes, setScenes] = React.useState(initialScenes);
  const [tab, setTab] = React.useState("script");
  const [rendering, setRendering] = React.useState(false);
  const { providers: videoProviders, selected: preferredProviderId, setSelected: setPreferredProviderId } =
    useVideoProviders(initialProject.perSceneCredits);

  const [script, setScript] = React.useState(initialProject.generatedScript ?? "");
  const [tone, setTone] = React.useState<(typeof SCRIPT_TONES)[number]>("FRIENDLY");
  const [targetLanguage, setTargetLanguage] = React.useState<(typeof CONTENT_LANGUAGES)[number]>("EN");
  const [transforming, setTransforming] = React.useState<string | null>(null);
  const [suggestion, setSuggestion] = React.useState<{ operation: string; text: string } | null>(null);
  const [variants, setVariants] = React.useState<{ kind: string; items: string[] } | null>(null);
  const [savingScript, setSavingScript] = React.useState(false);

  const scriptUndo = useUndoRedo();
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  async function persistScript(text: string) {
    setSavingScript(true);
    try {
      const res = await fetch(`/api/videos/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedScript: text }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't save the script.");
      }
    } catch {
      toast.error("Network error while saving the script.");
    } finally {
      setSavingScript(false);
    }
  }

  function handleScriptChange(next: string) {
    const previous = script;
    setScript(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      scriptUndo.push({ undo: () => applyScript(previous), redo: () => applyScript(next) });
      void persistScript(next);
    }, SAVE_DEBOUNCE_MS);
  }

  function applyScript(text: string) {
    setScript(text);
    void persistScript(text);
  }

  async function runTransform(operation: "rewrite" | "expand" | "shorten" | "translate") {
    setTransforming(operation);
    setSuggestion(null);
    try {
      const res = await fetch(`/api/videos/${project.id}/script/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          tone: operation === "rewrite" ? tone : undefined,
          targetLanguage: operation === "translate" ? targetLanguage : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't generate that variation.");
        return;
      }
      setSuggestion({ operation, text: json.data.text });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setTransforming(null);
    }
  }

  async function runVariants(kind: "hook" | "cta") {
    setTransforming(kind);
    setVariants(null);
    try {
      const res = await fetch(`/api/videos/${project.id}/script/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, count: 3 }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't generate variants.");
        return;
      }
      setVariants({ kind, items: json.data.variants });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setTransforming(null);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    const previous = script;
    const next = suggestion.text;
    scriptUndo.push({ undo: () => applyScript(previous), redo: () => applyScript(next) });
    applyScript(next);
    setSuggestion(null);
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  async function handleRender() {
    if (scenes.length === 0) {
      toast.error("Add at least one scene before rendering.");
      return;
    }
    setRendering(true);
    try {
      const res = await fetch(`/api/videos/${project.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredProviderId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't start rendering.");
        return;
      }
      router.push(`/videos/${project.id}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRendering(false);
    }
  }

  return (
    <Container as="main" className="flex flex-col py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label-sm text-neutral-500">{project.templateName ?? "Custom"}</p>
          <h1 className="text-heading-1 text-neutral-900">{project.title}</h1>
          <p className="mt-1 text-body-sm text-neutral-500">
            {scenes.length} scene{scenes.length === 1 ? "" : "s"} · ~{scenes.length * project.perSceneCredits} credit
            {scenes.length * project.perSceneCredits === 1 ? "" : "s"} to render ({project.perSceneCredits}/scene)
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <VideoProviderSelect providers={videoProviders} value={preferredProviderId} onChange={setPreferredProviderId} />
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={rendering || scenes.length === 0}
            onClick={handleRender}
          >
            {rendering && <Loader2 className="size-4 animate-spin" />}
            <Sparkles className="size-4" />
            Render video
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList variant="line">
          <TabsTrigger value="script">Script Studio</TabsTrigger>
          <TabsTrigger value="scenes">Scene Editor</TabsTrigger>
          <TabsTrigger value="assets">Asset Library</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="script" className="mt-6">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-label-md text-neutral-700">
                  Script {savingScript && <span className="text-neutral-400">· saving…</span>}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!scriptUndo.canUndo}
                    onClick={scriptUndo.undo}
                    title="Undo"
                  >
                    <Undo2 className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!scriptUndo.canRedo}
                    onClick={scriptUndo.redo}
                    title="Redo"
                  >
                    <Redo2 className="size-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={script}
                onChange={(e) => handleScriptChange(e.target.value)}
                rows={14}
                className="mt-2 font-mono text-body-sm"
                disabled={project.status !== "SCRIPT_READY"}
              />

              {suggestion && (
                <div className="mt-4 rounded-xl border border-brand-navy/30 bg-brand-navy-light p-4">
                  <p className="text-label-sm text-brand-navy">
                    {suggestion.operation.charAt(0).toUpperCase() + suggestion.operation.slice(1)} suggestion
                  </p>
                  <p className="mt-2 whitespace-pre-line text-body-sm text-neutral-700">{suggestion.text}</p>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="primary" size="sm" onClick={applySuggestion}>
                      Apply
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSuggestion(null)}>
                      Discard
                    </Button>
                  </div>
                </div>
              )}

              {variants && (
                <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="text-label-sm text-neutral-700">
                    {variants.kind === "hook" ? "Hook" : "CTA"} ideas
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {variants.items.map((v, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 px-3 py-2"
                      >
                        <span className="text-body-sm text-neutral-700">{v}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => copyToClipboard(v)}>
                          Copy
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="w-full shrink-0 lg:w-64">
              <p className="text-label-md text-neutral-700">Tools</p>
              <div className="mt-2 flex flex-col gap-2">
                <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                  <SelectTrigger className="h-10 w-full" aria-label="Tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCRIPT_TONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TONE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!transforming || project.status !== "SCRIPT_READY"}
                  onClick={() => runTransform("rewrite")}
                >
                  {transforming === "rewrite" && <Loader2 className="size-3.5 animate-spin" />}
                  Rewrite ({TONE_LABELS[tone]})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!transforming || project.status !== "SCRIPT_READY"}
                  onClick={() => runTransform("expand")}
                >
                  {transforming === "expand" && <Loader2 className="size-3.5 animate-spin" />}
                  Expand
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!transforming || project.status !== "SCRIPT_READY"}
                  onClick={() => runTransform("shorten")}
                >
                  {transforming === "shorten" && <Loader2 className="size-3.5 animate-spin" />}
                  Shorten
                </Button>

                <Select value={targetLanguage} onValueChange={(v) => setTargetLanguage(v as typeof targetLanguage)}>
                  <SelectTrigger className="h-10 w-full" aria-label="Translate to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {LANGUAGE_LABELS[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!transforming || project.status !== "SCRIPT_READY"}
                  onClick={() => runTransform("translate")}
                >
                  {transforming === "translate" && <Loader2 className="size-3.5 animate-spin" />}
                  Translate
                </Button>

                <div className="mt-2 h-px bg-neutral-100" />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!transforming || project.status !== "SCRIPT_READY"}
                  onClick={() => runVariants("hook")}
                >
                  {transforming === "hook" && <Loader2 className="size-3.5 animate-spin" />}
                  Hook generator
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!transforming || project.status !== "SCRIPT_READY"}
                  onClick={() => runVariants("cta")}
                >
                  {transforming === "cta" && <Loader2 className="size-3.5 animate-spin" />}
                  CTA generator
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scenes" className="mt-6">
          <SceneEditor
            videoProjectId={project.id}
            scenes={scenes}
            onScenesChange={setScenes}
            thumbnailSceneId={project.thumbnailSceneId}
            onThumbnailChange={(sceneId) => setProject((p) => ({ ...p, thumbnailSceneId: sceneId }))}
            availableVoices={availableVoices}
            musicLibrary={musicLibrary}
            editable={project.status === "DRAFT" || project.status === "SCRIPT_READY"}
          />
        </TabsContent>

        <TabsContent value="assets" className="mt-6">
          <AssetLibrary />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <VersionHistory
            videoProjectId={project.id}
            restorable={project.status === "DRAFT" || project.status === "SCRIPT_READY"}
            onRestored={(restored) => {
              setProject((p) => ({ ...p, generatedScript: restored.project.generatedScript }));
              setScript(restored.project.generatedScript ?? "");
              setScenes(restored.scenes);
            }}
          />
        </TabsContent>
      </Tabs>
    </Container>
  );
}
