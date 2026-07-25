"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import { FILM_STYLES, ASPECT_RATIOS } from "@/lib/validations/video";

const STYLE_LABELS: Record<(typeof FILM_STYLES)[number], string> = {
  CINEMATIC: "Cinematic",
  DOCUMENTARY: "Documentary",
  ANIMATED: "Animated",
  COMMERCIAL: "Commercial",
  VINTAGE: "Vintage",
  MINIMALIST: "Minimalist",
};

const ASPECT_RATIO_LABELS: Record<(typeof ASPECT_RATIOS)[number], string> = {
  RATIO_9_16: "9:16 (Vertical)",
  RATIO_1_1: "1:1 (Square)",
  RATIO_16_9: "16:9 (Widescreen)",
};

// Narrowed from the original 60-300s (1-5 min) range to 10/20s (2026-07-24)
// — the app-level MAX_VIDEO_GENERATION_TOTAL_SECONDS hard cap
// (lib/video-generation-limits.ts) now applies to FILM's total stitched
// output too, confirmed with the founder (not just a single vendor call).
const DURATION_OPTIONS = [
  { seconds: 10, label: "10 sec" },
  { seconds: 20, label: "20 sec" },
] as const;

const MAX_CHARACTERS = 6;

// AI Film's Input screen (2026-07-12 generation-free build). The founder's
// own first listed screen: idea/duration/character-count/style/aspect-ratio
// -> "Generate Film". Fully real — no generation happens here, this only
// creates the VideoProject (sourceType FILM) + its FilmCharacter slots via
// POST /api/videos/film, then hands off to the Film flow hub, which decides
// which of the later screens (character selection, sheet, storyboard,
// scenes, merge) to show next based on what's actually in the database.
export default function CreateFilmPage() {
  const router = useRouter();

  const [title, setTitle] = React.useState("");
  const [idea, setIdea] = React.useState("");
  // Default 10s, not 20 (2026-07-25) — matches the Meta-ad direction's own
  // "~10 second target as the default" recommendation; still user-changeable
  // to 20 via the picker below.
  const [durationSeconds, setDurationSeconds] = React.useState<number>(10);
  const [characterCount, setCharacterCount] = React.useState(2);
  const [style, setStyle] = React.useState<(typeof FILM_STYLES)[number]>("CINEMATIC");
  const [aspectRatio, setAspectRatio] = React.useState<(typeof ASPECT_RATIOS)[number]>("RATIO_9_16");
  const [creating, setCreating] = React.useState(false);

  async function handleGenerate() {
    if (!idea.trim()) {
      toast.error("Describe your film idea first.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/videos/film", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || idea.trim().slice(0, 60),
          idea: idea.trim(),
          durationSeconds,
          characterCount,
          style,
          aspectRatio,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't start your film.");
        return;
      }
      router.push(`/videos/${json.data.project.id}/film`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Container className="flex max-w-2xl flex-col py-10">
      <h1 className="text-heading-1 text-neutral-900">AI Film</h1>
      <p className="mt-2 text-body-md text-neutral-500">
        Describe your film — the AI builds characters, a storyboard, and a per-scene video that
        keeps them consistent throughout.
      </p>

      <div className="mt-8 flex flex-col gap-5">
        <div>
          <label className="mb-1.5 block text-label-md text-neutral-700">Film title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled film"
            className="h-11 text-body-md"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-label-md text-neutral-700">Your idea</label>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="A street food vendor in Mumbai builds his cart into a beloved local landmark…"
            rows={4}
            className="text-body-md"
          />
        </div>

        <div>
          <p className="mb-2 text-label-md text-neutral-700">Duration</p>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.seconds}
                type="button"
                onClick={() => setDurationSeconds(opt.seconds)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-label-sm",
                  durationSeconds === opt.seconds
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-neutral-300 text-neutral-600"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-label-md text-neutral-700">Number of characters</p>
          <div className="inline-flex items-center gap-4 rounded-full border border-neutral-300 px-4 py-2">
            <button
              type="button"
              onClick={() => setCharacterCount((c) => Math.max(1, c - 1))}
              className="text-heading-3 text-neutral-500"
              aria-label="Decrease character count"
            >
              −
            </button>
            <span className="w-6 text-center text-body-md text-neutral-900">{characterCount}</span>
            <button
              type="button"
              onClick={() => setCharacterCount((c) => Math.min(MAX_CHARACTERS, c + 1))}
              className="text-heading-3 text-neutral-500"
              aria-label="Increase character count"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label id="film-style-label" className="mb-1.5 block text-label-md text-neutral-700">
            Style
          </label>
          <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
            <SelectTrigger className="h-11 w-full" aria-label="Style" aria-labelledby="film-style-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILM_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STYLE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label id="film-aspect-label" className="mb-1.5 block text-label-md text-neutral-700">
            Aspect ratio
          </label>
          <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}>
            <SelectTrigger className="h-11 w-full" aria-label="Aspect ratio" aria-labelledby="film-aspect-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ASPECT_RATIO_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="mt-10"
        disabled={!idea.trim() || creating}
        onClick={handleGenerate}
      >
        {creating && <Loader2 className="size-4 animate-spin" />}
        <Sparkles className="size-4" />
        Generate Film
      </Button>
    </Container>
  );
}
