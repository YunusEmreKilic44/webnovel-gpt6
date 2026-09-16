"use server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  books,
  comments,
  libraryEntries,
  ratings,
  rateLimits,
  readingProgress,
  chapters,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  canReadPublic,
  DomainError,
  requireVerified,
} from "@/modules/publishing/policies";
import type { ActionState } from "@/lib/action-state";

export async function interactAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Önce hesabına giriş yapmalısın." };
  try {
    const bookId = z.string().min(1).parse(form.get("bookId"));
    const intent = z
      .enum(["save", "unsave", "rate", "comment", "progress"])
      .parse(form.get("intent"));
    const db = getDb();
    const [book] = await db
      .select()
      .from(books)
      .where(
        and(
          eq(books.id, bookId),
          eq(books.status, "PUBLISHED"),
          eq(books.hidden, false),
        ),
      );
    if (!book) throw new DomainError("NOT_FOUND", "Kitap bulunamadı.");
    if (["rate", "comment"].includes(intent)) requireVerified(actor);
    const [limit] = await db
      .insert(rateLimits)
      .values({ key: `${actor.id}:${intent}`, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.windowStart} < now() - interval '1 minute' THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStart: sql`CASE WHEN ${rateLimits.windowStart} < now() - interval '1 minute' THEN now() ELSE ${rateLimits.windowStart} END`,
        },
      })
      .returning();
    if (limit.count > (intent === "comment" ? 5 : 40))
      throw new DomainError(
        "RATE_LIMIT",
        "Biraz hızlı ilerliyorsun. Bir dakika sonra tekrar dene.",
      );
    if (intent === "save")
      await db
        .insert(libraryEntries)
        .values({ id: crypto.randomUUID(), userId: actor.id, bookId })
        .onConflictDoNothing();
    if (intent === "unsave")
      await db
        .delete(libraryEntries)
        .where(
          and(
            eq(libraryEntries.userId, actor.id),
            eq(libraryEntries.bookId, bookId),
          ),
        );
    if (intent === "rate") {
      if (book.authorId === actor.id)
        throw new DomainError("SELF_RATING", "Kendi kitabına puan veremezsin.");
      const score = z.coerce
        .number()
        .int()
        .min(1)
        .max(5)
        .parse(form.get("score"));
      await db
        .insert(ratings)
        .values({ id: crypto.randomUUID(), userId: actor.id, bookId, score })
        .onConflictDoUpdate({
          target: [ratings.userId, ratings.bookId],
          set: { score },
        });
    }
    if (intent === "comment") {
      const body = z
        .string()
        .trim()
        .min(3, "Yorum en az 3 karakter olmalı.")
        .max(2000)
        .parse(form.get("body"));
      await db.insert(comments).values({
        id: crypto.randomUUID(),
        userId: actor.id,
        bookId,
        body,
        spoiler: form.get("spoiler") === "on",
      });
    }
    if (intent === "progress") {
      const chapterId = String(form.get("chapterId"));
      const [chapter] = await db
        .select({
          status: chapters.status,
          hidden: chapters.hidden,
          accessType: chapters.accessType,
        })
        .from(chapters)
        .where(and(eq(chapters.id, chapterId), eq(chapters.bookId, bookId)));
      if (!chapter || !canReadPublic(book, chapter))
        throw new DomainError("FORBIDDEN", "Bu bölüme erişimin yok.");
      await db
        .insert(readingProgress)
        .values({
          id: crypto.randomUUID(),
          userId: actor.id,
          bookId,
          chapterId,
        })
        .onConflictDoUpdate({
          target: [readingProgress.userId, readingProgress.bookId],
          set: { chapterId, updatedAt: new Date() },
        });
    }
    revalidatePath("/", "layout");
    const messages = {
      save: "Kütüphanene eklendi.",
      unsave: "Kütüphanenden kaldırıldı.",
      rate: "Puanın kaydedildi.",
      comment: "Yorumun paylaşıldı.",
      progress: "Okuma konumun kaydedildi.",
    };
    return { ok: true, message: messages[intent], nonce: crypto.randomUUID() };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof DomainError
          ? error.message
          : error instanceof z.ZodError
            ? error.issues[0].message
            : "İşlem tamamlanamadı. Tekrar dene.",
    };
  }
}
