import type { Metadata } from "next";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact — Elevatex AI",
  description: "Get in touch with the Elevatex AI team.",
};

export default function ContactPage() {
  return (
    <Container className="flex max-w-xl flex-col gap-8 py-16 lg:py-24">
      <SectionHeading eyebrow="Contact" title="Get in touch" description="Questions, feedback, or partnership inquiries — we read every message." />
      <ContactForm />
    </Container>
  );
}
