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

// Phone-OTP authentication removed entirely (2026-08-06) — this page used
// to be a 3-step flow (phone -> otp -> password, phone/Google as the
// default). Only Google and email+password remain, so there's no longer a
// "simpler default path" to pick between — both are shown together on one
// screen, no step state needed.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { redirectTo: callbackUrl });
  }

  async function loginWithPassword() {
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("password", { email: loginEmail, password: loginPassword, redirect: false });
      if (res?.error) {
        setError("Incorrect email or password.");
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
          <h1 className="text-heading-1 text-white">Log in or sign up</h1>
          <p className="mt-2 text-body-md text-white/50">Continue with Google or your email.</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-body-sm text-red-400">
              {error}
            </div>
          )}

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
              <label htmlFor="login-email" className="mb-1.5 block text-label-md text-white/65">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@company.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="h-11 text-body-md"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-label-md text-white/65">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="h-11 text-body-md"
              />
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!loginEmail || !loginPassword || loading}
              onClick={loginWithPassword}
              style={{
                background: "linear-gradient(155deg, #8B5CF6 0%, #6D28D9 40%, #2563EB 100%)",
                boxShadow:
                  "0 4px 20px rgba(124,58,237,0.42), 0 2px 8px rgba(37,99,235,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
                color: "white",
              }}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Log in
            </Button>
          </div>

          <p className="mt-8 text-center text-caption text-white/30">
            By continuing you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </Container>
    </div>
  );
}
