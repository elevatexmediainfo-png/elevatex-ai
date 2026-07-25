"use client";

import * as React from "react";
import { Bold, Italic, Sparkles, Underline } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEditorStoreApi } from "./store";
import { useCaptionPresetsQuery, useEditorAssetsQuery, useEditorFontsQuery } from "./queries";
import { customFontFamily } from "./custom-font-faces";
import { createUpdateContentCommand, type ClipCommandDeps } from "./commands";
import { DEFAULT_REVEAL_CONFIG, type RevealMode, type RevealStyle, type RichTextRun } from "@/lib/video-editor/text-style";
import type { ClipContent, ClipView } from "../types";

// Module 7 — Text/Subtitle style editor. A NEW clip-kind-conditional group
// in the Right Properties Panel (previously the panel only ever edited
// ClipTransform, never `content` — see the panel's own file header). Every
// field here edits `clip.content` as one whole-object
// createUpdateContentCommand, exactly like Module 4's transform fields do
// for `clip.transform` — commit-on-blur/change, no rAF live-preview
// plumbing (text style edits aren't a drag-heavy interaction the way
// sliders are, so the added complexity wasn't worth it here).
export function TextGroup({
  // Unused since the 2026-07-13 fix that removed a leaked-into-the-UI dev
  // note referencing this prop (see the comment further down where it used
  // to render). Kept in the signature rather than touched at every call
  // site for a debug-string cleanup — prefixed to suppress the unused-var
  // warning, not removed.
  projectId: _projectId,
  clip,
  isSubtitle,
  commandDeps,
}: {
  projectId: string;
  clip: ClipView;
  isSubtitle: boolean;
  commandDeps: ClipCommandDeps;
}) {
  const storeApi = useEditorStoreApi();
  const fontsQuery = useEditorFontsQuery();
  const captionPresetsQuery = useCaptionPresetsQuery();
  const assetsQuery = useEditorAssetsQuery();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const content = clip.content ?? {};
  const text = content.text ?? "";
  const reveal = content.reveal ?? DEFAULT_REVEAL_CONFIG;

  // Controlled, with a local edit buffer synced from `text` only while NOT
  // focused. A plain `defaultValue` (uncontrolled) textarea never reflects
  // a content change that didn't originate from typing into THIS field —
  // e.g. undo/redo reverting the text, or (in principle) a future preset
  // that touches text — since React only applies defaultValue once at
  // mount. Resyncing only when unfocused avoids fighting an in-progress
  // edit or clobbering the cursor position mid-type.
  const [localText, setLocalText] = React.useState(text);
  const [textareaFocused, setTextareaFocused] = React.useState(false);
  React.useEffect(() => {
    if (!textareaFocused) setLocalText(text);
  }, [text, textareaFocused]);

  // Fixed live during Module 8's verification, which hit the exact race
  // this file's earlier version only documented as a known limitation:
  // spreading `{...clip.content, ...patch}` off PROPS is stale for a
  // SECOND commit fired before React re-renders with the FIRST commit's
  // confirmed result — awaiting the mutation fully (invalidate + refetch)
  // still isn't enough, since there's a further, separate gap between
  // "the query cache updated" and "this component actually re-rendered
  // with the new prop." A ref updated SYNCHRONOUSLY at commit time closes
  // that gap: the next commit, however soon it fires, always merges
  // against the latest locally-known state instead of a stale snapshot.
  const contentRef = React.useRef<ClipContent>(content);
  React.useEffect(() => {
    contentRef.current = clip.content ?? {};
  }, [clip.content]);

  function commit(patch: Partial<ClipContent>) {
    const previous = contentRef.current;
    const next: ClipContent = { ...previous, ...patch };
    contentRef.current = next;
    void storeApi
      .getState()
      .runCommand(createUpdateContentCommand(commandDeps, clip.id, previous, next))
      .catch(() => {
        contentRef.current = previous;
      });
  }

  // CAPTION_STYLE_PRESETS predates Module 7's `reveal` shape — its
  // "karaoke_yellow" preset only carries a flat `highlightColor`, which
  // anticipated exactly this feature but not its final nested shape. A
  // preset with `highlightColor` is translated into KARAOKE reveal mode
  // rather than spread as a dead top-level field.
  function applyCaptionPreset(style: Record<string, unknown>) {
    const { highlightColor, ...rest } = style;
    const patch: Partial<ClipContent> = { ...(rest as Partial<ClipContent>) };
    if (typeof highlightColor === "string") {
      patch.reveal = { ...(contentRef.current.reveal ?? DEFAULT_REVEAL_CONFIG), mode: "KARAOKE", highlightColor };
    }
    commit(patch);
  }

  function toggleRunFormatting(field: "bold" | "italic" | "underline") {
    const el = textareaRef.current;
    if (!el || el.selectionStart === el.selectionEnd) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const existing = contentRef.current.richRuns ?? [];
    // If a run already covers exactly this range, toggle it off; otherwise
    // add a new run for the selection with this field set — a lightweight
    // approach (no merge/split of overlapping runs beyond this), matching
    // "doesn't need a full document model" from the brief.
    const already = existing.find((r) => r.start === start && r.end === end && r[field]);
    const nextRuns: RichTextRun[] = already
      ? existing.map((r) => (r === already ? { ...r, [field]: false } : r))
      : [...existing, { start, end, [field]: true }];
    commit({ richRuns: nextRuns });
  }

  // Custom Brand Kit fonts aren't part of the /fonts listing (that's the
  // Google/fallback catalog) — appended here so they show in the same
  // picker without conflating "public font catalog" with "this user's
  // uploaded assets" server-side.
  const customFonts = (assetsQuery.data ?? [])
    .filter((a) => a.kind === "FONT" && a.status === "READY")
    .map((a) => ({ id: a.id, label: a.originalFilename, family: customFontFamily(a.id) }));
  const allFonts = [...(fontsQuery.data?.fonts ?? []), ...customFonts];

  return (
    <section className="space-y-3">
      <h3 className="border-b border-editor-line pb-1 text-label-sm text-neutral-300">{isSubtitle ? "Subtitle" : "Text"}</h3>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-caption text-neutral-400">Content</span>
          <div className="flex gap-0.5">
            <Button type="button" variant="ghost" size="icon-sm" title="Bold selection" onClick={() => toggleRunFormatting("bold")}>
              <Bold className="size-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title="Italic selection" onClick={() => toggleRunFormatting("italic")}>
              <Italic className="size-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title="Underline selection" onClick={() => toggleRunFormatting("underline")}>
              <Underline className="size-3.5" />
            </Button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={localText}
          key={clip.id}
          rows={3}
          className="w-full resize-none rounded border border-editor-line bg-editor-surface-1 px-2 py-1.5 text-caption text-neutral-100"
          onChange={(e) => setLocalText(e.target.value)}
          onFocus={() => setTextareaFocused(true)}
          // Guarded on an actual change — blur fires on every click of the
          // adjacent Bold/Italic/Underline buttons too (focus leaving the
          // textarea), and an unconditional commit here would race that
          // click's own richRuns commit: whichever PATCH the server
          // processes last wins a full-object write, so an unchanged-text
          // blur-commit can silently wipe a run just added a moment ago.
          onBlur={(e) => {
            setTextareaFocused(false);
            if (e.target.value !== text) commit({ text: e.target.value });
          }}
          placeholder="Select text, then Bold/Italic/Underline to format a range."
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-caption">
          <span className="text-neutral-400">Font</span>
          <select
            className="w-full rounded border border-editor-line bg-editor-surface-1 px-1.5 py-1 text-neutral-100"
            value={content.fontFamily ?? ""}
            onChange={(e) => commit({ fontFamily: e.target.value })}
          >
            <option value="">Default</option>
            {allFonts.map((f) => (
              <option key={f.id} value={f.family}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="Size" value={content.fontSize ?? 24} min={8} max={200} onCommit={(v) => commit({ fontSize: v })} />
        <NumberField label="Weight" value={content.fontWeight ?? 400} min={100} max={900} step={100} onCommit={(v) => commit({ fontWeight: v })} />
        <ColorField label="Color" value={content.color ?? "#ffffff"} onCommit={(v) => commit({ color: v })} />
        <NumberField label="Letter spacing" value={content.letterSpacing ?? 0} min={-10} max={50} onCommit={(v) => commit({ letterSpacing: v })} />
        <NumberField label="Line height" value={content.lineHeight ?? 1.3} min={0.5} max={3} step={0.1} onCommit={(v) => commit({ lineHeight: v })} />
      </div>

      <GradientFields content={content} onCommit={commit} />

      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label="Stroke"
          value={content.strokeColor ?? ""}
          allowEmpty
          onCommit={(v) => commit({ strokeColor: v || undefined })}
        />
        <NumberField label="Stroke width" value={content.strokeWidth ?? 1} min={0} max={20} onCommit={(v) => commit({ strokeWidth: v })} />
        <ColorField label="Shadow" value={content.shadowColor ?? ""} allowEmpty onCommit={(v) => commit({ shadowColor: v || undefined })} />
        <NumberField label="Shadow blur" value={content.shadowBlur ?? 4} min={0} max={50} onCommit={(v) => commit({ shadowBlur: v })} />
        <NumberField label="Shadow X" value={content.shadowOffsetX ?? 2} min={-50} max={50} onCommit={(v) => commit({ shadowOffsetX: v })} />
        <NumberField label="Shadow Y" value={content.shadowOffsetY ?? 2} min={-50} max={50} onCommit={(v) => commit({ shadowOffsetY: v })} />
        <ColorField label="Glow" value={content.glowColor ?? ""} allowEmpty onCommit={(v) => commit({ glowColor: v || undefined })} />
        <NumberField label="Glow intensity" value={content.glowIntensity ?? 2} min={0} max={10} onCommit={(v) => commit({ glowIntensity: v })} />
      </div>

      <RevealFields
        reveal={reveal}
        onCommit={(patch) => commit({ reveal: { ...reveal, ...patch } })}
      />

      {isSubtitle && (
        <div className="space-y-2 border-t border-editor-line pt-2">
          <SpeakerField
            key={clip.id}
            value={content.speaker ?? ""}
            onCommit={(v) => commit({ speaker: v || undefined })}
          />
          <label className="flex items-center gap-2 text-caption text-neutral-400">
            <input
              type="checkbox"
              checked={content.showSpeakerInOutput ?? false}
              onChange={(e) => commit({ showSpeakerInOutput: e.target.checked })}
            />
            Show speaker name in rendered output
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-neutral-300 hover:text-white">
                <Sparkles className="size-3.5" />
                Apply Caption Template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {(captionPresetsQuery.data ?? []).map((preset) => (
                <DropdownMenuItem key={preset.id} onClick={() => applyCaptionPreset(preset.style)}>
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Fix (2026-07-13) — this was a dev note that leaked into the
          rendered UI verbatim, literally printing the raw projectId value
          as visible text; found live while screenshotting the new Text
          tab. Kept as a real (now non-rendered) comment: enter/exit
          animations reuse the Motion Engine's Apply Animation Preset menu
          in the Transform tab, not a separate control here. */}
    </section>
  );
}

function GradientFields({ content, onCommit }: { content: ClipContent; onCommit: (patch: Partial<ClipContent>) => void }) {
  const enabled = (content.gradientColors?.length ?? 0) >= 2;
  const colors = content.gradientColors ?? ["#f97316", "#facc15"];

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-caption text-neutral-400">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onCommit({ gradientColors: e.target.checked ? colors : undefined })}
        />
        Gradient fill
      </label>
      {enabled && (
        <div className="flex items-center gap-2">
          {colors.map((c, i) => (
            <input
              key={i}
              type="color"
              aria-label={`Gradient color stop ${i + 1}`}
              value={c}
              onChange={(e) => {
                const next = [...colors];
                next[i] = e.target.value;
                onCommit({ gradientColors: next });
              }}
              className="size-7 rounded border border-editor-line bg-transparent"
            />
          ))}
          <Button type="button" variant="ghost" size="icon-sm" title="Add color stop" onClick={() => onCommit({ gradientColors: [...colors, "#ffffff"] })}>
            +
          </Button>
          <NumberField label="Angle" value={content.gradientAngleDeg ?? 90} min={0} max={360} onCommit={(v) => onCommit({ gradientAngleDeg: v })} compact />
        </div>
      )}
    </div>
  );
}

function RevealFields({
  reveal,
  onCommit,
}: {
  reveal: { mode: RevealMode; unitDurationMs: number; style: RevealStyle; highlightColor: string };
  onCommit: (patch: Partial<typeof reveal>) => void;
}) {
  return (
    <div className="space-y-1.5 border-t border-editor-line pt-2">
      <p className="text-caption text-neutral-400">Reveal animation</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-caption">
          <span className="text-neutral-500">Mode</span>
          <select
            className="w-full rounded border border-editor-line bg-editor-surface-1 px-1.5 py-1 text-neutral-100"
            value={reveal.mode}
            onChange={(e) => onCommit({ mode: e.target.value as RevealMode })}
          >
            <option value="NONE">None</option>
            <option value="WORD">Word by word</option>
            <option value="CHARACTER">Character by character</option>
            <option value="KARAOKE">Karaoke highlight</option>
          </select>
        </label>
        {reveal.mode !== "NONE" && (
          <NumberField
            label={reveal.mode === "CHARACTER" ? "ms / char" : "ms / word"}
            value={reveal.unitDurationMs}
            min={20}
            max={2000}
            onCommit={(v) => onCommit({ unitDurationMs: v })}
          />
        )}
      </div>
      {reveal.mode === "WORD" || reveal.mode === "CHARACTER" ? (
        <label className="space-y-1 text-caption">
          <span className="text-neutral-500">Style</span>
          <select
            className="w-full rounded border border-editor-line bg-editor-surface-1 px-1.5 py-1 text-neutral-100"
            value={reveal.style}
            onChange={(e) => onCommit({ style: e.target.value as RevealStyle })}
          >
            <option value="FADE">Fade in</option>
            <option value="POP">Pop in</option>
          </select>
        </label>
      ) : null}
      {reveal.mode === "KARAOKE" && (
        <ColorField label="Highlight color" value={reveal.highlightColor} onCommit={(v) => onCommit({ highlightColor: v })} />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  compact,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  compact?: boolean;
  onCommit: (v: number) => void;
}) {
  // Controlled, with a local edit buffer synced from `value` only while
  // NOT focused — a plain `defaultValue` (uncontrolled) input never
  // reflects a content change that didn't originate from typing into THIS
  // field (e.g. applying a caption template, or undo/redo), since React
  // only applies defaultValue once at mount. Resyncing only when unfocused
  // avoids fighting the user's own in-progress edit.
  const [local, setLocal] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    if (!focused) setLocal(String(value));
  }, [value, focused]);

  return (
    <label className={compact ? "flex items-center gap-1.5 text-caption" : "space-y-1 text-caption"}>
      <span className="text-neutral-400">{label}</span>
      <input
        type="number"
        value={local}
        min={min}
        max={max}
        step={step}
        className={compact ? "w-16 rounded border border-editor-line bg-editor-surface-1 px-1.5 py-1 text-neutral-100" : "w-full rounded border border-editor-line bg-editor-surface-1 px-1.5 py-1 text-neutral-100"}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onCommit(Math.min(max, Math.max(min, v)));
        }}
      />
    </label>
  );
}

// Same controlled-with-resync-when-unfocused pattern as NumberField/the
// content textarea above — a plain `defaultValue` never reflects a speaker
// name change that came from outside this field (undo/redo, a future
// preset).
function SpeakerField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = React.useState(value);
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    if (!focused) setLocal(value);
  }, [value, focused]);

  return (
    <label className="space-y-1 text-caption">
      <span className="text-neutral-400">Speaker</span>
      <input
        type="text"
        value={local}
        className="w-full rounded border border-editor-line bg-editor-surface-1 px-2 py-1 text-neutral-100"
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          onCommit(e.target.value);
        }}
        placeholder="e.g. Interviewer"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  allowEmpty,
  onCommit,
}: {
  label: string;
  value: string;
  allowEmpty?: boolean;
  onCommit: (v: string) => void;
}) {
  return (
    <label className="space-y-1 text-caption">
      <span className="text-neutral-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onCommit(e.target.value)}
          className="size-7 shrink-0 rounded border border-editor-line bg-transparent"
        />
        {allowEmpty && value && (
          <button type="button" className="text-nano text-neutral-500 hover:text-white" onClick={() => onCommit("")}>
            Clear
          </button>
        )}
      </div>
    </label>
  );
}
