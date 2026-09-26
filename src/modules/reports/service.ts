import "server-only";
import { z } from "zod";
import type { Database } from "@/db";
import type { Actor } from "@/db/schema";
import type { Prisma } from "@/generated/prisma/client";
import {
  REPORT_DETAILS_MAX,
  REPORT_OTHER_MIN,
  reasonsByTarget,
  reportReasons,
  reportTargetTypes,
  type ReportTargetType,
} from "@/lib/reports";
import {
  administrativeWrite,
  audit,
  setChapterVisibility,
  setCommentVisibility,
  setUserBan,
} from "@/modules/admin/service";
import { DomainError, requireVerified } from "@/modules/publishing/policies";
import { notifyReportsHandled } from "@/modules/notifications/service";

type Tx = Prisma.TransactionClient;

export const reportInput = z
  .object({
    targetType: z.enum(reportTargetTypes),
    targetId: z.string().min(1).max(128),
    reason: z.enum(Object.keys(reportReasons) as [keyof typeof reportReasons], {
      message: "Bir şikâyet sebebi seç.",
    }),
    details: z
      .string()
      .trim()
      .max(REPORT_DETAILS_MAX, "Açıklama en fazla 1000 karakter olabilir.")
      .default(""),
  })
  .refine((input) => reasonsByTarget[input.targetType].includes(input.reason), {
    message: "Bu içerik için geçerli bir sebep seç.",
  })
  .refine(
    (input) =>
      input.reason !== "OTHER" || input.details.length >= REPORT_OTHER_MIN,
    {
      message:
        "“Diğer” seçtiysen ne olduğunu kısaca açıkla (en az 10 karakter).",
    },
  );

/** Owner of the reported thing (to refuse self-reports), or null if missing/not public. */
async function reportTargetOwner(
  tx: Tx,
  type: ReportTargetType,
  id: string,
): Promise<string | null> {
  const publicBook = { status: "PUBLISHED", hidden: false };
  if (type === "BOOK")
    return (
      (
        await tx.book.findFirst({
          where: { id, ...publicBook },
          select: { authorId: true },
        })
      )?.authorId ?? null
    );
  if (type === "CHAPTER")
    return (
      (
        await tx.chapter.findFirst({
          where: { id, status: "PUBLISHED", hidden: false, book: publicBook },
          select: { book: { select: { authorId: true } } },
        })
      )?.book.authorId ?? null
    );
  if (type === "COMMENT")
    return (
      (
        await tx.comment.findFirst({
          where: { id, hidden: false, book: publicBook },
          select: { userId: true },
        })
      )?.userId ?? null
    );
  if (type === "PROFILE_COMMENT")
    return (
      (
        await tx.profileComment.findFirst({
          where: { id, hidden: false },
          select: { authorId: true },
        })
      )?.authorId ?? null
    );
  return (
    (await tx.user.findUnique({ where: { id }, select: { id: true } }))?.id ??
    null
  );
}

export async function createReport(
  db: Database,
  actor: Actor,
  raw: z.input<typeof reportInput>,
) {
  requireVerified(actor);
  const input = reportInput.parse(raw);
  return db.$transaction(async (tx) => {
    const [limit] = await tx.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits (key, count) VALUES (${actor.id + ":report"}, 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.window_start < now() - interval '10 minutes' THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE WHEN rate_limits.window_start < now() - interval '10 minutes' THEN now() ELSE rate_limits.window_start END
      RETURNING count
    `;
    if (limit.count > 10)
      throw new DomainError(
        "RATE_LIMIT",
        "Kısa sürede çok fazla şikâyet gönderdin. Biraz sonra tekrar dene.",
      );
    const owner = await reportTargetOwner(tx, input.targetType, input.targetId);
    if (!owner)
      throw new DomainError("NOT_FOUND", "Şikâyet edilecek içerik bulunamadı.");
    if (owner === actor.id)
      throw new DomainError(
        "SELF_REPORT",
        "Kendi içeriğini veya profilini şikâyet edemezsin.",
      );
    // The partial unique index allows one OPEN report per reporter and target.
    const inserted = await tx.$executeRaw`
      INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details)
      VALUES (${crypto.randomUUID()}, ${actor.id}, ${input.targetType},
              ${input.targetId}, ${input.reason}, ${input.details})
      ON CONFLICT (reporter_id, target_type, target_id) WHERE status = 'OPEN'
      DO NOTHING
    `;
    if (inserted === 0)
      throw new DomainError(
        "ALREADY_REPORTED",
        "Bunu zaten şikâyet ettin; ekibimiz inceliyor.",
      );
  });
}

// ---- Administration -------------------------------------------------------

export const reportStatuses = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export async function countOpenReports(db: Database) {
  return db.report.count({ where: { status: "OPEN" } });
}

export async function getAdminReports(
  db: Database,
  filters: { status: ReportStatus; type?: ReportTargetType; page: number },
  pageSize = 30,
) {
  const where = {
    status: filters.status,
    ...(filters.type ? { targetType: filters.type } : {}),
  };
  const [rows, total] = await Promise.all([
    db.report.findMany({
      where,
      orderBy: [{ createdAt: filters.status === "OPEN" ? "asc" : "desc" }],
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
      include: {
        reporter: { select: { id: true, name: true } },
        handledBy: { select: { name: true } },
      },
    }),
    db.report.count({ where }),
  ]);
  return { rows, total, pageSize };
}

/** What an admin needs to judge a report: the target itself and its history. */
export async function getReportTarget(db: Database, type: string, id: string) {
  if (type === "BOOK") {
    const book = await db.book.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        hidden: true,
        status: true,
        description: true,
        author: { select: { id: true, name: true } },
      },
    });
    return book && { type: "BOOK" as const, book };
  }
  if (type === "CHAPTER") {
    const chapter = await db.chapter.findUnique({
      where: { id },
      select: {
        id: true,
        publishedTitle: true,
        title: true,
        position: true,
        hidden: true,
        status: true,
        book: {
          select: {
            id: true,
            title: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
    });
    return chapter && { type: "CHAPTER" as const, chapter };
  }
  if (type === "COMMENT") {
    const comment = await db.comment.findUnique({
      where: { id },
      select: {
        id: true,
        body: true,
        hidden: true,
        spoiler: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        book: { select: { id: true, title: true, slug: true } },
      },
    });
    return comment && { type: "COMMENT" as const, comment };
  }
  if (type === "PROFILE_COMMENT") {
    const profileComment = await db.profileComment.findUnique({
      where: { id },
      select: {
        id: true,
        body: true,
        hidden: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
        profileUser: { select: { id: true, slug: true, name: true } },
      },
    });
    return (
      profileComment && {
        type: "PROFILE_COMMENT" as const,
        profileComment,
      }
    );
  }
  if (type === "USER") {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        banned: true,
        role: true,
        createdAt: true,
      },
    });
    return user && { type: "USER" as const, user };
  }
  return null;
}

export async function getAdminReport(db: Database, id: string) {
  const report = await db.report.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      handledBy: { select: { name: true } },
    },
  });
  if (!report) return null;
  const [target, related] = await Promise.all([
    getReportTarget(db, report.targetType, report.targetId),
    db.report.findMany({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
        id: { not: report.id },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { reporter: { select: { name: true } } },
    }),
  ]);
  return { report, target, related };
}

export const resolveInput = z.object({
  id: z.string().min(1).max(128),
  decision: z.enum(["RESOLVED", "DISMISSED"]),
  action: z.enum(["NONE", "HIDE", "BAN"]).default("NONE"),
  note: z
    .string()
    .trim()
    .min(5, "İşlem gerekçesi en az 5 karakter olmalı.")
    .max(1000),
});

/**
 * Closes every open report about the same target. When resolving, the admin
 * may act on the target in the same step: hide a book/chapter/comment or ban
 * a user. The action reuses the regular moderation services (and their audit
 * log); a dismissal never changes the content.
 */
export async function resolveReport(
  db: Database,
  actor: Actor,
  raw: z.input<typeof resolveInput>,
) {
  const input = resolveInput.parse(raw);
  const report = await db.report.findUnique({ where: { id: input.id } });
  if (!report) throw new DomainError("NOT_FOUND", "Şikâyet bulunamadı.");
  if (report.status !== "OPEN")
    throw new DomainError("ALREADY_HANDLED", "Bu şikâyet zaten sonuçlandı.");
  const action = input.decision === "DISMISSED" ? "NONE" : input.action;
  const reason = `Şikâyet üzerine: ${input.note}`;
  if (action === "BAN") {
    if (report.targetType !== "USER")
      throw new DomainError(
        "INVALID_ACTION",
        "Yalnız kullanıcılar banlanabilir.",
      );
    await setUserBan(db, actor, { id: report.targetId, banned: true, reason });
  }
  if (action === "HIDE") {
    if (report.targetType === "CHAPTER")
      await setChapterVisibility(db, actor, {
        id: report.targetId,
        hidden: true,
        reason,
      });
    else if (report.targetType === "COMMENT")
      await setCommentVisibility(db, actor, {
        id: report.targetId,
        hidden: true,
        reason,
      });
    else if (report.targetType === "BOOK")
      await hideBook(db, actor, report.targetId, reason);
    else if (report.targetType === "PROFILE_COMMENT")
      await hideProfileComment(db, actor, report.targetId, reason);
    else
      throw new DomainError(
        "INVALID_ACTION",
        "Kullanıcılar gizlenemez; banlamayı seç.",
      );
  }
  return administrativeWrite(db, actor, async (tx) => {
    const openReports = {
      targetType: report.targetType,
      targetId: report.targetId,
      status: "OPEN",
    };
    // Read under the admin lock, then close exactly these and tell their authors.
    const closing = await tx.report.findMany({
      where: openReports,
      select: { id: true, reporterId: true },
    });
    const closed = await tx.report.updateMany({
      where: { ...openReports, id: { in: closing.map((r) => r.id) } },
      data: {
        status: input.decision,
        action,
        resolutionNote: input.note,
        handledById: actor.id,
        handledAt: new Date(),
      },
    });
    await audit(
      tx,
      actor,
      input.decision === "RESOLVED"
        ? "ADMIN_REPORT_RESOLVED"
        : "ADMIN_REPORT_DISMISSED",
      report.id,
      input.note,
      {
        targetType: report.targetType,
        targetId: report.targetId,
        action,
        closedReports: closed.count,
      },
    );
    await notifyReportsHandled(tx, closing, input.decision);
    return closed.count;
  });
}

async function hideProfileComment(
  db: Database,
  actor: Actor,
  commentId: string,
  reason: string,
) {
  await administrativeWrite(db, actor, async (tx) => {
    const comment = await tx.profileComment.findUnique({
      where: { id: commentId },
      select: { hidden: true, profileUserId: true },
    });
    if (!comment) throw new DomainError("NOT_FOUND", "Yorum bulunamadı.");
    await tx.profileComment.update({
      where: { id: commentId },
      data: { hidden: true },
    });
    await audit(tx, actor, "ADMIN_PROFILE_COMMENT_HIDDEN", commentId, reason, {
      before: comment.hidden,
      after: true,
      profileUserId: comment.profileUserId,
    });
  });
}

async function hideBook(
  db: Database,
  actor: Actor,
  bookId: string,
  reason: string,
) {
  await administrativeWrite(db, actor, async (tx) => {
    // Same lock order as publishing and the admin book editor.
    await tx.$queryRaw`SELECT id FROM books WHERE id = ${bookId} FOR UPDATE`;
    const book = await tx.book.findUnique({
      where: { id: bookId },
      select: { hidden: true, featured: true },
    });
    if (!book) throw new DomainError("NOT_FOUND", "Kitap bulunamadı.");
    await tx.book.update({
      where: { id: bookId },
      data: { hidden: true, featured: false, updatedAt: new Date() },
    });
    await audit(tx, actor, "ADMIN_BOOK_UPDATED", bookId, reason, {
      before: { hidden: book.hidden, featured: book.featured },
      after: { hidden: true, featured: false },
    });
  });
}
