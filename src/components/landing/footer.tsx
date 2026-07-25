import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Container } from "@/components/shared/container";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "@/components/shared/platform-icons";

const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Verticals", href: "/#verticals" },
    { label: "Pricing", href: "/pricing" },
    { label: "FAQ", href: "/faq" },
  ],
  Support: [
    { label: "Help Center", href: "/help" },
    { label: "Contact", href: "/contact" },
    { label: "Release Notes", href: "/release-notes" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white py-12">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-brand-navy text-white">
                <Sparkles className="size-4" />
              </span>
              <span className="text-heading-3 text-brand-navy">
                Elevatex AI
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-body-sm text-neutral-500">
              The AI-powered video marketing platform built for Indian local
              businesses — vernacular, affordable, and fast.
            </p>
            <div className="mt-6 flex items-center gap-3 text-neutral-400">
              <InstagramIcon className="size-5 hover:text-platform-instagram" />
              <FacebookIcon className="size-5 hover:text-platform-facebook" />
              <YoutubeIcon className="size-5 hover:text-platform-youtube" />
              <WhatsappIcon className="size-5 hover:text-platform-whatsapp" />
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              {/* h3, not h4 — the page has no h3-then-h4 nesting anywhere
                  else, so h4 here was a heading-level skip (axe: heading-order). */}
              <h3 className="text-label-md text-neutral-900">{heading}</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-body-sm text-neutral-500 hover:text-brand-navy"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 text-body-sm text-neutral-500 md:flex-row">
          <p>&copy; 2026 Elevatex AI. Made for Indian businesses.</p>
          <p>DPDP Act 2023 compliant &middot; Data hosted in India</p>
        </div>
      </Container>
    </footer>
  );
}
