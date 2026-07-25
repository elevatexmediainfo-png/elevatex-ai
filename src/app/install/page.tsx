import { ensureNotInstalled } from "@/lib/installation";
import { InstallWizard } from "./install-wizard";

// force-dynamic: see (marketing)/layout.tsx's comment — without it, Next
// could bake "stay on /install" into a static build artifact and never
// re-check after a real installation completes.
export const dynamic = "force-dynamic";

export default async function InstallPage() {
  await ensureNotInstalled();

  return <InstallWizard />;
}
