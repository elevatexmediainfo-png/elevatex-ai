import { ensureInstalled } from "@/lib/installation";

// force-dynamic: see (marketing)/layout.tsx's comment — without it, Next
// bakes ensureInstalled()'s redirect into a static build artifact.
export const dynamic = "force-dynamic";

// Previously no layout existed here (login/onboarding rendered directly
// under the root layout) — adding one is purely additive, same URLs, just
// gives this group a place for the install-completion check every other
// top-level group already has.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  await ensureInstalled();

  return children;
}
