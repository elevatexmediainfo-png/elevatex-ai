import { prisma } from "@/lib/prisma";
import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { sendNotificationEmail } from "@/lib/notifications/email";

type Db = Prisma.TransactionClient | typeof prisma;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Also email the user, if they have one. Default false — most in-app
   * events (e.g. render complete) don't need an inbox ping on top of the
   * bell icon; broadcasts and important account events do. */
  email?: boolean;
}

// Fire-and-forget by convention at every call site (never awaited inline
// with the render/export flow it's attached to) — a notification failure
// must never block or fail the work it's reporting on.
export async function notifyUser(input: NotifyInput, db: Db = prisma) {
  const notification = await db.notification.create({
    data: { userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link },
  });

  if (input.email) {
    const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    if (user?.email) {
      void sendNotificationEmail(user.email, input.title, `<p>${input.body}</p>`);
    }
  }

  return notification;
}

export async function listNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

// Admin broadcast — one Notification row per targeted user, optional email
// fan-out through the same Email provider. `userIds` omitted broadcasts to
// every non-deleted account.
export async function broadcastNotification(input: { title: string; body: string; link?: string; email?: boolean; userIds?: string[] }) {
  const targets = input.userIds?.length
    ? input.userIds
    : (await prisma.user.findMany({ where: { accountStatus: { not: "DELETED" } }, select: { id: true } })).map((u) => u.id);

  await prisma.notification.createMany({
    data: targets.map((userId) => ({ userId, type: "BROADCAST" as const, title: input.title, body: input.body, link: input.link })),
  });

  if (input.email) {
    const users = await prisma.user.findMany({ where: { id: { in: targets } }, select: { email: true } });
    for (const u of users) {
      if (u.email) void sendNotificationEmail(u.email, input.title, `<p>${input.body}</p>`);
    }
  }

  return { notifiedCount: targets.length };
}
