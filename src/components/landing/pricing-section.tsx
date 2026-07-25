import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FadeIn } from "@/components/shared/fade-in";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/constants";

export function PricingSection() {
  return (
    <section id="pricing" className="py-16 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="Plans built for Indian MSME cash flow"
          description="Start free. Upgrade only when you need more credits, no watermark, or team seats."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.05}>
              <div
                className={cn(
                  "flex h-full flex-col gap-6 rounded-2xl border p-6",
                  plan.featured
                    ? "border-accent-orange bg-white shadow-xl"
                    : "border-neutral-200 bg-white shadow-sm"
                )}
              >
                {/* Same small-text contrast fix as SectionHeading's eyebrow label. */}
                {plan.featured && (
                  <span className="self-start rounded-full bg-accent-orange-light px-2.5 py-1 text-label-sm text-[#c2410c]">
                    Most popular
                  </span>
                )}
                <div>
                  <h3 className="text-heading-2 text-neutral-900">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-body-sm text-neutral-500">
                    {plan.tagline}
                  </p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-display-2 text-neutral-900">
                    {plan.price}
                  </span>
                  {plan.cadence && (
                    <span className="text-body-sm text-neutral-500">
                      {plan.cadence}
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-body-sm text-neutral-700"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.featured ? "primary" : "outline"}
                  className="mt-auto w-full"
                  asChild
                >
                  <Link href="/login">{plan.cta}</Link>
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  );
}
