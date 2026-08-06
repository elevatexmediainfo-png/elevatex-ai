import type { Metadata } from "next";

import { LegalPage } from "@/components/shared/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Elevatex AI",
  description: "How Elevatex AI collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="29 June 2026">
      <p>
        Elevatex AI (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides an AI-powered video creation platform. This policy
        explains what data we collect, why, and how you can control it. It applies to elevatex.ai and the Elevatex AI
        dashboard.
      </p>

      <div className="flex flex-col gap-3">
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> name, email address (used for sign-in and password login), and
            business profile details you provide during onboarding (business name, city, vertical).
          </li>
          <li>
            <strong>Content you create or upload:</strong> video briefs, scripts, uploaded videos/images/audio (e.g.
            Talking Head footage), brand assets, and the videos our AI generates for you.
          </li>
          <li>
            <strong>Billing information:</strong> credit purchases, subscription status, and invoices. Payment card
            details are handled entirely by our payment provider (Razorpay) — we never store your card or bank
            details.
          </li>
          <li>
            <strong>Usage data:</strong> pages visited, features used, and error logs, used to operate and improve
            the product.
          </li>
          <li>
            <strong>Cookies:</strong> see our <a href="/cookies">Cookie Policy</a> for details.
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2>How we use your information</h2>
        <ul>
          <li>To operate the video generation pipeline (script writing, scene rendering, transcription, editing).</li>
          <li>To process payments, grant credits, and generate GST invoices.</li>
          <li>To send transactional notifications (render complete, billing receipts) and, if you opt in, product updates.</li>
          <li>To detect and prevent abuse, fraud, and security incidents.</li>
          <li>To improve our AI prompts and platform reliability.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2>AI processing of your content</h2>
        <p>
          Your briefs, scripts, and uploaded media are sent to the AI providers (language, image, voice, and video
          generation, and transcription) configured for your account to produce your videos. We do not use your
          business content to train third-party foundation models without your explicit, revocable consent.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Where your data is stored</h2>
        <p>
          Account and application data is stored in our primary database. Media assets (uploads and generated
          videos) are stored in object storage (Amazon S3, Cloudflare R2, or an equivalent provider, as configured by
          us).
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Data sharing</h2>
        <p>
          We share data only with the service providers necessary to run the platform: AI generation providers, our
          payment processor (Razorpay), our storage provider, and our transactional email provider. We do not sell
          your personal data.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Your rights (DPDP Act, 2023)</h2>
        <p>
          Under India&rsquo;s Digital Personal Data Protection Act, 2023, you have the right to access, correct, and
          request deletion of your personal data, and to withdraw consent for optional processing. To exercise these
          rights, contact us via our <a href="/contact">Contact page</a>.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Data retention</h2>
        <p>
          We retain your account and content data for as long as your account is active, and for a reasonable period
          after closure to comply with legal/tax obligations (e.g. invoice records) and resolve disputes.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Security</h2>
        <p>
          We use industry-standard measures including encrypted credential storage, rate limiting, audit logging,
          and access controls to protect your data. No system is perfectly secure, and we encourage you to keep your
          account password private and use a strong, unique password.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Children&rsquo;s privacy</h2>
        <p>Elevatex AI is intended for business use by adults and is not directed at children under 18.</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Changes to this policy</h2>
        <p>We may update this policy from time to time. Material changes will be reflected by updating the date above.</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Contact</h2>
        <p>
          Questions about this policy? Reach us via our <a href="/contact">Contact page</a>.
        </p>
      </div>
    </LegalPage>
  );
}
