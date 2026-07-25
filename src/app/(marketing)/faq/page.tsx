import type { Metadata } from "next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { FAQS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "FAQ — Elevatex AI",
  description: "Answers to common questions about Elevatex AI's video generation, credits, billing, and platform.",
};

// Expanded categorized FAQ, billing/credits/talking-head additions beyond
// the landing page's shorter teaser set (lib/constants.ts's FAQS, reused
// as-is for the "General" category rather than duplicating that copy).
const CATEGORIES: { title: string; faqs: { question: string; answer: string }[] }[] = [
  { title: "General", faqs: FAQS },
  {
    title: "Credits & billing",
    faqs: [
      {
        question: "What's the difference between a subscription and a credit package?",
        answer:
          "A subscription grants a fixed number of credits every month for a recurring price. A credit package is a one-time purchase of credits that don't expire on a monthly cycle. You can use either, or both.",
      },
      {
        question: "Do unused credits roll over?",
        answer:
          "Purchased and promotional credits don't expire monthly. Subscription credits are granted for that billing cycle and are drawn down before other credit types, per the Credit Engine's consumption order.",
      },
      {
        question: "Can I cancel my subscription anytime?",
        answer:
          "Yes — cancelling stops future renewals but keeps your current billing period's access and credits until it ends.",
      },
      {
        question: "Do you provide GST invoices?",
        answer: "Yes — every payment automatically generates a GST-ready invoice, downloadable from your Credits page.",
      },
    ],
  },
  {
    title: "Talking Head videos",
    faqs: [
      {
        question: "What is a Talking Head video?",
        answer:
          "Upload a video of yourself or a presenter speaking, and Elevatex AI automatically transcribes it, plans b-roll/captions/visuals, and assembles a polished marketing video around your footage.",
      },
      {
        question: "What video formats can I upload?",
        answer: "MP4, MOV, and WebM are supported. Very large files use a direct-to-storage upload so there's no practical size ceiling from our server.",
      },
    ],
  },
  {
    title: "Referrals & coupons",
    faqs: [
      {
        question: "How does the referral program work?",
        answer:
          "Share your referral code from the Credits page. When someone signs up with it, you both receive bonus credits — once per referred account.",
      },
      {
        question: "Where do I enter a coupon code?",
        answer:
          "Direct credit coupons redeem instantly from the Credits page. Percent/fixed-discount coupons are entered at checkout when buying a credit package.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-12 py-16 lg:py-24">
      <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
      {CATEGORIES.map((cat) => (
        <div key={cat.title}>
          <h2 className="text-heading-2 text-neutral-900">{cat.title}</h2>
          <Accordion type="single" collapsible className="mt-4">
            {cat.faqs.map((faq, i) => (
              <AccordionItem key={faq.question} value={`${cat.title}-${i}`}>
                <AccordionTrigger className="text-heading-3 text-neutral-900 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-body-md text-neutral-500">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </Container>
  );
}
