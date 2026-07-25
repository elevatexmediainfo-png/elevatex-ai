"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Download, Megaphone, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RotatingLoadingText } from "@/components/creative/rotating-loading-text";
import { formatDate } from "@/lib/format";

export interface PosterOption {
  id: string;
  /** The Asset id — what generateAnimatedPosterVideo() actually needs, not the CreativeProject id. */
  posterAssetId: string;
  title: string;
  createdAt: string;
  url: string;
}

interface GenerateResult {
  assetId: string;
  videoUrl: string;
  creditsCharged: number;
}

const GENERATE_MESSAGES = [
  "Bringing your poster to life…",
  "Applying the zoom motion…",
  "Rendering the final video…",
  "Almost there…",
];

type Step = "picking" | "generating" | "result";

// 4-option restructure Step 3 — the actual click-to-select interaction
// that didn't exist anywhere in the app (marketing-creatives/page.tsx's own
// grid is display-only). Card visual/grid classes are the same ones
// reused from that page; only the interaction (button + selection state)
// and the generate/result flow are new.
export function AnimatedPosterPicker({ posters }: { posters: PosterOption[] }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<Step>("picking");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<GenerateResult | null>(null);

  const selected = posters.find((p) => p.id === selectedId) ?? null;

  async function handleAnimate() {
    if (!selected) return;
    setStep("generating");
    setError(null);
    try {
      const res = await fetch("/api/videos/animated-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posterAssetId: selected.posterAssetId }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Couldn't animate this poster. Please try again.");
        setStep("picking");
        return;
      }
      setResult(json.data);
      setStep("result");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStep("picking");
    }
  }

  function reset() {
    setSelectedId(null);
    setResult(null);
    setError(null);
    setStep("picking");
  }

  if (step === "generating") {
    return <RotatingLoadingText messages={GENERATE_MESSAGES} estimatedSeconds={110} />;
  }

  if (step === "result" && result) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-6 text-center">
        <h1 className="text-heading-1 text-neutral-900">Your video is ready</h1>
        <video
          controls
          src={result.videoUrl}
          className="w-full max-w-xs rounded-xl border border-neutral-200 bg-black"
        />
        <p className="text-body-sm text-neutral-500">{result.creditsCharged} credit(s) charged.</p>
        <div className="flex gap-3">
          <Button asChild variant="primary" size="default">
            <a href={result.videoUrl} download>
              <Download className="size-4" /> Download
            </a>
          </Button>
          <Button variant="outline" size="default" onClick={reset}>
            Animate another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-heading-1 text-neutral-900">Animated Poster Video</h1>
        <p className="mt-2 text-body-md text-neutral-500">
          Pick one of your posters — it&apos;ll be animated with a gentle zoom, 2 credits.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-error-light px-3 py-2 text-body-sm text-error">{error}</div>
      )}

      {posters.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <Megaphone className="size-8 text-neutral-300" />
          <p className="text-body-md text-neutral-500">You haven&apos;t generated any posters yet.</p>
          <Button asChild variant="primary" size="default" className="mt-2">
            <Link href="/create/marketing">Create your first one</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {posters.map((p) => {
              const isSelected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`overflow-hidden rounded-xl border bg-white text-left transition-colors ${
                    isSelected ? "border-brand-navy ring-2 ring-brand-navy" : "border-neutral-200 hover:border-brand-navy/40"
                  }`}
                >
                  <div className="relative flex aspect-square items-center justify-center bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.title} className="size-full object-cover" />
                    {isSelected && (
                      <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-brand-navy text-white">
                        <Check className="size-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-label-md text-neutral-900">{p.title}</p>
                    <p className="mt-1 text-body-sm text-neutral-500">{formatDate(new Date(p.createdAt))}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-body-sm text-neutral-500">
              {selected ? `Selected: ${selected.title}` : "Select a poster above to continue"}
            </p>
            <Button variant="primary" size="default" disabled={!selected} onClick={handleAnimate}>
              <Sparkles className="size-4" /> Animate (2 credits)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
