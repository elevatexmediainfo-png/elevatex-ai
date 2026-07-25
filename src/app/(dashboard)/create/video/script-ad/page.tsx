"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles, Video } from "lucide-react";

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
import { VIDEO_OBJECTIVES, VISIBLE_OBJECTIVES } from "@/lib/validations/video";

const OBJECTIVE_LABELS: Record<(typeof VIDEO_OBJECTIVES)[number], string> = {
  PROMOTION: "Promotion",
  NEW_LAUNCH: "New Launch",
  FESTIVAL_GREETING: "Festival Greeting",
  TESTIMONIAL: "Testimonial",
  ANNOUNCEMENT: "Announcement",
  OFFER_DISCOUNT: "Offer / Discount",
  BRAND_AWARENESS: "Brand Awareness",
};

// VISIBLE_OBJECTIVES now lives in lib/validations/video.ts, shared with
// create/talking-head/page.tsx — see that constant's own doc comment for
// why (a locally-defined copy here once diverged from a second, unfiltered
// copy there).

// Milestone 8: the wizard's job ends at script generation — script
// review/edit, scene editing, and render confirmation all moved into the
// Studio (/videos/[id]/studio), which owns that part of the lifecycle now.
// AI Video reconciliation Step 1 — "Template" was dropped as a user-facing
// step: every seeded template had identical platform/aspectRatio/duration/
// creditCost, the only real difference was vertical + script tone, and
// vertical already lives on the user's own Profile from onboarding. The
// server resolves the right Template itself now (see
// resolveTemplateForProject() in app/api/videos/route.ts) — the user never
// picks one.
// 4-option restructure Step 1 (2026-07-11): moved here verbatim from
// app/(dashboard)/create/page.tsx, which is now the 4-card selector — this
// component's own logic is completely unchanged, only its route moved, so
// every existing behavior (script generation, scene-split, credits) keeps
// working exactly as before.
// 4-option restructure Step 3 (2026-07-12): moved AGAIN, this time from
// /create/video itself to /create/video/script-ad — Quick Video (the new
// 5-question single-clip form) took over the bare /create/video route.
// Logic here is still completely unchanged; only the path moved, and every
// caller that used to deep-link straight into this wizard (Dashboard Quick
// Actions, the Templates gallery, the hero idea box) was repointed to this
// new path since they're all multi-scene-ad intents, not single-clip ones.
const STEPS = ["Details", "Brief"] as const;

export default function CreateVideoPage() {
  return (
    <React.Suspense fallback={null}>
      <CreateVideoForm />
    </React.Suspense>
  );
}

// Milestone 14 — every Dashboard Quick Action that launches the Video
// pipeline (Instagram Reel, YouTube Shorts, Festival Post, Product Ad,
// Restaurant Promo, Real Estate Video, Blog To Video) routes here with a
// query param instead of its own page, since they all just pre-fill this
// same wizard differently.
function CreateVideoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const objectiveParam = searchParams.get("objective");
  const isBlogMode = searchParams.get("mode") === "blog";
  // Dashboard hero's prompt box — typed idea text carries through as a
  // pre-filled key message instead of being silently dropped when the user
  // picks the Video quick action.
  const ideaParam = searchParams.get("idea");

  const [step, setStep] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [objective, setObjective] = React.useState<(typeof VIDEO_OBJECTIVES)[number]>(
    // Validated against VISIBLE_OBJECTIVES, not the full list — a stale
    // ?objective=FESTIVAL_GREETING deep link (the Dashboard's "Festival
    // Post" quick action and the /templates gallery's Festival Greetings
    // card both still produce one) would otherwise set a value with no
    // matching option in the dropdown. Falls back to Promotion instead,
    // same as no param at all.
    (VISIBLE_OBJECTIVES as readonly string[]).includes(objectiveParam ?? "")
      ? (objectiveParam as (typeof VIDEO_OBJECTIVES)[number])
      : "PROMOTION"
  );
  const [contentLanguage, setContentLanguage] = React.useState<"EN" | "HI" | "HINGLISH">("EN");

  const [productOrService, setProductOrService] = React.useState("");
  const [keyMessage, setKeyMessage] = React.useState(ideaParam ?? "");
  const [offerDetails, setOfferDetails] = React.useState("");
  const [callToAction, setCallToAction] = React.useState("");

  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleGenerateScript() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `${OBJECTIVE_LABELS[objective]} video`,
          objective,
          contentLanguage,
          brief: { productOrService, keyMessage, offerDetails, callToAction },
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Couldn't generate a script. Please try again.");
        return;
      }
      router.push(`/videos/${json.data.project.id}/studio`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Container className="flex max-w-2xl flex-col py-10">
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full",
                i <= step ? "bg-accent-orange" : "bg-neutral-200"
              )}
            />
            <span className="text-label-sm text-neutral-500">{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-error-light px-3 py-2 text-body-sm text-error">
          {error}
        </div>
      )}

      {step === 0 && (
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-heading-1 text-neutral-900">Tell us about your video</h1>
              <p className="mt-2 text-body-md text-neutral-500">
                We&apos;ll match the script style to your business automatically.
              </p>
            </div>
            <Link
              href="/create/talking-head"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-label-sm text-neutral-700 hover:border-brand-navy/40"
            >
              <Video className="size-3.5" />
              Upload a video instead
            </Link>
          </div>

          <div className="mt-8 grid gap-5">
            <div>
              <label className="mb-1.5 block text-label-md text-neutral-700">Video title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Diwali Sweets Promo"
                className="h-11 text-body-md"
              />
            </div>

            <div>
              <label id="objective-label" className="mb-1.5 block text-label-md text-neutral-700">
                Objective
              </label>
              <Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}>
                {/* Explicit aria-label, not just the visible <label>: the
                    trigger's value span uses line-clamp + flex, which trips
                    screen-reader text-visibility detection in some ATs. */}
                <SelectTrigger
                  className="h-11 w-full"
                  aria-label="Objective"
                  aria-labelledby="objective-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBLE_OBJECTIVES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {OBJECTIVE_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-label-md text-neutral-700">Script language</p>
              <div className="inline-flex rounded-full border border-neutral-300 p-1">
                {(["EN", "HI", "HINGLISH"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setContentLanguage(lang)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-label-sm",
                      contentLanguage === lang ? "bg-brand-navy text-white" : "text-neutral-500"
                    )}
                  >
                    {lang === "EN" ? "English" : lang === "HI" ? "हिंदी" : "Hinglish"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="mt-10 w-full"
            onClick={() => setStep(1)}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h1 className="text-heading-1 text-neutral-900">Add your brief</h1>
          <p className="mt-2 text-body-md text-neutral-500">
            The AI script writer uses this brief — be specific for a better script.
          </p>

          {isBlogMode && (
            <div className="mt-4 rounded-lg bg-info-light px-3 py-2 text-body-sm text-info">
              Paste your blog post or article content into &quot;Key message&quot; below — the script
              writer will turn it into a video script.
            </div>
          )}

          <div className="mt-8 flex flex-col gap-5">
            <div>
              <label className="mb-1.5 block text-label-md text-neutral-700">
                Product / service
              </label>
              <Input
                value={productOrService}
                onChange={(e) => setProductOrService(e.target.value)}
                placeholder="Kaju Katli gift box"
                className="h-11 text-body-md"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md text-neutral-700">Key message</label>
              <Textarea
                value={keyMessage}
                onChange={(e) => setKeyMessage(e.target.value)}
                placeholder={isBlogMode ? "Paste your blog content here…" : "Handmade with pure ghee, fresh this week only"}
                rows={isBlogMode ? 8 : 3}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md text-neutral-700">
                Offer details <span className="text-neutral-500">(optional)</span>
              </label>
              <Input
                value={offerDetails}
                onChange={(e) => setOfferDetails(e.target.value)}
                placeholder="20% off on orders above ₹999"
                className="h-11 text-body-md"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md text-neutral-700">
                Call to action <span className="text-neutral-500">(optional)</span>
              </label>
              <Input
                value={callToAction}
                onChange={(e) => setCallToAction(e.target.value)}
                placeholder="Order now on WhatsApp"
                className="h-11 text-body-md"
              />
            </div>
          </div>

          <div className="mt-10 flex gap-3">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={!productOrService.trim() || !keyMessage.trim() || generating}
              onClick={handleGenerateScript}
            >
              {generating && <Loader2 className="size-4 animate-spin" />}
              <Sparkles className="size-4" />
              Generate script
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}
