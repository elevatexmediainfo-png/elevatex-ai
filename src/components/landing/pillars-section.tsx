import {
  Globe2,
  IndianRupee,
  Layers,
  Send,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FadeIn } from "@/components/shared/fade-in";
import { PILLARS } from "@/lib/constants";

const ICONS = [Zap, Globe2, Layers, IndianRupee, Send, ShieldCheck];

export function PillarsSection() {
  return (
    <section id="features" className="bg-neutral-50 py-16 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow="Why Elevatex AI"
          title="Everything you need to look like a Fortune 500 brand"
          description="Six commitments built into every video, every template, every plan."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const Icon = ICONS[i];
            return (
              <FadeIn key={pillar.title} delay={i * 0.05}>
                <div className="flex h-full flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-accent-orange-light text-accent-orange">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="text-heading-3 text-neutral-900">
                    {pillar.title}
                  </h3>
                  <p className="text-body-md text-neutral-500">
                    {pillar.description}
                  </p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
