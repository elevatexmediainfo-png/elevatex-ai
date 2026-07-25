"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2,
  Coffee,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Hotel,
  Loader2,
  Scissors,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import {
  APP_LANGUAGES,
  BUSINESS_VERTICALS,
  CONTENT_LANGUAGES,
} from "@/lib/validations/onboarding";

const VERTICAL_META: Record<(typeof BUSINESS_VERTICALS)[number], { label: string; icon: typeof Utensils }> = {
  RESTAURANT: { label: "Restaurant / Cloud Kitchen", icon: Utensils },
  CAFE_BAKERY: { label: "Cafe / Bakery", icon: Coffee },
  SALON_SPA: { label: "Salon / Spa", icon: Scissors },
  DENTAL_DIAGNOSTIC: { label: "Dental / Diagnostic", icon: Stethoscope },
  REAL_ESTATE: { label: "Real Estate", icon: Building2 },
  RETAIL: { label: "Retail Store", icon: ShoppingBag },
  GYM_FITNESS: { label: "Gym / Fitness", icon: Dumbbell },
  HOSPITAL: { label: "Hospital / Clinic", icon: HeartPulse },
  COACHING_EDTECH: { label: "Coaching / EdTech", icon: GraduationCap },
  HOTEL: { label: "Hotel / Guest House", icon: Hotel },
  OTHER: { label: "Other", icon: Sparkles },
};

type Vertical = (typeof BUSINESS_VERTICALS)[number];
type AppLanguage = (typeof APP_LANGUAGES)[number];
type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

export default function OnboardingPage() {
  const router = useRouter();
  const { update } = useSession();

  const [step, setStep] = React.useState<1 | 2>(1);
  const [vertical, setVertical] = React.useState<Vertical | null>(null);
  const [uiLanguage, setUiLanguage] = React.useState<AppLanguage>("EN");
  const [businessName, setBusinessName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [contentLanguage, setContentLanguage] = React.useState<ContentLanguage>("EN");
  const [referralCode, setReferralCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    if (!vertical) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessVertical: vertical,
          businessName,
          city,
          uiLanguage,
          contentLanguage,
          referralCode,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      await update({ onboardingCompleted: true });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Container as="main" className="flex max-w-2xl flex-col py-12">
        <div className="mb-8 flex items-center gap-2">
          {[1, 2].map((s) => (
            <span
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                s <= step ? "bg-accent-orange" : "bg-neutral-200"
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-heading-1 text-neutral-900">
              Tell us about your business
            </h1>
            <p className="mt-2 text-body-md text-neutral-500">
              This helps us personalise your templates and AI scripts.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BUSINESS_VERTICALS.map((v) => {
                const meta = VERTICAL_META[v];
                const selected = vertical === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVertical(v)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors",
                      selected
                        ? "border-brand-navy bg-brand-navy-light"
                        : "border-neutral-200 bg-white hover:border-brand-navy/40"
                    )}
                  >
                    <meta.icon
                      className={cn(
                        "size-6",
                        selected ? "text-brand-navy" : "text-neutral-500"
                      )}
                    />
                    <span className="text-label-sm text-neutral-700">
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <p className="mb-2 text-label-md text-neutral-700">
                Preferred app language
              </p>
              <div className="inline-flex rounded-full border border-neutral-300 p-1">
                {(["EN", "HI"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setUiLanguage(lang)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-label-sm",
                      uiLanguage === lang
                        ? "bg-brand-navy text-white"
                        : "text-neutral-500"
                    )}
                  >
                    {lang === "EN" ? "English" : "हिंदी"}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="mt-10 w-full"
              disabled={!vertical}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-heading-1 text-neutral-900">
              Set up your brand basics
            </h1>
            <p className="mt-2 text-body-md text-neutral-500">
              You can always change these later in Settings.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-error-light px-3 py-2 text-body-sm text-error">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-5">
              <div>
                <label htmlFor="businessName" className="mb-1.5 block text-label-md text-neutral-700">
                  Business name
                </label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Spice Garden Restaurant"
                  className="h-11 text-body-md"
                />
              </div>

              <div>
                <label htmlFor="city" className="mb-1.5 block text-label-md text-neutral-700">
                  City <span className="text-neutral-500">(optional)</span>
                </label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Indore"
                  className="h-11 text-body-md"
                />
              </div>

              <div>
                <p className="mb-2 text-label-md text-neutral-700">
                  Video content language
                </p>
                <div className="inline-flex rounded-full border border-neutral-300 p-1">
                  {(["EN", "HI", "HINGLISH"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setContentLanguage(lang)}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-label-sm",
                        contentLanguage === lang
                          ? "bg-brand-navy text-white"
                          : "text-neutral-500"
                      )}
                    >
                      {lang === "EN" ? "English" : lang === "HI" ? "हिंदी" : "Hinglish"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="referralCode" className="mb-1.5 block text-label-md text-neutral-700">
                  Referral code <span className="text-neutral-500">(optional)</span>
                </label>
                <Input
                  id="referralCode"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AB12CD34"
                  className="h-11 text-body-md uppercase"
                />
              </div>
            </div>

            <div className="mt-10 flex gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={!businessName.trim() || loading}
                onClick={handleSubmit}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Finish setup
              </Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
