import type { Metadata } from "next";

import { LegalPage } from "@/components/shared/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy — Elevatex AI",
  description: "How Elevatex AI uses cookies and local storage.",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="29 June 2026">
      <p>
        Elevatex AI uses a small number of cookies and browser storage — no third-party advertising or tracking
        cookies.
      </p>

      <div className="flex flex-col gap-3">
        <h2>Essential cookies</h2>
        <ul>
          <li>
            <strong>Session cookie:</strong> keeps you signed in after OTP login. Required for the Service to work;
            cannot be disabled without signing out.
          </li>
          <li>
            <strong>CSRF protection:</strong> our session cookie is scoped same-site, and we also verify the request
            Origin on every change-making request — neither stores additional data, both are required for security.
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Preference storage</h2>
        <ul>
          <li>
            <strong>Theme preference:</strong> stored in your browser&rsquo;s local storage to remember your
            light/dark mode choice. Never sent to our servers.
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2>What we don&rsquo;t use</h2>
        <p>
          We don&rsquo;t use third-party advertising cookies, cross-site tracking pixels, or analytics cookies that
          identify you across other websites.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2>Managing cookies</h2>
        <p>
          You can clear cookies via your browser settings at any time. Clearing the session cookie will sign you
          out; you can sign back in with your phone number and a new OTP.
        </p>
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
