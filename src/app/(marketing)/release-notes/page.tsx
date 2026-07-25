import type { Metadata } from "next";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";

export const metadata: Metadata = {
  title: "Release Notes — Elevatex AI",
  description: "What's shipped on Elevatex AI, milestone by milestone.",
};

// Product-facing summary of PROJECT_STATUS.md's milestone history — that
// file is the engineering record (dense, internal); this is the same
// timeline told in plain language for users. Update both when a milestone
// ships.
const RELEASES = [
  {
    title: "Production launch readiness",
    date: "29 June 2026",
    points: [
      "Referrals, coupon codes, and GST-ready invoices",
      "Usage dashboard and in-app notifications",
      "Stronger security: rate limiting, upload validation, abuse detection",
      "Public Help Center, FAQ, Pricing, and legal pages",
    ],
  },
  {
    title: "AI Talking Head Marketing Editor",
    date: "28 June 2026",
    points: [
      "Upload your own video and let AI plan captions, b-roll, and visuals around it",
      "Automatic transcription and scene segmentation",
      "Smart asset reuse to keep AI generation costs low",
    ],
  },
  {
    title: "Production AI integration & zero-code installation",
    date: "28 June 2026",
    points: [
      "Guided installation wizard — no manual config files",
      "Real AI providers configurable from the Admin Panel, with automatic failover",
      "Cost management dashboard for every AI request",
    ],
  },
  {
    title: "AI Video Editor",
    date: "28 June 2026",
    points: [
      "Full timeline editor: trim, split, merge, and reorder clips",
      "Captions, text overlays, and music tracks",
      "Export to multiple resolutions and codecs",
    ],
  },
  {
    title: "AI Content Studio",
    date: "28 June 2026",
    points: [
      "Hook and CTA variant generators",
      "Script rewrite, expand, shorten, and translate tools",
      "Scene-by-scene editing with version history",
    ],
  },
  {
    title: "Production Video Generation Pipeline",
    date: "27 June 2026",
    points: [
      "Parallel scene rendering with automatic merging",
      "Pause, resume, and re-render failed scenes",
      "Live render progress",
    ],
  },
  {
    title: "AI Generation Engine",
    date: "27 June 2026",
    points: ["Automatic provider failover and health tracking", "Per-provider retry and timeout policies"],
  },
  {
    title: "Payment loop closed",
    date: "27 June 2026",
    points: ["Credit packages and subscriptions", "Razorpay checkout integration"],
  },
  {
    title: "Provider abstraction, monetization & admin panel",
    date: "Earlier",
    points: ["Pluggable AI/payment/storage providers", "Admin-configurable pricing and credit rules"],
  },
  {
    title: "AI video generation core",
    date: "Earlier",
    points: ["Brief-to-script-to-video generation pipeline"],
  },
  {
    title: "Authentication",
    date: "Earlier",
    points: ["Phone + OTP sign-in, onboarding flow"],
  },
  {
    title: "Design system & landing page",
    date: "Earlier",
    points: ["Public landing page and core design system"],
  },
];

export default function ReleaseNotesPage() {
  return (
    <Container className="flex max-w-2xl flex-col gap-12 py-16 lg:py-24">
      <SectionHeading eyebrow="Release Notes" title="What's new" />
      <div className="flex flex-col gap-10">
        {RELEASES.map((release) => (
          <div key={release.title} className="border-l-2 border-brand-navy-light pl-6">
            <p className="text-body-sm text-neutral-500">{release.date}</p>
            <h2 className="mt-1 text-heading-2 text-neutral-900">{release.title}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {release.points.map((point) => (
                <li key={point} className="text-body-sm text-neutral-700">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Container>
  );
}
