"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RotatingLoadingText } from "@/components/creative/rotating-loading-text";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import { ASPECT_RATIOS, SCRIPT_TONES } from "@/lib/validations/video";
import { useVideoProviders, VideoProviderSelect, fallbackNoticeText } from "@/components/video/video-provider-select";

const QUICK_VIDEO_BASE_CREDITS = 20; // VIDEO_ACTION_CREDIT_COSTS.veo_lite's current default — the selector shows each real provider's actual resolved cost, this is only the pre-fetch placeholder shown before the live list loads.

const ASPECT_RATIO_LABELS: Record<(typeof ASPECT_RATIOS)[number], string> = {
  RATIO_9_16: "9:16",
  RATIO_1_1: "1:1",
  RATIO_16_9: "16:9",
};

const MOOD_LABELS: Record<(typeof SCRIPT_TONES)[number], string> = {
  FRIENDLY: "Friendly",
  PROFESSIONAL: "Professional",
  PLAYFUL: "Playful",
  URGENT: "Urgent",
  LUXURY: "Luxury",
  INSPIRATIONAL: "Inspirational",
  BOLD: "Bold",
};

const GENERATE_MESSAGES = [
  "Reading your idea…",
  "Framing the shot…",
  "Rendering the video…",
  "Almost there…",
];

interface QuickVideoAnswers {
  about: string;
  see: string;
  speechEnabled: boolean;
  spokenLine: string;
  mood: (typeof SCRIPT_TONES)[number] | null;
  avoid: string;
  aspectRatio: (typeof ASPECT_RATIOS)[number];
}

const EMPTY_ANSWERS: QuickVideoAnswers = {
  about: "",
  see: "",
  speechEnabled: false,
  spokenLine: "",
  mood: null,
  avoid: "",
  aspectRatio: "RATIO_9_16",
};

interface GenerateResult {
  assetId: string;
  videoUrl: string;
  creditsCharged: number;
  isMockFallback: boolean;
  providerId: string;
  requestedProviderId?: string;
  narrationSkippedReason: string | null;
}

type Step = "form" | "generating" | "result";

// 4-option restructure Step 3 (2026-07-12) — Quick Video: the 5-question,
// generation-free-to-build, single-clip redesign of /create/video. Replaces
// the old Details→Brief multi-scene wizard at this exact route — that
// wizard (unchanged) moved to /create/video/script-ad, still reachable via
// the link at the bottom of this form and from every Dashboard Quick
// Action/Templates-gallery deep link (all multi-scene-ad intents, repointed
// there rather than here). No duration question: generateVeoLiteVideo()
// always produces a fixed 8-second clip, so asking would be a dead control.
export default function QuickVideoPage() {
  const [step, setStep] = React.useState<Step>("form");
  const [answers, setAnswers] = React.useState<QuickVideoAnswers>(EMPTY_ANSWERS);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<GenerateResult | null>(null);
  const { providers, selected: preferredProviderId, setSelected: setPreferredProviderId, selectedCredits } =
    useVideoProviders(QUICK_VIDEO_BASE_CREDITS);

  async function submit(a: QuickVideoAnswers) {
    setStep("generating");
    setError(null);
    try {
      const res = await fetch("/api/videos/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          about: a.about,
          see: a.see,
          speechEnabled: a.speechEnabled,
          spokenLine: a.spokenLine,
          mood: a.mood ?? undefined,
          avoid: a.avoid,
          aspectRatio: a.aspectRatio,
          preferredProviderId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Couldn't generate your video. Please try again.");
        setStep("form");
        return;
      }
      setResult({ ...json.data, requestedProviderId: preferredProviderId });
      setStep("result");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStep("form");
    }
  }

  function startOver() {
    setAnswers(EMPTY_ANSWERS);
    setResult(null);
    setError(null);
    setStep("form");
  }

  if (step === "generating") {
    return <RotatingLoadingText messages={GENERATE_MESSAGES} estimatedSeconds={45} />;
  }

  if (step === "result" && result) {
    return (
      <Container className="flex max-w-md flex-col items-center gap-5 py-10 text-center">
        <h1 className="text-heading-1 text-neutral-900">Your video is ready</h1>
        <video
          controls
          autoPlay
          loop
          src={result.videoUrl}
          className="w-full max-w-xs rounded-xl border border-neutral-200 bg-black"
        />
        <p className="text-body-sm text-neutral-500">
          {result.isMockFallback ? "Placeholder preview — no credits charged." : `${result.creditsCharged} credit(s) charged.`}
        </p>
        {(() => {
          const notice = fallbackNoticeText(result.requestedProviderId, result.providerId, providers);
          return notice ? <p className="text-body-sm text-amber-600">{notice}</p> : null;
        })()}
        {result.narrationSkippedReason && (
          <p className="text-body-sm text-amber-600">
            Generated without narration — no voice provider was reachable. Music and visuals are still real.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary" size="default">
            <a href={result.videoUrl} download>
              <Download className="size-4" /> Download
            </a>
          </Button>
          <Button variant="outline" size="default" onClick={() => submit(answers)}>
            <Sparkles className="size-4" /> Regenerate
          </Button>
          <Button variant="ghost" size="default" onClick={startOver}>
            Start over
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="flex max-w-2xl flex-col py-10">
      <h1 className="text-heading-1 text-neutral-900">Quick Video</h1>
      <p className="mt-2 text-body-md text-neutral-500">
        Describe your idea — get a ready 8-second AI video, with a real spoken voiceover when you add one below.
      </p>

      {error && (
        <div className="mt-6 rounded-lg bg-error-light px-3 py-2 text-body-sm text-error">{error}</div>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <div>
          <label className="mb-1.5 block text-label-md text-neutral-700">
            What&apos;s the video about? <span className="text-error">*</span>
          </label>
          <Textarea
            value={answers.about}
            onChange={(e) => setAnswers((a) => ({ ...a, about: e.target.value }))}
            placeholder="A fresh box of handmade Kaju Katli being packed for Diwali"
            rows={3}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-label-md text-neutral-700">
            What should we see? <span className="text-neutral-500">(optional)</span>
          </label>
          <Textarea
            value={answers.see}
            onChange={(e) => setAnswers((a) => ({ ...a, see: e.target.value }))}
            placeholder="Close-up of the sweets, gift box being tied with a ribbon"
            rows={2}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-label-md text-neutral-700">Should someone speak?</label>
            <Switch
              checked={answers.speechEnabled}
              onCheckedChange={(checked) => setAnswers((a) => ({ ...a, speechEnabled: checked }))}
            />
          </div>
          {answers.speechEnabled && (
            <Input
              value={answers.spokenLine}
              onChange={(e) => setAnswers((a) => ({ ...a, spokenLine: e.target.value }))}
              placeholder="Fresh sweets, made with pure ghee — order now on WhatsApp"
              className="mt-3 h-11 text-body-md"
            />
          )}
        </div>

        <div>
          <p className="mb-2 text-label-md text-neutral-700">
            Mood <span className="text-neutral-500">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {SCRIPT_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, mood: a.mood === tone ? null : tone }))}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-label-sm transition-colors",
                  answers.mood === tone
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-brand-navy/40"
                )}
              >
                {MOOD_LABELS[tone]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-label-md text-neutral-700">
            Anything to avoid? <span className="text-neutral-500">(optional)</span>
          </label>
          <Input
            value={answers.avoid}
            onChange={(e) => setAnswers((a) => ({ ...a, avoid: e.target.value }))}
            placeholder="No confetti, no crowded background"
            className="h-11 text-body-md"
          />
        </div>

        <div>
          <p className="mb-2 text-label-md text-neutral-700">Aspect ratio</p>
          <div className="inline-flex rounded-full border border-neutral-300 p-1">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAnswers((a) => ({ ...a, aspectRatio: ratio }))}
                className={cn(
                  "rounded-full px-4 py-1.5 text-label-sm",
                  answers.aspectRatio === ratio ? "bg-brand-navy text-white" : "text-neutral-500"
                )}
              >
                {ASPECT_RATIO_LABELS[ratio]}
              </button>
            ))}
          </div>
        </div>

        <VideoProviderSelect providers={providers} value={preferredProviderId} onChange={setPreferredProviderId} />
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="mt-10 w-full"
        disabled={!answers.about.trim()}
        onClick={() => submit(answers)}
      >
        <Sparkles className="size-4" />
        Generate video ({selectedCredits} credit{selectedCredits === 1 ? "" : "s"})
      </Button>

      <Link
        href="/create/video/script-ad"
        className="mt-4 text-center text-body-sm text-neutral-500 underline-offset-2 hover:text-brand-navy hover:underline"
      >
        Need a longer, multi-scene scripted ad?
      </Link>
    </Container>
  );
}
