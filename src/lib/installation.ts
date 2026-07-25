import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

// Milestone 10 Part 3 — first-run detection. A plain SystemConfig row (not a
// CONFIG_REGISTRY entry — this isn't an admin-editable setting, it's a
// one-time boot flag) rather than a new table; reusing the table that
// already exists keeps this additive, not a new persistence concept.
const INSTALLATION_FLAG_KEY = "INSTALLATION_COMPLETED";

// Installation is a one-way transition within a process's lifetime — once
// confirmed true, never re-check the DB for it again. This is what keeps
// the gate (added to every top-level layout, see (marketing)/(auth)/
// (dashboard)/admin layouts) cheap forever after the one-time install,
// instead of an extra query on every request.
let cachedInstalled = false;

export async function isInstalled(): Promise<boolean> {
  if (cachedInstalled) return true;
  const row = await prisma.systemConfig.findUnique({ where: { key: INSTALLATION_FLAG_KEY } });
  cachedInstalled = row?.value === true;
  return cachedInstalled;
}

export async function markInstallationComplete(performedBy?: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key: INSTALLATION_FLAG_KEY },
    create: { key: INSTALLATION_FLAG_KEY, value: true, updatedBy: performedBy },
    update: { value: true, updatedBy: performedBy },
  });
  cachedInstalled = true;
}

// Called from every top-level layout that ISN'T the wizard itself
// ((marketing)/(auth)/(dashboard)/admin) — redirect() throws, so this
// propagates through the layout's render the same way admin/layout.tsx's
// own auth() check already does.
export async function ensureInstalled(): Promise<void> {
  if (!(await isInstalled())) redirect("/install");
}

// Called from the wizard's own page/layout — once installation is done,
// the wizard must never be reachable again (Part 3's explicit requirement).
export async function ensureNotInstalled(): Promise<void> {
  if (await isInstalled()) redirect("/login");
}
