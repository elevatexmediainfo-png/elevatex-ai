"use client";

import * as React from "react";
import { Check, FileUp, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEditor, type ClipContent } from "./editor-types";

const TEXT_ANIMATIONS = ["NONE", "FADE_IN", "SLIDE_UP", "POP", "TYPEWRITER", "FLY_IN", "BOUNCE", "SPIN"] as const;
const FONT_WEIGHTS = ["normal", "bold", "bolder", "lighter", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;
const FONT_STYLES = ["normal", "italic", "oblique"] as const;
const TEXT_DECORATIONS = ["none", "underline", "line-through", "underline line-through"] as const;
const TEXT_ALIGNMENTS = ["left", "center", "right"] as const;
const SAVE_DEBOUNCE_MS = 600;

// Text Editor — rich typography, gradients, glow/stroke/shadow, animation,
// font search, brand-font support and upload placeholder. The content is
// still persisted through the shared Timeline clip PATCH route.
export function TextEditorPanel() {
  const { tracks, clips, selectedClipId, setSelectedClipId, playheadMs, addTrack, addClip, updateClip, fonts, textPresets } = useEditor();

  const textTracks = tracks.filter((t) => t.kind === "TEXT");
  const selectedClip = clips.find((c) => c.id === selectedClipId);
  const editingTextClip = selectedClip && textTracks.some((t) => t.id === selectedClip.trackId) ? selectedClip : null;

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = React.useState<ClipContent>(editingTextClip?.content ?? {});
  const [fontQuery, setFontQuery] = React.useState("");
  const [uploadedFontName, setUploadedFontName] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(editingTextClip?.content ?? {});
    setUploadedFontName(null);
    setFontQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTextClip?.id]);

  function patch(next: Partial<ClipContent>, immediate = false) {
    if (!editingTextClip) return;
    const merged = { ...draft, ...next };
    setDraft(merged);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) {
      void updateClip(editingTextClip.id, { content: merged });
    } else {
      timer.current = setTimeout(() => void updateClip(editingTextClip.id, { content: merged }), SAVE_DEBOUNCE_MS);
    }
  }

  async function handleAddTextLayer() {
    if (textTracks.length === 0) await addTrack("TEXT");
  }

  async function handleAddTextClip() {
    const track = textTracks[0] ?? (await addTrack("TEXT"));
    const trackId = track?.id;
    if (!trackId) return;
    const clip = await addClip({
      trackId,
      startMs: Math.round(playheadMs / 100) * 100,
      durationMs: 3000,
      content: {
        text: "New text",
        fontFamily: fonts[0]?.id ?? "inter",
        fontSize: 36,
        fontWeight: "700",
        color: "#FFFFFF",
        strokeColor: "#000000",
        strokeWidth: 2,
        shadowColor: "#000000",
        shadowBlur: 12,
        animation: "POP",
        textAlign: "center",
      },
    });
    if (clip) setSelectedClipId(clip.id);
  }

  const brandFonts = fonts.filter((font) => font.label.toLowerCase().includes("brand") || font.id.toLowerCase().includes("brand"));
  const fontOptions = fonts.filter((font) => font.label.toLowerCase().includes(fontQuery.toLowerCase()) || font.family.toLowerCase().includes(fontQuery.toLowerCase()));

  if (!editingTextClip) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-label-md text-neutral-700">Text Editor</p>
        <p className="text-body-sm text-neutral-500">Select a text clip on the Timeline to edit it, or add a new one.</p>
        {textTracks.length === 0 && (
          <Button type="button" variant="outline" size="sm" onClick={handleAddTextLayer}>
            <Plus className="size-4" /> Add text layer
          </Button>
        )}
        <Button type="button" variant="primary" size="sm" onClick={handleAddTextClip}>
          <Plus className="size-4" /> Add text clip at playhead
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-md text-neutral-700">Text Editor</p>
          <p className="text-body-sm text-neutral-500">Rich typography controls for the selected text clip.</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-slate-50 px-3 py-2 text-xs text-neutral-600">
          1000+ fonts supported by config
        </div>
      </div>

      <Field label="Text">
        <Textarea rows={3} value={draft.text ?? ""} onChange={(e) => patch({ text: e.target.value })} />
      </Field>

      <div className="grid gap-3">
        <Field label="Font">
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Search fonts"
              value={fontQuery}
              onChange={(e) => setFontQuery(e.target.value)}
              className="h-10"
            />
            <Select value={draft.fontFamily ?? fonts[0]?.id ?? "inter"} onValueChange={(v) => patch({ fontFamily: v }, true)}>
              <SelectTrigger className="h-10 w-full" aria-label="Font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {brandFonts.length > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <p className="text-label-sm text-neutral-700">Brand fonts</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {brandFonts.map((font) => (
                    <Button
                      key={font.id}
                      type="button"
                      variant={draft.fontFamily === font.id ? "secondary" : "outline"}
                      size="chip"
                      onClick={() => patch({ fontFamily: font.id }, true)}
                    >
                      {font.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Field>

        <Field label="Upload font">
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-500 transition hover:border-neutral-400">
              <span>{uploadedFontName ?? "Upload TTF/OTF/WOFF"}</span>
              <FileUp className="size-4 text-neutral-600" />
              <input
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadedFontName(file.name);
                  patch({ fontFamily: file.name }, true);
                }}
              />
            </label>
            <p className="text-body-sm text-neutral-500">Uploaded fonts are available as placeholders in the editor until backend font hosting is enabled.</p>
          </div>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Size">
          <Input type="number" min={8} max={200} value={draft.fontSize ?? 36} onChange={(e) => patch({ fontSize: Number(e.target.value) })} />
        </Field>
        <Field label="Weight">
          <Select value={draft.fontWeight ?? "700"} onValueChange={(v) => patch({ fontWeight: v }, true)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((weight) => (
                <SelectItem key={weight} value={weight}>
                  {weight}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Style">
          <Select value={draft.fontStyle ?? "normal"} onValueChange={(v) => patch({ fontStyle: v }, true)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_STYLES.map((style) => (
                <SelectItem key={style} value={style}>
                  {style}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Decoration">
          <Select value={draft.textDecoration ?? "none"} onValueChange={(v) => patch({ textDecoration: v }, true)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_DECORATIONS.map((decoration) => (
                <SelectItem key={decoration} value={decoration}>
                  {decoration}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Align">
          <Select value={draft.textAlign ?? "center"} onValueChange={(v) => patch({ textAlign: v as ClipContent["textAlign"] }, true)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_ALIGNMENTS.map((align) => (
                <SelectItem key={align} value={align}>
                  {align}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Line height">
          <Input type="number" min={0.5} max={3} step={0.1} value={draft.lineHeight ?? 1.2} onChange={(e) => patch({ lineHeight: Number(e.target.value) })} />
        </Field>
        <Field label="Letter spacing">
          <Input type="number" min={-5} max={20} value={draft.letterSpacing ?? 0} onChange={(e) => patch({ letterSpacing: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-label-sm text-neutral-700">Gradient & glow</p>
            <p className="text-body-sm text-neutral-500">Create layered text styles that stand out on any scene.</p>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-xs text-neutral-600">
            Visual effect
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 mt-4">
          <Field label="Gradient start">
            <Input type="color" value={draft.gradientStartColor ?? "#ffffff"} onChange={(e) => patch({ gradientStartColor: e.target.value }, true)} />
          </Field>
          <Field label="Gradient end">
            <Input type="color" value={draft.gradientEndColor ?? "#FF5E7D"} onChange={(e) => patch({ gradientEndColor: e.target.value }, true)} />
          </Field>
          <Field label="Angle">
            <Input type="number" min={0} max={360} value={draft.gradientAngle ?? 90} onChange={(e) => patch({ gradientAngle: Number(e.target.value) })} />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-3 mt-3">
          <Field label="Glow color">
            <Input type="color" value={draft.glowColor ?? "#FFFFFF"} onChange={(e) => patch({ glowColor: e.target.value }, true)} />
          </Field>
          <Field label="Glow spread">
            <Input type="number" min={0} max={50} value={draft.glowSpread ?? 12} onChange={(e) => patch({ glowSpread: Number(e.target.value) })} />
          </Field>
          <Field label="Glow intensity">
            <Input type="number" min={0} max={100} value={draft.glowIntensity ?? 50} onChange={(e) => patch({ glowIntensity: Number(e.target.value) })} />
          </Field>
        </div>
      </div>

      <Field label="Background color">
        <Input type="color" value={draft.backgroundColor ?? "#000000"} onChange={(e) => patch({ backgroundColor: e.target.value }, true)} />
      </Field>

      <Field label="Animation">
        <Select value={draft.animation ?? "POP"} onValueChange={(v) => patch({ animation: v }, true)}>
          <SelectTrigger className="h-10 w-full" aria-label="Text animation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_ANIMATIONS.map((animation) => (
              <SelectItem key={animation} value={animation}>
                {animation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {textPresets.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-label-sm text-neutral-700">Text templates</p>
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-neutral-600">
              <Check className="size-3" /> presets
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {textPresets.map((preset) => (
              <Button key={preset.id} type="button" variant="chip" size="chip" onClick={() => patch(preset.style as ClipContent, true)}>
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-label-sm text-neutral-700">Style summary</p>
            <p className="text-body-sm text-neutral-500">Your changes are automatically saved to the selected clip.</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Sparkles className="size-4" /> Live edit
          </div>
        </div>
      </div>
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
