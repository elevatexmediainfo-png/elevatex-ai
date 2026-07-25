import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { FadeIn } from "@/components/shared/fade-in";

export function CtaSection() {
  return (
    <section className="py-16 lg:py-24">
      <Container>
        <FadeIn>
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-brand-navy px-6 py-16 text-center">
            <h2 className="max-w-xl text-display-2 text-white">
              Your next video is 5 minutes away
            </h2>
            <p className="max-w-md text-body-lg text-white/70">
              Join thousands of Indian businesses creating professional
              videos without an agency, a designer, or a single rupee upfront.
            </p>
            <Button variant="primary" size="lg" asChild>
              <Link href="/login">
                Start Free Today
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}
