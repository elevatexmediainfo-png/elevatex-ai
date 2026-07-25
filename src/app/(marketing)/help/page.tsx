import type { Metadata } from "next";
import { Rocket, Mic, Wallet, Scissors } from "lucide-react";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = {
  title: "Help Center — Elevatex AI",
  description: "Guides for getting started, Talking Head videos, credits & billing, and the AI Video Editor.",
};

const CATEGORIES = [
  {
    title: "Getting started",
    icon: Rocket,
    articles: [
      {
        title: "Create your first video",
        body: "From Create, choose a template, fill in your brief (objective, key message, call to action), and the AI writes your script. Review and confirm to start rendering.",
      },
      {
        title: "Understanding credits",
        body: "Most AI actions (generation, exports) cost credits. Every account starts with a free signup bonus, and you can buy more from the Credits page.",
      },
      {
        title: "Choosing a platform & aspect ratio",
        body: "Pick the platform you're publishing to (Instagram, YouTube Shorts, WhatsApp, etc.) when creating a project — this sets the correct aspect ratio automatically.",
      },
    ],
  },
  {
    title: "Talking Head videos",
    icon: Mic,
    articles: [
      {
        title: "Upload a Talking Head video",
        body: "Start a Talking Head project by uploading a video of yourself or a presenter speaking. We automatically transcribe it and plan captions, b-roll, and visuals around it.",
      },
      {
        title: "Editing the automatic plan",
        body: "After processing, review the suggested scenes in the Studio — you can override visual types, replace clips, and regenerate captions before rendering.",
      },
    ],
  },
  {
    title: "Credits & billing",
    icon: Wallet,
    articles: [
      {
        title: "Buying credits vs. subscribing",
        body: "Credit packages are one-time purchases with no expiry. Subscriptions grant a recurring monthly credit allowance for a fixed price — pick whichever matches your usage.",
      },
      {
        title: "Downloading your invoices",
        body: "Every payment generates a GST-ready invoice automatically, available for download from the Credits page.",
      },
      {
        title: "Referrals and coupons",
        body: "Share your referral code to earn bonus credits when a friend signs up. Coupon codes can be redeemed or applied at checkout from the Credits page.",
      },
    ],
  },
  {
    title: "AI Video Editor",
    icon: Scissors,
    articles: [
      {
        title: "Using the Timeline",
        body: "The Timeline shows every track (video, audio, captions, music, text) for your project. Drag clips to reposition, split, or trim them.",
      },
      {
        title: "Exporting your final video",
        body: "Use Export to render a final file at your chosen resolution and codec, with or without a watermark depending on your plan.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <Container className="flex max-w-4xl flex-col gap-12 py-16 lg:py-24">
      <SectionHeading eyebrow="Help Center" title="How can we help?" description="Guides for every part of Elevatex AI." />
      <div className="grid gap-10 sm:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <div key={cat.title}>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-navy-light text-brand-navy">
                <cat.icon className="size-4" />
              </span>
              <h2 className="text-heading-2 text-neutral-900">{cat.title}</h2>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {cat.articles.map((article) => (
                <div key={article.title}>
                  <h3 className="text-label-md text-neutral-900">{article.title}</h3>
                  <p className="mt-1 text-body-sm text-neutral-500">{article.body}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-body-sm text-neutral-500">
        Can&rsquo;t find what you need? <a href="/contact" className="text-brand-navy underline">Contact us</a>.
      </p>
    </Container>
  );
}
