"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StepId = "admin" | "database" | "storage" | "payment" | "ai-providers" | "seed" | "finish";

const STEPS: { id: StepId; label: string }[] = [
  { id: "admin", label: "Super Admin" },
  { id: "database", label: "Database" },
  { id: "storage", label: "Storage" },
  { id: "payment", label: "Payments" },
  { id: "ai-providers", label: "AI Providers" },
  { id: "seed", label: "Seed Data" },
  { id: "finish", label: "Finish" },
];

async function patchProvider(category: string, providerId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/ai-providers/${category}/${providerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function testProvider(category: string, providerId: string) {
  const res = await fetch(`/api/admin/ai-providers/${category}/${providerId}/test`, { method: "POST" });
  return res.json();
}

function StepShell({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  nextLoading = false,
  showBack = true,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg sm:p-10">
      <h1 className="text-heading-2 text-neutral-900">{title}</h1>
      <p className="mt-2 text-body-md text-neutral-500">{description}</p>
      <div className="mt-6 flex flex-col gap-4">{children}</div>
      {onNext && (
        <div className="mt-8 flex items-center justify-between">
          {showBack && onBack ? (
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="primary" disabled={nextDisabled || nextLoading} onClick={onNext}>
            {nextLoading && <Loader2 className="size-4 animate-spin" />}
            {nextLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

// MVP install-flow (2026-07-27) — replaces phone-OTP verification for the
// Installation Wizard's Super Admin step. A fresh install has no OTP vendor
// configured and no existing admin to authenticate against, so requiring
// phone verification here was a real bootstrap blocker, not a security
// requirement — see POST /api/install/create-admin's own comment. Phone-OTP
// remains fully intact for every regular user; this step alone no longer
// uses it.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function AdminStep({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const emailValid = EMAIL_REGEX.test(email);
  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const confirmValid = confirmPassword.length > 0 && confirmPassword === password;

  async function createAndSignIn() {
    setLoading(true);
    try {
      const res = await fetch("/api/install/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create the Super Admin account.");
        return;
      }

      // Auto-login (requirement) — the account was just created with
      // role: "ADMIN" directly, so this sign-in's JWT already carries that
      // role from the start; unlike the old OTP flow there's no separate
      // promote/update() step needed.
      const signInRes = await signIn("password", { email, password, redirect: false });
      if (signInRes?.error) {
        toast.error("Account created, but automatic sign-in failed — please log in manually.");
        return;
      }

      setDone(true);
      toast.success("Super Admin account created.");
      onDone();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepShell
      title="Create your Super Admin account"
      description="This will be the first account on this installation, with full Admin access."
      showBack={false}
      onNext={done ? undefined : createAndSignIn}
      nextLabel="Create account"
      nextDisabled={!emailValid || !passwordValid || !confirmValid}
      nextLoading={loading}
    >
      {!done && (
        <>
          <div>
            <Label className="text-label-sm text-neutral-700">Admin email</Label>
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11"
            />
          </div>
          <div>
            <Label className="text-label-sm text-neutral-700">Password</Label>
            <Input
              type="password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11"
            />
          </div>
          <div>
            <Label className="text-label-sm text-neutral-700">Confirm password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 h-11"
            />
            {confirmPassword.length > 0 && !confirmValid && (
              <p className="mt-1 text-body-sm text-error">Passwords do not match.</p>
            )}
          </div>
        </>
      )}
      {done && (
        <p className="flex items-center gap-2 text-body-md text-success">
          <Check className="size-4" /> Super Admin account ready.
        </p>
      )}
    </StepShell>
  );
}

function DatabaseStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/install/database/test", { method: "POST" });
      const json = await res.json();
      setResult(json.success ? json.data : { ok: false, message: json.error?.message ?? "Test failed." });
    } catch {
      setResult({ ok: false, message: "Network error." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <StepShell
      title="Database"
      description="You're already connected — this page only renders because DATABASE_URL works. To use a different Postgres host (Neon, Supabase, Railway, your own server), set DATABASE_URL in your environment and restart."
      onBack={onBack}
      onNext={onNext}
    >
      <Button type="button" variant="outline" size="sm" disabled={testing} onClick={test} className="w-fit">
        {testing && <Loader2 className="size-4 animate-spin" />}
        Test connection
      </Button>
      {result && (
        <p className={`text-body-sm ${result.ok ? "text-success" : "text-error"}`}>{result.message}</p>
      )}
    </StepShell>
  );
}

interface DriverFieldDef {
  key: string;
  label: string;
  secret?: boolean;
}

function DriverConfigForm({
  category,
  providerId,
  label,
  fields,
  extraConfigFields = [],
}: {
  category: string;
  providerId: string;
  label: string;
  fields: DriverFieldDef[];
  extraConfigFields?: { key: string; label: string }[];
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  async function saveAndTest() {
    setBusy(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = { enabled: true };
      for (const f of fields) body[f.key] = values[f.key] ?? "";
      if (extraConfigFields.length > 0) {
        body.extraConfig = Object.fromEntries(extraConfigFields.map((f) => [f.key, values[f.key] ?? ""]));
      }
      const saveJson = await patchProvider(category, providerId, body);
      if (!saveJson.success) {
        toast.error(saveJson.error?.message ?? "Couldn't save.");
        return;
      }
      const testJson = await testProvider(category, providerId);
      if (!testJson.success) {
        toast.error(testJson.error?.message ?? "Test failed.");
        return;
      }
      setResult(testJson.data.result);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <p className="text-label-md text-neutral-900">{label}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[...fields, ...extraConfigFields].map((f) => (
          <div key={f.key}>
            <Label className="text-label-sm text-neutral-700">{f.label}</Label>
            <Input
              type={"secret" in f && f.secret ? "password" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-1"
            />
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={saveAndTest} className="mt-3">
        {busy && <Loader2 className="size-4 animate-spin" />}
        Test &amp; Save
      </Button>
      {result && (
        <p className={`mt-2 text-body-sm ${result.ok ? "text-success" : "text-error"}`}>{result.message}</p>
      )}
    </div>
  );
}

function StorageStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [driver, setDriver] = React.useState<"mock" | "s3">("mock");

  async function continueStep() {
    if (driver === "mock") {
      await patchProvider("STORAGE", "s3", { enabled: false });
    }
    onNext();
  }

  return (
    <StepShell
      title="Configure storage"
      description="Where rendered videos, images, and uploads are stored."
      onBack={onBack}
      onNext={continueStep}
    >
      <div className="flex gap-2">
        <Button type="button" variant={driver === "mock" ? "secondary" : "outline"} size="sm" onClick={() => setDriver("mock")}>
          Local storage (dev)
        </Button>
        <Button type="button" variant={driver === "s3" ? "secondary" : "outline"} size="sm" onClick={() => setDriver("s3")}>
          S3 / Cloudflare R2
        </Button>
      </div>
      {driver === "s3" && (
        <DriverConfigForm
          category="STORAGE"
          providerId="s3"
          label="S3 / Cloudflare R2"
          fields={[
            { key: "apiKey", label: "Access key ID" },
            { key: "apiSecret", label: "Secret access key", secret: true },
          ]}
          extraConfigFields={[
            { key: "bucket", label: "Bucket" },
            { key: "region", label: "Region" },
            { key: "endpoint", label: "Endpoint (R2/MinIO only)" },
            { key: "publicBaseUrl", label: "Public base URL (optional)" },
          ]}
        />
      )}
    </StepShell>
  );
}

function PaymentStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [driver, setDriver] = React.useState<"mock" | "razorpay">("mock");

  async function continueStep() {
    if (driver === "mock") {
      await patchProvider("PAYMENT", "razorpay", { enabled: false });
    }
    onNext();
  }

  return (
    <StepShell
      title="Configure payments"
      description="How credit packages and subscriptions are charged."
      onBack={onBack}
      onNext={continueStep}
    >
      <div className="flex gap-2">
        <Button type="button" variant={driver === "mock" ? "secondary" : "outline"} size="sm" onClick={() => setDriver("mock")}>
          Mock (testing only)
        </Button>
        <Button type="button" variant={driver === "razorpay" ? "secondary" : "outline"} size="sm" onClick={() => setDriver("razorpay")}>
          Razorpay
        </Button>
      </div>
      {driver === "razorpay" && (
        <DriverConfigForm
          category="PAYMENT"
          providerId="razorpay"
          label="Razorpay"
          fields={[
            { key: "apiKey", label: "Key ID" },
            { key: "apiSecret", label: "Key secret", secret: true },
            { key: "extraSecret", label: "Webhook secret", secret: true },
          ]}
        />
      )}
    </StepShell>
  );
}

const AI_PROVIDER_OPTIONS: { category: string; providerId: string; label: string }[] = [
  { category: "LLM", providerId: "openai", label: "OpenAI (script generation)" },
  { category: "LLM", providerId: "gemini", label: "Google Gemini (script generation)" },
  { category: "IMAGE", providerId: "openai_images", label: "OpenAI GPT Image" },
  { category: "IMAGE", providerId: "flux", label: "Flux Pro (Replicate)" },
  { category: "VOICE", providerId: "elevenlabs", label: "ElevenLabs (voiceover)" },
];

function AIProvidersStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <StepShell
      title="Configure AI providers"
      description="Paste a key and test/save any provider you have — you can always add more later from Admin → AI Providers. Skip for now if you don't have keys handy."
      onBack={onBack}
      onNext={onNext}
      nextLabel="Continue"
    >
      <div className="flex flex-col gap-3">
        {AI_PROVIDER_OPTIONS.map((opt) => (
          <DriverConfigForm
            key={`${opt.category}:${opt.providerId}`}
            category={opt.category}
            providerId={opt.providerId}
            label={opt.label}
            fields={[{ key: "apiKey", label: "API key", secret: true }]}
          />
        ))}
      </div>
    </StepShell>
  );
}

function SeedStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [seeding, setSeeding] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function seed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/install/seed", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't seed defaults.");
        return;
      }
      setDone(true);
      toast.success("Default plans, credit packages, and templates seeded.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <StepShell
      title="Seed default data"
      description="Creates starter pricing plans, credit packages, and video templates for every business vertical — editable from Admin afterwards."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!done}
    >
      <Button type="button" variant="secondary" disabled={seeding || done} onClick={seed} className="w-fit">
        {seeding && <Loader2 className="size-4 animate-spin" />}
        {done ? "Seeded" : "Seed defaults"}
      </Button>
    </StepShell>
  );
}

function FinishStep({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [finishing, setFinishing] = React.useState(false);

  async function finish() {
    setFinishing(true);
    try {
      const res = await fetch("/api/install/finish", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't finish installation.");
        return;
      }
      toast.success("Installation complete!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <StepShell
      title="Finish installation"
      description="Once you finish, this wizard is gone for good — everything is managed from the Admin Panel from here on."
      onBack={onBack}
      onNext={finish}
      nextLabel="Finish installation"
      nextLoading={finishing}
    />
  );
}

export function InstallWizard() {
  const [stepIndex, setStepIndex] = React.useState(0);
  const step = STEPS[stepIndex];

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-brand-navy-light px-4 py-12">
      <div className="mb-6 flex w-full max-w-2xl items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center">
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-label-sm ${
                i < stepIndex
                  ? "bg-success text-white"
                  : i === stepIndex
                    ? "bg-brand-navy text-white"
                    : "bg-neutral-200 text-neutral-500"
              }`}
            >
              {i < stepIndex ? <Check className="size-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className="mx-1 h-px flex-1 bg-neutral-300" />}
          </div>
        ))}
      </div>

      {step.id === "admin" && <AdminStep onDone={goNext} />}
      {step.id === "database" && <DatabaseStep onBack={goBack} onNext={goNext} />}
      {step.id === "storage" && <StorageStep onBack={goBack} onNext={goNext} />}
      {step.id === "payment" && <PaymentStep onBack={goBack} onNext={goNext} />}
      {step.id === "ai-providers" && <AIProvidersStep onBack={goBack} onNext={goNext} />}
      {step.id === "seed" && <SeedStep onBack={goBack} onNext={goNext} />}
      {step.id === "finish" && <FinishStep onBack={goBack} />}
    </div>
  );
}
