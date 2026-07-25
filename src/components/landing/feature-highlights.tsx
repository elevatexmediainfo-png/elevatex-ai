import { Mic2, Palette, UploadCloud, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FadeIn } from "@/components/shared/fade-in";
import {
  FacebookIcon,
  GoogleBusinessIcon,
  InstagramIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "@/components/shared/platform-icons";

const FEATURES = [
  {
    icon: Wand2,
    title: "AI script generation",
    description:
      "A scene-by-scene script in Hindi, English, or Hinglish — tuned to your vertical, city, and the current festival season.",
  },
  {
    icon: Palette,
    title: "Brand kit, applied automatically",
    description:
      "Upload your logo once. Every template auto-applies your logo, colours, and fonts across every scene.",
  },
  {
    icon: Mic2,
    title: "20+ AI voices",
    description:
      "10 Hindi and 10 English Indian-accent voices, with adjustable speed and a custom voice-over upload option.",
  },
  {
    icon: UploadCloud,
    title: "Publish in one click",
    description:
      "Schedule and publish straight to WhatsApp, Instagram, YouTube Shorts, Facebook, and Google Business Profile.",
  },
];

export function FeatureHighlights() {
  return (
    <section className="py-16 lg:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <FadeIn>
          <div className="flex flex-col gap-8">
            <SectionHeading
              align="left"
              eyebrow="What's inside"
              title="Built like a creative team, priced like a tool"
            />
            <div className="flex flex-col gap-6">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy-light text-brand-navy">
                    <feature.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-heading-3 text-neutral-900">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-body-md text-neutral-500">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-heading-3 text-neutral-900">
                Publish to
              </span>
              <Badge variant="success" dot>
                Connected
              </Badge>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3">
              {[
                { name: "Instagram", Icon: InstagramIcon, color: "var(--color-platform-instagram)" },
                { name: "WhatsApp", Icon: WhatsappIcon, color: "var(--color-platform-whatsapp)" },
                { name: "YouTube Shorts", Icon: YoutubeIcon, color: "var(--color-platform-youtube)" },
                { name: "Facebook", Icon: FacebookIcon, color: "var(--color-platform-facebook)" },
                { name: "Google Business", Icon: GoogleBusinessIcon, color: "var(--color-platform-google)" },
              ].map((platform) => (
                <div
                  key={platform.name}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3"
                >
                  <platform.Icon
                    className="size-5"
                    style={{ color: platform.color }}
                  />
                  <span className="text-body-md text-neutral-700">
                    {platform.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}
