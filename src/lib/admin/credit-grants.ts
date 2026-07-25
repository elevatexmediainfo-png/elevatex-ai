import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits/engine";
import { writeAuditLog } from "@/lib/admin/audit-log";

// Milestone 13 — a thin wrapper over the existing grantCredits() engine
// (lib/credits/engine.ts), not a second credit-issuing mechanism. Targets
// users by an explicit list of emails/phones/ids — a rule-based segment
// builder ("everyone on plan X", "everyone inactive 30 days") is a real
// future extension but out of scope here; this covers the brief's
// "Promotional Credits" / one-off-grant need without inventing audience
// targeting this milestone doesn't ask for.

export interface CreditGrantTarget {
  userIds?: string[];
  emails?: string[];
  phones?: string[];
}

export interface CreditGrantResult {
  usersGranted: number;
  identifiersNotFound: string[];
}

export async function grantCreditsToUsers(
  target: CreditGrantTarget,
  amount: number,
  description: string,
  adminUserId: string
): Promise<CreditGrantResult> {
  if (amount <= 0) throw new Error("Grant amount must be positive.");

  const userIds = target.userIds ?? [];
  const emails = target.emails ?? [];
  const phones = target.phones ?? [];

  const orFilters = [
    userIds.length > 0 ? { id: { in: userIds } } : null,
    emails.length > 0 ? { email: { in: emails } } : null,
    phones.length > 0 ? { phone: { in: phones } } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  const users = orFilters.length > 0
    ? await prisma.user.findMany({ where: { OR: orFilters }, select: { id: true, email: true, phone: true } })
    : [];

  for (const user of users) {
    await grantCredits({
      userId: user.id,
      lotType: "PROMOTIONAL",
      transactionType: "PROMOTIONAL",
      amount,
      description: description || "Admin credit grant",
    });
  }

  await writeAuditLog({
    userId: adminUserId,
    resource: "credit_grant",
    action: "grant",
    detail: { amount, usersGranted: users.length, userIds, emails, phones },
  });

  const foundEmails = new Set(users.map((u) => u.email).filter((e): e is string => !!e));
  const foundPhones = new Set(users.map((u) => u.phone).filter((p): p is string => !!p));
  const foundIds = new Set(users.map((u) => u.id));
  const identifiersNotFound = [
    ...userIds.filter((id) => !foundIds.has(id)),
    ...emails.filter((e) => !foundEmails.has(e)),
    ...phones.filter((p) => !foundPhones.has(p)),
  ];

  return { usersGranted: users.length, identifiersNotFound };
}
