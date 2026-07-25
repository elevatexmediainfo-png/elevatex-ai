import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { CreditLotType, CreditTransactionType } from "@/generated/prisma/enums";
import { getConfig } from "@/lib/admin/config";

// Milestone 4 — FR-CR credit engine. Credits live in CreditLot rows (each
// with its own type/expiry/source) so the Download Service can support free,
// purchased, subscription, promotional, and referral credits with different
// expiry and consumption-priority rules, while CreditAccount.balance stays a
// fast cached sum for cheap balance reads. grantCredits()/consumeCredits()
// are the only writers — anything that mutates a lot or the cached balance
// outside this module will drift the two apart.

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number
  ) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

interface GrantInput {
  userId: string;
  lotType: CreditLotType;
  // Separate from lotType because the ledger label is sometimes more
  // specific than the lot it lands in — e.g. a REFUND is booked as an
  // ADMIN_ADJUSTMENT lot (there's no dedicated REFUND lot type) but should
  // still read "Refund" in the user's transaction history.
  transactionType: CreditTransactionType;
  amount: number;
  expiresAt?: Date | null;
  sourceRef?: string;
  description?: string;
  videoProjectId?: string;
}

interface ConsumeInput {
  userId: string;
  amount: number;
  type: CreditTransactionType;
  description?: string;
  videoProjectId?: string;
  // Milestone 14 — mirrors videoProjectId, for charges against the new
  // standalone content-type projects. Never both at once.
  creativeProjectId?: string;
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function getCreditBalance(userId: string): Promise<number> {
  const account = await prisma.creditAccount.findUnique({ where: { userId } });
  return account?.balance ?? 0;
}

export async function listCreditTransactions(userId: string, limit = 20) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listCreditLots(userId: string) {
  return prisma.creditLot.findMany({
    where: { userId, remaining: { gt: 0 } },
    orderBy: { createdAt: "desc" },
  });
}

export async function grantCredits(input: GrantInput, db?: Prisma.TransactionClient) {
  if (input.amount <= 0) throw new Error("grantCredits amount must be positive");

  const run = async (tx: Db) => {
    const lot = await tx.creditLot.create({
      data: {
        userId: input.userId,
        type: input.lotType,
        amount: input.amount,
        remaining: input.amount,
        expiresAt: input.expiresAt ?? null,
        sourceRef: input.sourceRef,
      },
    });

    const account = await tx.creditAccount.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, balance: input.amount },
      update: { balance: { increment: input.amount } },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        userId: input.userId,
        videoProjectId: input.videoProjectId,
        type: input.transactionType,
        amount: input.amount,
        balanceAfter: account.balance,
        description: input.description,
      },
    });

    return { lot, balance: account.balance, transaction };
  };

  return db ? run(db) : prisma.$transaction(run);
}

// Real charge-before-generation support (2026-07-24) — thin, named wrapper
// over the exact pattern grantCredits()'s own GrantInput.transactionType
// comment already anticipated ("a REFUND is booked as an ADMIN_ADJUSTMENT
// lot... but should still read 'Refund'") — never actually called anywhere
// until now. Used when a video-generation flow reserves credits at submit
// time and the generation then fails (or costs less than reserved, e.g. a
// mock-fallback hard-fail never reaching this point, or a provider-selector
// fallback landing on a cheaper provider than requested).
export async function refundCredits(
  input: { userId: string; amount: number; description?: string; videoProjectId?: string },
  db?: Prisma.TransactionClient
) {
  return grantCredits(
    {
      userId: input.userId,
      lotType: "ADMIN_ADJUSTMENT",
      transactionType: "REFUND",
      amount: input.amount,
      description: input.description,
      videoProjectId: input.videoProjectId,
    },
    db
  );
}

// Admin-configurable (CREDIT_CONSUMPTION_ORDER) — which lots get drawn down
// first. Defaults to EXPIRING_FIRST so credits with a deadline are used
// before credits that never expire.
function lotOrderBy(order: string) {
  if (order === "FREE_FIRST") {
    return Prisma.sql`(type = 'SIGNUP_BONUS') DESC, "expiresAt" ASC NULLS LAST, "createdAt" ASC`;
  }
  if (order === "PURCHASED_FIRST") {
    return Prisma.sql`(type = 'PURCHASED') DESC, "expiresAt" ASC NULLS LAST, "createdAt" ASC`;
  }
  return Prisma.sql`"expiresAt" ASC NULLS LAST, "createdAt" ASC`;
}

// The only place credits are spent (called from the Download Service).
// Draws down across however many lots are needed to cover `amount`, oldest/
// soonest-to-expire first per the admin-configured order, then mirrors the
// same total onto the cached CreditAccount.balance.
export async function consumeCredits(
  { userId, amount, type, description, videoProjectId, creativeProjectId }: ConsumeInput,
  db?: Prisma.TransactionClient
) {
  if (amount <= 0) throw new Error("consumeCredits amount must be positive");

  const run = async (tx: Db) => {
    const order = await getConfig("CREDIT_CONSUMPTION_ORDER");

    // FOR UPDATE locks every usable lot row for this user for the rest of
    // this transaction. A concurrent consumeCredits() call for the same user
    // blocks on these rows instead of reading the same `remaining` values we
    // are about to draw down from — without the lock, two simultaneous
    // downloads could each see a lot with 1 credit left and both spend it.
    const lots = await tx.$queryRaw<{ id: string; remaining: number }[]>`
      SELECT id, remaining FROM credit_lots
      WHERE "userId" = ${userId} AND remaining > 0
        AND ("expiresAt" IS NULL OR "expiresAt" > now())
      ORDER BY ${lotOrderBy(order)}
      FOR UPDATE
    `;

    const available = lots.reduce((sum, lot) => sum + lot.remaining, 0);
    if (available < amount) {
      throw new InsufficientCreditsError(amount, available);
    }

    let toDraw = amount;
    for (const lot of lots) {
      if (toDraw <= 0) break;
      const draw = Math.min(lot.remaining, toDraw);
      await tx.creditLot.update({
        where: { id: lot.id },
        data: { remaining: { decrement: draw } },
      });
      toDraw -= draw;
    }

    // Same atomic conditional UPDATE used everywhere else in this codebase
    // for the cached balance — the WHERE guard re-confirms sufficiency
    // (already locked via the lots above, so this should never fail here,
    // but it's the cheapest possible cross-check against the two ever
    // drifting apart) and RETURNING gives us the post-debit value to stamp
    // onto the ledger row.
    const balanceRows = await tx.$queryRaw<{ balance: number }[]>`
      UPDATE credit_accounts
      SET balance = balance - ${amount}, "updatedAt" = now()
      WHERE "userId" = ${userId} AND balance >= ${amount}
      RETURNING balance
    `;
    if (balanceRows.length === 0) {
      throw new InsufficientCreditsError(amount, available);
    }

    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        videoProjectId,
        creativeProjectId,
        type,
        amount: -amount,
        balanceAfter: balanceRows[0].balance,
        description,
      },
    });

    return { balance: balanceRows[0].balance, transaction };
  };

  return db ? run(db) : prisma.$transaction(run);
}

// Maintenance job (call from the same cron/internal-route pattern as the
// queue's process endpoint) — zeroes out lots past their expiry, logs an
// EXPIRY transaction per affected user, and reconciles the cached balance
// down to match. Lots are the source of truth; this is what keeps
// CreditAccount.balance from overstating what's actually still spendable.
export async function expireStaleLots(): Promise<{ usersAffected: number; creditsExpired: number }> {
  const expired = await prisma.creditLot.findMany({
    where: { remaining: { gt: 0 }, expiresAt: { lte: new Date() } },
    select: { id: true, userId: true, remaining: true },
  });
  if (expired.length === 0) return { usersAffected: 0, creditsExpired: 0 };

  const byUser = new Map<string, number>();
  for (const lot of expired) {
    byUser.set(lot.userId, (byUser.get(lot.userId) ?? 0) + lot.remaining);
  }

  for (const [userId, amount] of byUser) {
    await prisma.$transaction(async (tx) => {
      const userLots = expired.filter((lot) => lot.userId === userId);
      for (const lot of userLots) {
        await tx.creditLot.update({ where: { id: lot.id }, data: { remaining: 0 } });
      }

      const account = await tx.creditAccount.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: "EXPIRY",
          amount: -amount,
          balanceAfter: account.balance,
          description: `${amount} credit(s) expired`,
        },
      });
    });
  }

  return { usersAffected: byUser.size, creditsExpired: expired.reduce((sum, l) => sum + l.remaining, 0) };
}
