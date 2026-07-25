"use client";

import * as React from "react";
import { Check, Copy, Gift } from "lucide-react";
import { toast } from "sonner";

interface ReferralPanelProps {
  referralCode: string;
  referralCount: number;
}

// Milestone 12 — Referral System. The code itself is generated server-side
// (lib/referrals/engine.ts's getOrCreateReferralCode(), lazily on first
// fetch) and passed down already-resolved; this component is just the
// copy-to-clipboard UI, no separate fetch needed.
export function ReferralPanel({ referralCode, referralCount }: ReferralPanelProps) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy it manually instead.");
    }
  }

  return (
    <div className="rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Gift className="size-4 text-accent-orange" />
        <h2 className="text-label-lg text-dash-ink">Invite &amp; earn</h2>
      </div>
      <p className="mt-1 text-body-sm text-dash-ink/55">
        Share your code — you and your friend both get bonus credits when they sign up and apply it.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded-lg border border-edge-card bg-glass-subtle px-3 py-2 text-label-md tracking-wide text-dash-ink">
          {referralCode}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-edge-card text-dash-ink/65 hover:bg-glass-soft"
          aria-label="Copy referral code"
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-label-sm text-dash-ink/55">
        {referralCount} {referralCount === 1 ? "person" : "people"} referred so far.
      </p>
    </div>
  );
}
