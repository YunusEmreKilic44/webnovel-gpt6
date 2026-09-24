import "server-only";
import { z } from "zod";
import type { Database } from "@/db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type NotificationType =
  | "NEW_CHAPTER"
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "REPORT_RESOLVED"
  | "REPORT_DISMISSED";

/**
 * Notifies every reader who has the book in their library (never the author,
 * never banned accounts) that a chapter was published for the first time.
 * Runs inside the publishing transaction as one INSERT … SELECT; the unique
 * (user, chapter, type) key makes repeats harmless.
 */
export async function notifyNewChapter(
  tx: Tx,
  chapter: { id: string; bookId: string },
  authorId: string,
) {
  return tx.$executeRaw`
    INSERT INTO notifications (id, user_id, type, book_id, chapter_id)
    SELECT gen_random_uuid()::text, l.user_id, 'NEW_CHAPTER', ${chapter.bookId}, ${chapter.id}
    FROM library_entries l JOIN "user" u ON u.id = l.user_id
    WHERE l.book_id = ${chapter.bookId} AND l.user_id <> ${authorId} AND NOT u.banned
    ON CONFLICT (user_id, chapter_id, type) DO NOTHING
  `;
}

/** Tells the author the outcome of a publication or premium application. */
export async function notifyApplicationReviewed(
  tx: Tx,
  application: { id: string; bookId: string },
  authorId: string,
  decision: "APPROVED" | "REJECTED",
) {
  await tx.notification.createMany({
    data: [
      {
        id: crypto.randomUUID(),
        userId: authorId,
        type: `APPLICATION_${decision}`,
        bookId: application.bookId,
        applicationId: application.id,
      },
    ],
    skipDuplicates: true,
  });
}

/**
 * Lets each reporter know their report was handled. The admin's internal
 * note is not shared; the reporter only learns the outcome.
 */
export async function notifyReportsHandled(
  tx: Tx,
  reports: { id: string; reporterId: string }[],
  decision: "RESOLVED" | "DISMISSED",
) {
  if (!reports.length) return;
  await tx.notification.createMany({
    data: reports.map((report) => ({
      id: crypto.randomUUID(),
      userId: report.reporterId,
      type: `REPORT_${decision}`,
      reportId: report.id,
    })),
    skipDuplicates: true,
  });
}

// New-chapter notices whose chapter or book was hidden or unpublished later
// are neither listed nor counted. Decisions and report outcomes always show.
const visible = {
  OR: [
    {
      type: "NEW_CHAPTER",
      chapter: { status: "PUBLISHED", hidden: false },
      book: { status: "PUBLISHED", hidden: false },
    },
    { type: { in: ["APPLICATION_APPROVED", "APPLICATION_REJECTED"] } },
    { type: { in: ["REPORT_RESOLVED", "REPORT_DISMISSED"] } },
  ],
} satisfies Prisma.NotificationWhereInput;

export async function getUnreadCount(db: Database, userId: string) {
  return db.notification.count({
    where: { userId, readAt: null, ...visible },
  });
}

export async function getNotifications(
  db: Database,
  userId: string,
  {
    filter = "all",
    take = 50,
  }: { filter?: "all" | "unread"; take?: number } = {},
) {
  const rows = await db.notification.findMany({
    where: {
      userId,
      ...visible,
      ...(filter === "unread" ? { readAt: null } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      type: true,
      readAt: true,
      createdAt: true,
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
          cover: true,
          coverUrl: true,
          premiumStatus: true,
        },
      },
      chapter: {
        select: {
          id: true,
          publishedTitle: true,
          position: true,
          accessType: true,
          volume: { select: { position: true } },
          unlocks: { where: { userId }, select: { id: true } },
        },
      },
      // Decision notes are written for the author, so they are shown to them.
      application: { select: { type: true, note: true } },
      report: { select: { targetType: true, reason: true } },
    },
  });
  return rows.map(({ chapter, ...row }) => ({
    ...row,
    type: row.type as NotificationType,
    chapter: chapter && {
      id: chapter.id,
      publishedTitle: chapter.publishedTitle,
      position: chapter.position,
      accessType: chapter.accessType,
      unlocked: chapter.unlocks.length > 0,
    },
  }));
}

const idInput = z.string().min(1).max(128);

/**
 * Marks one of the user's notifications read and returns where it leads, or
 * null when it does not belong to them. Reading access is still enforced by
 * the reader page: a premium chapter stays locked until it is unlocked.
 */
export async function markNotificationRead(
  db: Database,
  userId: string,
  notificationId: string,
) {
  const parsed = idInput.safeParse(notificationId);
  if (!parsed.success) return null;
  const id = parsed.data;
  const notification = await db.notification.findFirst({
    where: { id, userId },
    select: { type: true, chapterId: true, bookId: true, readAt: true },
  });
  if (!notification) return null;
  if (!notification.readAt)
    await db.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  if (notification.type === "NEW_CHAPTER" && notification.chapterId)
    return `/oku/${notification.chapterId}`;
  if (notification.type.startsWith("APPLICATION_") && notification.bookId)
    return `/studio/books/${notification.bookId}`;
  return "/bildirimler";
}

export async function markAllNotificationsRead(db: Database, userId: string) {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
