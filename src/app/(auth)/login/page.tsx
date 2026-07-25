"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/shared/container";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ForceSceneTheme } from "@/components/shared/force-scene-theme";

type Step = "phone" | "otp";

const RESEND_COOLDOWN_SECONDS = 60;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.08 3.57-5.15 3.57-8.66Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-3a7.18 7.18 0 0 1-4.07 1.14c-3.13 0-5.78-2.11-6.73-4.96H1.2v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.2a12 12 0 0 0 0 10.74l4.07-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.2 6.63l4.07 3.1C6.22 6.87 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

// Only allow same-origin relative redirect targets.
function sanitizeCallbackUrl(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/dashboard";
  }
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

  const [step, setStep] = React.useState<Step>("phone");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [devOtp, setDevOtp] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function sendOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Couldn't send OTP. Please try again.");
        return;
      }
      setDevOtp(json.data.devOtp ?? null);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("otp", { phone, otp, redirect: false });
      if (res?.error) {
        setError("Incorrect or expired code. Please try again.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { redirectTo: callbackUrl });
  }

  return (
    // bg-[#0B0F19] matches the 3D canvas background exactly — fallback for
    // pre-hydration. BackgroundEngine (root layout) renders the live 3D world
    // once JS loads; this color makes the transition invisible.
    <div className="relative flex min-h-screen flex-col bg-[#0B0F19]">
      {/* Login keeps its existing always-dark look (out of this pass's
          scope) — pins the shared 3D canvas dark regardless of the site
          toggle so it can't show a light scene through this dark chrome. */}
      <ForceSceneTheme theme="dark" />
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-lg flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            <Sparkles className="size-[15px] text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-[-0.2px] leading-none">
            Elevatex{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)" }}
            >
              AI
            </span>
          </span>
        </Link>
        <LanguageToggle />
      </header>

      {/* Hero: the glass card is the centrepiece, not the background */}
      <Container as="main" className="relative z-10 flex flex-1 items-center justify-center py-12">
        <div
          className="w-full max-w-[420px] rounded-2xl p-6 sm:p-10"
          style={{
            background: "rgba(22, 27, 38, 0.82)",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255, 255, 255, 0.09)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 0 rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.70), 0 0 80px rgba(124,58,237,0.06)",
          }}
        >
          <h1 className="text-heading-1 text-white">
            {step === "phone" ? "Log in or sign up" : "Enter the code"}
          </h1>
          <p className="mt-2 text-body-md text-white/50">
            {step === "phone"
              ? "Continue with Google or your phone number."
              : `We sent a 6-digit code to +91 ${phone}.`}
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-body-sm text-red-400">
              {error}
            </div>
          )}

          {devOtp && step === "otp" && (
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-body-sm text-amber-400">
              Dev mode — no SMS gateway configured. Your code is{" "}
              <span className="font-mono font-semibold">{devOtp}</span>.
            </div>
          )}

          {step === "phone" && (
            <div className="mt-6 flex flex-col gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/[0.18]"
                disabled={googleLoading}
                onClick={handleGoogle}
              >
                {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 text-body-sm text-white/30">
                <span className="h-px flex-1 bg-white/[0.07]" />
                or
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-label-md text-white/65">
                  Mobile number
                </label>
                <div className="flex items-center gap-2">
                  <span className="flex h-11 items-center rounded-md border border-white/[0.10] bg-white/[0.04] px-3 text-body-md text-white/45">
                    +91
                  </span>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="h-11 text-body-md"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={phone.length !== 10 || loading}
                onClick={sendOtp}
                style={{
                  background: "linear-gradient(155deg, #8B5CF6 0%, #6D28D9 40%, #2563EB 100%)",
                  boxShadow:
                    "0 4px 20px rgba(124,58,237,0.42), 0 2px 8px rgba(37,99,235,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                  color: "white",
                }}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Send OTP
              </Button>
            </div>
          )}

          {step === "otp" && (
            <div className="mt-6 flex flex-col gap-4">
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-11 text-center font-mono text-heading-2 tracking-[0.3em]"
              />

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={otp.length !== 6 || loading}
                onClick={verifyOtp}
                style={{
                  background: "linear-gradient(155deg, #8B5CF6 0%, #6D28D9 40%, #2563EB 100%)",
                  boxShadow:
                    "0 4px 20px rgba(124,58,237,0.42), 0 2px 8px rgba(37,99,235,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                  color: "white",
                }}
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Verify &amp; Continue
              </Button>

              <div className="flex items-center justify-between text-body-sm">
                <button
                  type="button"
                  className="text-white/40 hover:text-white/75 transition-colors duration-150"
                  onClick={() => { setStep("phone"); setOtp(""); setError(null); }}
                >
                  Change number
                </button>
                <button
                  type="button"
                  className="text-violet-400 hover:text-violet-300 disabled:text-white/30 transition-colors duration-150"
                  disabled={cooldown > 0 || loading}
                  onClick={sendOtp}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-caption text-white/30">
            By continuing you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </Container>
    </div>
  );
}
