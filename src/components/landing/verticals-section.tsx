import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FadeIn } from "@/components/shared/fade-in";
import { VERTICALS } from "@/lib/constants";

export function VerticalsSection() {
  return (
    <section id="verticals" className="bg-neutral-50 py-16 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow="Built for your industry"
          title="Templates tuned for 10 high-demand verticals"
          description="Each vertical has its own vocabulary, aesthetic, and AI-tuned templates — not a generic one-size-fits-all editor."
        />

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {VERTICALS.map((vertical, i) => (
            <FadeIn key={vertical.name} delay={i * 0.03}>
              <div className="flex h-full flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md">
                <span
                  className="flex size-11 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(${vertical.colorVar}) 14%, white)`,
                    color: `var(${vertical.colorVar})`,
                  }}
                >
                  <vertical.icon className="size-5" />
                </span>
                <span className="text-label-md text-neutral-900">
                  {vertical.name}
                </span>
                <span className="text-caption text-neutral-500">
                  {vertical.businesses} businesses in India
                </span>
              </div>
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  );
}
