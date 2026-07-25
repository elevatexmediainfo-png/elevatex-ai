import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { SignOutButton } from "@/components/shared/sign-out-button";

function formatVertical(vertical: string | null | undefined) {
  if (!vertical) return "Not set";
  return vertical
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true },
  });

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-10">
      <div>
        <h1 className="text-heading-1 text-dash-ink">Settings</h1>
        <p className="mt-1 text-body-md text-dash-ink/55">Your account and business details.</p>
      </div>

      <section className="rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <h2 className="text-label-lg text-dash-ink">Account</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-body-sm">
          <dt className="text-dash-ink/55">Name</dt>
          <dd className="text-dash-ink">{user?.name ?? "Not set"}</dd>
          <dt className="text-dash-ink/55">Email</dt>
          <dd className="text-dash-ink">{user?.email ?? "Not set"}</dd>
          <dt className="text-dash-ink/55">Phone</dt>
          <dd className="text-dash-ink">{user?.phone ?? "Not set"}</dd>
        </dl>
      </section>

      <section className="rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <h2 className="text-label-lg text-dash-ink">Business</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-body-sm">
          <dt className="text-dash-ink/55">Business name</dt>
          <dd className="text-dash-ink">{user?.profile?.businessName ?? "Not set"}</dd>
          <dt className="text-dash-ink/55">Vertical</dt>
          <dd className="text-dash-ink">{formatVertical(user?.profile?.businessVertical)}</dd>
          <dt className="text-dash-ink/55">City</dt>
          <dd className="text-dash-ink">{user?.profile?.city ?? "Not set"}</dd>
        </dl>
      </section>

      <section className="rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <h2 className="text-label-lg text-dash-ink">More</h2>
        <div className="mt-3 flex flex-col gap-2 text-label-md text-violet-600 dark:text-violet-400">
          <Link href="/brand-kit" className="hover:underline">
            Brand Kit
          </Link>
          <Link href="/credits" className="hover:underline">
            Credits &amp; Billing
          </Link>
        </div>
      </section>

      <SignOutButton />
    </Container>
  );
}
