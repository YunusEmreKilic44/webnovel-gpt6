"use server";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/db";
import { CATALOG_TAG } from "@/modules/catalog/queries";
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
    const book = await db.book.findFirst({
      where: { id: bookId, status: "PUBLISHED", hidden: false },
    });
    if (!book) throw new DomainError("NOT_FOUND", "Kitap bulunamadı.");
    if (["rate", "comment"].includes(intent)) requireVerified(actor);
    // Keep the rate-limit increment atomic across concurrent requests.
    const [limit] = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits (key, count) VALUES (${actor.id + ":" + intent}, 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.window_start < now() - interval '1 minute' THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE WHEN rate_limits.window_start < now() - interval '1 minute' THEN now() ELSE rate_limits.window_start END
      RETURNING count
    `;
    if (limit.count > (intent === "comment" ? 5 : 40))
      throw new DomainError(
        "RATE_LIMIT",
        "Biraz hızlı ilerliyorsun. Bir dakika sonra tekrar dene.",
      );
    const userId_bookId = { userId: actor.id, bookId };
    if (intent === "save")
      await db.libraryEntry.upsert({
        where: { userId_bookId },
        create: { id: crypto.randomUUID(), ...userId_bookId },
        update: {},
      });
    if (intent === "unsave")
      await db.libraryEntry.deleteMany({ where: userId_bookId });
    if (intent === "rate") {
      if (book.authorId === actor.id)
        throw new DomainError("SELF_RATING", "Kendi kitabına puan veremezsin.");
      const score = z.coerce
        .number()
        .int()
        .min(1)
        .max(5)
        .parse(form.get("score"));
      await db.rating.upsert({
        where: { userId_bookId },
        create: { id: crypto.randomUUID(), ...userId_bookId, score },
        update: { score },
      });
    }
    if (intent === "comment") {
      const body = z
        .string()
        .trim()
        .min(3, "Yorum en az 3 karakter olmalı.")
        .max(2000)
        .parse(form.get("body"));
      await db.comment.create({
        data: {
          id: crypto.randomUUID(),
          ...userId_bookId,
          body,
          spoiler: form.get("spoiler") === "on",
        },
      });
    }
    if (intent === "progress") {
      const chapterId = String(form.get("chapterId"));
      const chapter = await db.chapter.findFirst({
        where: { id: chapterId, bookId },
        select: { status: true, hidden: true, accessType: true },
      });
      if (!chapter || !canReadPublic(book, chapter))
        throw new DomainError("FORBIDDEN", "Bu bölüme erişimin yok.");
      await db.readingProgress.upsert({
        where: { userId_bookId },
        create: { id: crypto.randomUUID(), ...userId_bookId, chapterId },
        update: { chapterId, updatedAt: new Date() },
      });
    }
    updateTag(CATALOG_TAG);
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
