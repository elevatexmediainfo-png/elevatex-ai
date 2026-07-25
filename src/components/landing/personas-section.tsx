import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FadeIn } from "@/components/shared/fade-in";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PERSONAS } from "@/lib/constants";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function PersonasSection() {
  return (
    <section className="bg-brand-navy py-16 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow="Who it's for"
          tone="onDark"
          align="center"
          title={<span className="text-white">Built for businesses like yours</span>}
          description={
            <span className="text-white/70">
              Elevatex AI is designed around how Indian local businesses
              actually work — not around how marketing agencies wish they
              worked.
            </span>
          }
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PERSONAS.map((persona, i) => (
            <FadeIn key={persona.name} delay={i * 0.08}>
              <div className="flex h-full flex-col gap-4 rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-accent-orange text-white">
                      {initials(persona.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-label-md text-white">{persona.name}</p>
                    <p className="text-caption text-white/60">{persona.role}</p>
                  </div>
                </div>
                <p className="text-body-md text-white/80">{persona.goal}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  );
}
