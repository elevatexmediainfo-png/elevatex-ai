import { Hero } from "@/components/landing/hero";
import { ProblemSection } from "@/components/landing/problem-section";
import { PillarsSection } from "@/components/landing/pillars-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { VerticalsSection } from "@/components/landing/verticals-section";
import { FeatureHighlights } from "@/components/landing/feature-highlights";
import { PersonasSection } from "@/components/landing/personas-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <PillarsSection />
      <HowItWorks />
      <VerticalsSection />
      <FeatureHighlights />
      <PersonasSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
