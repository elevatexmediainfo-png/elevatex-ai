import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FadeIn } from "@/components/shared/fade-in";
import { PROBLEM_STATS } from "@/lib/constants";

export function ProblemSection() {
  return (
    <section className="py-16 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow="The problem"
          title="Indian local businesses are locked out of quality video marketing"
          description="A professional video shoot costs more than most small businesses spend on marketing in a month — and takes a week to deliver."
        />

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {PROBLEM_STATS.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.05}>
              <div className="flex h-full flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
                <span className="text-display-2 text-brand-navy">
                  {stat.value}
                </span>
                <span className="text-body-sm text-neutral-500">
                  {stat.label}
                </span>
              </div>
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  );
}
