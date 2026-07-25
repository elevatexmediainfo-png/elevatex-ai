import Link from "next/link";
import { ArrowRight, Clock3, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { FadeIn } from "@/components/shared/fade-in";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-navy-light">
      <Container className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <FadeIn>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-white px-3 py-1.5 text-label-sm text-brand-navy">
            <Sparkles className="size-3.5 text-accent-orange" />
            Built for Indian local businesses
          </span>

          <h1 className="mt-6 text-display-1 text-neutral-900">
            Professional marketing videos,{" "}
            {/* Milestone 12 — a real Lighthouse pass measured
                accent-orange-dark at 2.86:1 against brand-navy-light here,
                short of the 3:1 large-text minimum (the old comment's ~3:1
                estimate didn't hold up against this exact background). Using
                the same deeper shade SectionHeading's onLight eyebrow
                already uses (~5.2:1 measured against a near-white bg). */}
            <span className="text-[#c2410c]">in under 5 minutes</span>
          </h1>

          {/* neutral-700, not neutral-500: this section's bg-brand-navy-light
              tint pushes neutral-500 just under the 4.5:1 contrast minimum. */}
          <p className="mt-5 max-w-lg text-body-lg text-neutral-700">
            Elevatex AI writes your script, applies your brand, and renders a
            publish-ready video in Hindi or English — no design skill, no
            agency, no waiting days.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" asChild>
              <Link href="/login">
                Start Free — No Card Required
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>

          <p className="mt-3 text-body-sm text-neutral-700">
            हिंदी में भी उपलब्ध — Abhi free mein shuru karein.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-body-sm text-neutral-700">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" />
              Trusted by 15,000+ Indian businesses
            </span>
            <span className="flex items-center gap-2">
              <Clock3 className="size-4 text-success" />
              Render-ready in under 3 minutes
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-3xl border-8 border-white bg-brand-navy shadow-2xl">
            <div className="flex h-full flex-col justify-between p-5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-label-sm text-white">
                  Diwali Offer
                </span>
                <span className="size-8 rounded-full bg-white/15" />
              </div>
              <div>
                <p className="text-display-2 text-white">
                  20% off this Diwali
                </p>
                <p className="mt-2 text-body-md text-white/80">
                  Spice Garden Restaurant — Indore
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/10 p-3">
                <span className="text-label-md text-white">Book Now</span>
                <ArrowRight className="size-4 text-white" />
              </div>
            </div>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}
