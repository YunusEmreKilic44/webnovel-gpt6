import "server-only";
import { z } from "zod";
import type { Database } from "@/db";
import type { Actor } from "@/db/schema";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError, requireReviewer } from "@/modules/publishing/policies";
import { bookInput } from "@/modules/publishing/service";
import { deleteImage } from "@/lib/cloudinary";

const baseInput = z.object({
  id: z.string().min(1).max(128),
  reason: z
    .string()
    .trim()
    .min(5, "İşlem gerekçesi en az 5 karakter olmalı.")
    .max(1000),
});
export const userInput = baseInput.extend({
  name: z.string().trim().min(2).max(60),
  role: z.enum(["reader", "admin"]),
});
export const bookUpdateInput = baseInput.extend({
  ...bookInput.pick({ title: true, description: true, genre: true }).shape,
  storyStatus: z.enum(["ONGOING", "COMPLETED", "HIATUS"]),
  hidden: z.boolean(),
  featured: z.boolean(),
  /** Moderation: drop an uploaded cover and fall back to the preset artwork. */
  removeCoverImage: z.boolean().default(false),
});
export const visibilityInput = baseInput.extend({ hidden: z.boolean() });
export const sessionInput = baseInput;
export const banInput = baseInput.extend({ banned: z.boolean() });

export async function administrativeWrite<T>(
  db: Database,
  actor: Actor,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  requireReviewer(actor);
  return db.$transaction(async (tx) => {
    // Serialize role changes with other administrative writes and re-read authority.
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(7340921)`;
    const current = await tx.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        name: true,
        role: true,
        emailVerified: true,
        banned: true,
      },
    });
    if (!current || current.banned)
      throw new DomainError("FORBIDDEN", "Yönetici yetkin bulunmuyor.");
    requireReviewer(current);
    return work(tx);
  });
}

export async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  targetId: string,
  reason: string,
  change: object,
) {
  await tx.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      actorId: actor.id,
      action,
      targetId,
      detail: JSON.stringify({ reason, ...change }),
    },
  });
}

export async function updateUser(
  db: Database,
  actor: Actor,
  raw: z.input<typeof userInput>,
) {
  const input = userInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        name: true,
        role: true,
        emailVerified: true,
        banned: true,
      },
    });
    if (!target) throw new DomainError("NOT_FOUND", "Kullanıcı bulunamadı.");
    if (target.banned && input.role === "admin" && target.role !== "admin")
      throw new DomainError(
        "USER_BANNED",
        "Yönetici yetkisi vermeden önce kullanıcının banını kaldır.",
      );
    if (target.id === actor.id && input.role !== "admin")
      throw new DomainError(
        "SELF_DEMOTION",
        "Kendi yönetici yetkini kaldıramazsın.",
      );
    if (input.role === "admin" && !target.emailVerified)
      throw new DomainError(
        "EMAIL_UNVERIFIED",
        "Yönetici olacak kullanıcı önce e-posta adresini doğrulamalı.",
      );
    if (
      target.role === "admin" &&
      target.emailVerified &&
      !target.banned &&
      input.role !== "admin" &&
      (await tx.user.count({
        where: { role: "admin", emailVerified: true, banned: false },
      })) <= 1
    ) {
      throw new DomainError(
        "LAST_ADMIN",
        "Son yöneticinin yetkisi kaldırılamaz.",
      );
    }
    await tx.user.update({
      where: { id: target.id },
      data: { name: input.name, role: input.role, updatedAt: new Date() },
    });
    if (target.role !== input.role)
      await tx.session.deleteMany({ where: { userId: target.id } });
    await audit(tx, actor, "ADMIN_USER_UPDATED", target.id, input.reason, {
      before: { name: target.name, role: target.role },
      after: { name: input.name, role: input.role },
    });
  });
}

export async function revokeUserSessions(
  db: Database,
  actor: Actor,
  raw: z.input<typeof sessionInput>,
) {
  const input = sessionInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    if (
      !(await tx.user.findUnique({
        where: { id: input.id },
        select: { id: true },
      }))
    )
      throw new DomainError("NOT_FOUND", "Kullanıcı bulunamadı.");
    const result = await tx.session.deleteMany({ where: { userId: input.id } });
    await audit(tx, actor, "ADMIN_SESSIONS_REVOKED", input.id, input.reason, {
      count: result.count,
    });
    return result.count;
  });
}

export async function setUserBan(
  db: Database,
  actor: Actor,
  raw: z.input<typeof banInput>,
) {
  const input = banInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    if (input.id === actor.id)
      throw new DomainError("SELF_BAN", "Kendi hesabını banlayamazsın.");
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${input.id} FOR UPDATE`;
    const target = await tx.user.findUnique({
      where: { id: input.id },
      select: { banned: true, role: true, emailVerified: true },
    });
    if (!target) throw new DomainError("NOT_FOUND", "Kullanıcı bulunamadı.");
    if (
      input.banned &&
      !target.banned &&
      target.role === "admin" &&
      target.emailVerified &&
      (await tx.user.count({
        where: { role: "admin", emailVerified: true, banned: false },
      })) <= 1
    )
      throw new DomainError("LAST_ADMIN", "Son aktif yönetici banlanamaz.");
    await tx.user.update({
      where: { id: input.id },
      data: {
        banned: input.banned,
        banReason: input.banned ? input.reason : "",
        bannedAt: input.banned ? new Date() : null,
        updatedAt: new Date(),
      },
    });
    // Also discard old sessions on unban: the user must sign in again.
    await tx.session.deleteMany({ where: { userId: input.id } });
    await audit(
      tx,
      actor,
      input.banned ? "ADMIN_USER_BANNED" : "ADMIN_USER_UNBANNED",
      input.id,
      input.reason,
      {
        before: { banned: target.banned },
        after: { banned: input.banned },
      },
    );
  });
}

export async function updateBook(
  db: Database,
  actor: Actor,
  raw: z.input<typeof bookUpdateInput>,
) {
  const input = bookUpdateInput.parse(raw);
  const removedPublicId = await administrativeWrite(db, actor, async (tx) => {
    // Use the same book lock/order as publishing; do not bypass publication/premium approval.
    await tx.$queryRaw`SELECT id FROM books WHERE id = ${input.id} FOR UPDATE`;
    const book = await tx.book.findUnique({ where: { id: input.id } });
    if (!book) throw new DomainError("NOT_FOUND", "Kitap bulunamadı.");
    if (input.featured && (book.status !== "PUBLISHED" || input.hidden))
      throw new DomainError(
        "NOT_PUBLIC",
        "Vitrine yalnız görünür ve yayındaki kitaplar eklenebilir.",
      );
    const { id, reason, removeCoverImage, ...data } = input;
    const dropCover = removeCoverImage && Boolean(book.coverUrl);
    await tx.book.update({
      where: { id },
      data: {
        ...data,
        ...(dropCover && { coverUrl: null, coverPublicId: null }),
        updatedAt: new Date(),
      },
    });
    await audit(tx, actor, "ADMIN_BOOK_UPDATED", id, reason, {
      before: {
        title: book.title,
        description: book.description,
        genre: book.genre,
        storyStatus: book.storyStatus,
        hidden: book.hidden,
        featured: book.featured,
        ...(dropCover && { coverUrl: book.coverUrl }),
      },
      after: { ...data, ...(dropCover && { coverRemoved: true }) },
    });
    return dropCover ? book.coverPublicId : null;
  });
  await deleteImage(removedPublicId);
}

export async function setChapterVisibility(
  db: Database,
  actor: Actor,
  raw: z.input<typeof visibilityInput>,
) {
  const input = visibilityInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    const reference = await tx.chapter.findUnique({
      where: { id: input.id },
      select: { bookId: true },
    });
    if (!reference) throw new DomainError("NOT_FOUND", "Bölüm bulunamadı.");
    await tx.$queryRaw`SELECT id FROM books WHERE id = ${reference.bookId} FOR UPDATE`;
    const chapter = await tx.chapter.findUniqueOrThrow({
      where: { id: input.id },
      select: { hidden: true },
    });
    await tx.chapter.update({
      where: { id: input.id },
      data: { hidden: input.hidden, updatedAt: new Date() },
    });
    await audit(tx, actor, "ADMIN_CHAPTER_VISIBILITY", input.id, input.reason, {
      before: chapter.hidden,
      after: input.hidden,
      bookId: reference.bookId,
    });
  });
}

export async function setCommentVisibility(
  db: Database,
  actor: Actor,
  raw: z.input<typeof visibilityInput>,
) {
  const input = visibilityInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    const comment = await tx.comment.findUnique({
      where: { id: input.id },
      select: { hidden: true, bookId: true },
    });
    if (!comment) throw new DomainError("NOT_FOUND", "Yorum bulunamadı.");
    await tx.comment.update({
      where: { id: input.id },
      data: { hidden: input.hidden },
    });
    await audit(tx, actor, "ADMIN_COMMENT_VISIBILITY", input.id, input.reason, {
      before: comment.hidden,
      after: input.hidden,
      bookId: comment.bookId,
    });
  });
}
