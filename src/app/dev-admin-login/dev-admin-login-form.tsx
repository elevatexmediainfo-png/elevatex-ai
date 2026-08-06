"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/shared/container";

// Re-keyed from phone to email (2026-08-06, OTP removal) — see the
// "dev-bypass" provider's own comment in lib/auth/index.ts.
export function DevAdminLoginForm() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function devBypassLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("dev-bypass", { email, redirect: false });
      if (res?.error) {
        setError("No ADMIN account found for that email.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy-light">
      <Container as="main" className="flex justify-center py-12">
        <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-lg sm:p-10">
          <h1 className="text-heading-1 text-neutral-900">Dev admin bypass</h1>
          <p className="mt-2 text-body-md text-neutral-500">
            Local-only. Signs in an existing ADMIN account by email, without a password.
            Not linked from any page — never available in production.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-error-light px-3 py-2 text-body-sm text-error">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-label-md text-neutral-700">
                Admin&apos;s email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 text-body-md"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!email || loading}
              onClick={devBypassLogin}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Sign in as admin
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
