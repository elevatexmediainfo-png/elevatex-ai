import { FileText, Palette, Send } from "lucide-react";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FadeIn } from "@/components/shared/fade-in";

const STEPS = [
  {
    icon: FileText,
    title: "Pick an objective & template",
    description:
      "Choose what the video is for — a festival offer, a new menu, a service promo — and pick from 500+ industry-tuned templates.",
  },
  {
    icon: Palette,
    title: "AI writes it, your brand wears it",
    description:
      "Your script, voice-over, and hashtags are generated in Hindi or English, and your logo, colours, and fonts are applied automatically.",
  },
  {
    icon: Send,
    title: "Render & publish everywhere",
    description:
      "Get a render-ready video in under 3 minutes, then publish straight to WhatsApp, Instagram, YouTube, Facebook, or Google Business.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From idea to published video in three steps"
        />

        <div className="relative mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <FadeIn key={step.title} delay={i * 0.1}>
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative flex size-16 items-center justify-center rounded-full bg-brand-navy text-white">
                  <step.icon className="size-6" />
                  <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-accent-orange text-label-sm text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-heading-3 text-neutral-900">
                  {step.title}
                </h3>
                <p className="max-w-xs text-body-md text-neutral-500">
                  {step.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  );
}
