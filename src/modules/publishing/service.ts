import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db";
import {
  applications,
  auditLogs,
  books,
  chapterRevisions,
  chapters,
  volumes,
  type Actor,
} from "@/db/schema";
import { emptyContent, parseContent, wordCount } from "./content";
import {
  DomainError,
  requireOwner,
  requirePaidEligibility,
  requireReviewer,
  requireVerified,
} from "./policies";
import { slugify } from "@/lib/utils";

export const bookInput = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Kitap adı en az 3 karakter olmalı.")
    .max(100),
  description: z
    .string()
    .trim()
    .min(30, "Özet en az 30 karakter olmalı.")
    .max(3000),
  genre: z.enum([
    "Fantastik",
    "Bilim Kurgu",
    "Romantik",
    "Gizem",
    "Macera",
    "Dram",
  ]),
  cover: z.enum(["ember", "ocean", "forest", "violet", "sand", "rose"]),
});
const titleInput = z
  .string()
  .trim()
  .min(2, "Başlık en az 2 karakter olmalı.")
  .max(120);
const id = () => crypto.randomUUID();

export async function createBook(
  db: Database,
  actor: Actor,
  input: z.infer<typeof bookInput>,
) {
  requireVerified(actor);
  const data = bookInput.parse(input);
  const bookId = id();
  await db.transaction(async (tx) => {
    await tx.insert(books).values({
      id: bookId,
      authorId: actor.id,
      ...data,
      slug: `${slugify(data.title)}-${bookId.slice(0, 8)}`,
    });
    const volumeId = id();
    await tx
      .insert(volumes)
      .values({ id: volumeId, bookId, title: "Birinci Cilt", position: 1 });
    await tx.insert(chapters).values({
      id: id(),
      bookId,
      volumeId,
      title: "İlk Bölüm",
      position: 1,
      content: emptyContent,
    });
    await tx.insert(auditLogs).values({
      id: id(),
      actorId: actor.id,
      targetId: bookId,
      action: "book.created",
    });
  });
  return bookId;
}

export async function addVolume(
  db: Database,
  actor: Actor,
  bookId: string,
  title: string,
) {
  requireVerified(actor);
  const name = titleInput.parse(title);
  await db.transaction(async (tx) => {
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .for("update");
    if (!book) throw new DomainError("NOT_FOUND", "Kitap bulunamadı.");
    requireOwner(actor, book);
    const existing = await tx
      .select({ position: volumes.position })
      .from(volumes)
      .where(eq(volumes.bookId, bookId));
    await tx.insert(volumes).values({
      id: id(),
      bookId,
      title: name,
      position: Math.max(0, ...existing.map((v) => v.position)) + 1,
    });
  });
}
export async function addChapter(
  db: Database,
  actor: Actor,
  bookId: string,
  volumeId: string,
  title: string,
) {
  requireVerified(actor);
  const name = titleInput.parse(title);
  const chapterId = id();
  await db.transaction(async (tx) => {
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .for("update");
    if (!book) throw new DomainError("NOT_FOUND", "Kitap bulunamadı.");
    requireOwner(actor, book);
    const [volume] = await tx
      .select()
      .from(volumes)
      .where(and(eq(volumes.id, volumeId), eq(volumes.bookId, bookId)));
    if (!volume)
      throw new DomainError("NOT_FOUND", "Cilt bu kitaba ait değil.");
    const existing = await tx
      .select({ position: chapters.position })
      .from(chapters)
      .where(eq(chapters.volumeId, volumeId));
    await tx.insert(chapters).values({
      id: chapterId,
      bookId,
      volumeId,
      title: name,
      position: Math.max(0, ...existing.map((c) => c.position)) + 1,
      content: emptyContent,
    });
  });
  return chapterId;
}
export async function saveChapter(
  db: Database,
  actor: Actor,
  input: {
    chapterId: string;
    title: string;
    rawContent: string;
    expectedVersion: number;
  },
) {
  requireVerified(actor);
  const title = titleInput.parse(input.title);
  const content = parseContent(input.rawContent);
  return db.transaction(async (tx) => {
    const [chapter] = await tx
      .select()
      .from(chapters)
      .where(eq(chapters.id, input.chapterId));
    if (!chapter) throw new DomainError("NOT_FOUND", "Bölüm bulunamadı.");
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, chapter.bookId))
      .for("update");
    requireOwner(actor, book);
    const nextVersion = input.expectedVersion + 1;
    const updated = await tx
      .update(chapters)
      .set({
        title,
        content,
        wordCount: wordCount(content),
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(chapters.id, chapter.id),
          eq(chapters.version, input.expectedVersion),
        ),
      )
      .returning({ version: chapters.version });
    if (!updated.length)
      throw new DomainError(
        "REVISION_CONFLICT",
        "Bu bölüm başka bir sekmede değiştirildi. Metnini kopyalayıp sayfayı yenile.",
      );
    await tx.insert(chapterRevisions).values({
      id: id(),
      chapterId: chapter.id,
      title,
      content,
      version: nextVersion,
    });
    return nextVersion;
  });
}

export async function submitApplication(
  db: Database,
  actor: Actor,
  bookId: string,
  type: "PUBLICATION" | "PREMIUM",
) {
  requireVerified(actor);
  z.enum(["PUBLICATION", "PREMIUM"]).parse(type);
  await db.transaction(async (tx) => {
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .for("update");
    if (!book) throw new DomainError("NOT_FOUND", "Kitap bulunamadı.");
    requireOwner(actor, book);
    if (book.hidden || book.status === "ARCHIVED")
      throw new DomainError("UNAVAILABLE", "Bu kitap için başvuru yapılamaz.");
    if (type === "PUBLICATION" && book.status !== "DRAFT")
      throw new DomainError(
        "ALREADY_APPROVED",
        "Kitabın yayın onayı zaten var.",
      );
    if (
      type === "PREMIUM" &&
      (book.status !== "PUBLISHED" || book.premiumStatus === "ACTIVE")
    )
      throw new DomainError(
        "NOT_ELIGIBLE",
        "Premium başvurusu için kitabın yayında olmalı ve aktif premium yetkisi bulunmamalı.",
      );
    const pending = await tx
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.bookId, bookId),
          eq(applications.type, type),
          eq(applications.status, "PENDING"),
        ),
      );
    if (pending.length)
      throw new DomainError(
        "ALREADY_PENDING",
        "Bu türde bir başvurun zaten inceleniyor.",
      );
    const samples = await tx
      .select()
      .from(chapters)
      .where(eq(chapters.bookId, bookId))
      .orderBy(chapters.createdAt);
    const complete = samples
      .filter((c) => wordCount(c.content) >= 30)
      .slice(0, 3);
    if (!complete.length)
      throw new DomainError(
        "SAMPLE_REQUIRED",
        "En az 30 kelimelik bir örnek bölüm kaydetmelisin.",
      );
    await tx.insert(applications).values({
      id: id(),
      bookId,
      type,
      snapshot: {
        title: book.title,
        description: book.description,
        genre: book.genre,
        chapters: complete.map((c) => ({
          id: c.id,
          title: c.title,
          version: c.version,
          content: c.content,
        })),
      },
    });
    await tx.insert(auditLogs).values({
      id: id(),
      actorId: actor.id,
      targetId: bookId,
      action: `application.${type.toLowerCase()}.submitted`,
    });
  });
}

export async function reviewApplication(
  db: Database,
  actor: Actor,
  applicationId: string,
  decision: "APPROVED" | "REJECTED",
  note: string,
) {
  z.enum(["APPROVED", "REJECTED"]).parse(decision);
  const reason = z
    .string()
    .trim()
    .min(5, "En az 5 karakterlik bir karar notu ekle.")
    .max(2000)
    .parse(note);
  await db.transaction(async (tx) => {
    const [reference] = await tx
      .select({ bookId: applications.bookId })
      .from(applications)
      .where(eq(applications.id, applicationId));
    if (!reference) throw new DomainError("NOT_FOUND", "Başvuru bulunamadı.");
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, reference.bookId))
      .for("update");
    requireReviewer(actor, book);
    const [application] = await tx
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .for("update");
    if (application.status !== "PENDING")
      throw new DomainError(
        "ALREADY_REVIEWED",
        "Başvuru daha önce değerlendirildi.",
      );
    if (decision === "APPROVED") {
      if (book.hidden || book.status === "ARCHIVED")
        throw new DomainError(
          "UNAVAILABLE",
          "Kitap artık inceleme için uygun değil.",
        );
      if (application.type === "PUBLICATION") {
        if (book.status !== "DRAFT")
          throw new DomainError("CONFLICT", "Kitabın durumu değişmiş.");
        await tx
          .update(books)
          .set({ status: "APPROVED", updatedAt: new Date() })
          .where(eq(books.id, book.id));
      } else {
        if (book.status !== "PUBLISHED")
          throw new DomainError("NOT_PUBLISHED", "Kitap yayında olmalı.");
        await tx
          .update(books)
          .set({
            premiumStatus: "ACTIVE",
            firstPremiumApprovedAt:
              book.firstPremiumApprovedAt ?? sql`clock_timestamp()`,
            updatedAt: new Date(),
          })
          .where(eq(books.id, book.id));
      }
    }
    await tx
      .update(applications)
      .set({
        status: decision,
        note: reason,
        reviewerId: actor.id,
        reviewedAt: new Date(),
      })
      .where(eq(applications.id, application.id));
    await tx.insert(auditLogs).values({
      id: id(),
      actorId: actor.id,
      targetId: application.id,
      action: `application.${decision.toLowerCase()}`,
      detail: reason,
    });
  });
}

export async function publishChapter(
  db: Database,
  actor: Actor,
  chapterId: string,
  expectedVersion: number,
) {
  requireVerified(actor);
  await db.transaction(async (tx) => {
    const [reference] = await tx
      .select({ bookId: chapters.bookId })
      .from(chapters)
      .where(eq(chapters.id, chapterId));
    if (!reference) throw new DomainError("NOT_FOUND", "Bölüm bulunamadı.");
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, reference.bookId))
      .for("update");
    requireOwner(actor, book);
    if (!["APPROVED", "PUBLISHED"].includes(book.status) || book.hidden)
      throw new DomainError(
        "NOT_APPROVED",
        "Kitabın yayın başvurusu henüz onaylanmadı.",
      );
    const [chapter] = await tx
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .for("update");
    if (chapter.version !== expectedVersion)
      throw new DomainError(
        "REVISION_CONFLICT",
        "Bölüm değişti. Sayfayı yenileyip tekrar dene.",
      );
    if (book.status === "PUBLISHED" && wordCount(chapter.content) < 30)
      throw new DomainError(
        "TOO_SHORT",
        "Yayınlamak için en az 30 kelime yazmalısın.",
      );
    if (chapter.hidden)
      throw new DomainError("HIDDEN", "Gizlenmiş bölüm yayımlanamaz.");
    let publication = {
      title: chapter.title,
      content: chapter.content,
      wordCount: chapter.wordCount,
    };
    if (book.status === "APPROVED") {
      const approved = await tx
        .select()
        .from(applications)
        .where(
          and(
            eq(applications.bookId, book.id),
            eq(applications.type, "PUBLICATION"),
            eq(applications.status, "APPROVED"),
          ),
        );
      const reviewed = approved
        .flatMap((a) => a.snapshot.chapters)
        .find((c) => c.id === chapter.id);
      if (!reviewed)
        throw new DomainError(
          "APPROVED_REVISION_REQUIRED",
          "İlk yayın için incelemeye gönderdiğin örnek bölümlerden birini seçmelisin.",
        );
      publication = {
        title: reviewed.title,
        content: reviewed.content,
        wordCount: wordCount(reviewed.content),
      };
    }
    await tx
      .update(chapters)
      .set({
        status: "PUBLISHED",
        publishedContent: publication.content,
        publishedTitle: publication.title,
        publishedWordCount: publication.wordCount,
        firstPublishedAt: chapter.firstPublishedAt ?? sql`clock_timestamp()`,
        updatedAt: new Date(),
      })
      .where(eq(chapters.id, chapterId));
    await tx
      .update(books)
      .set({ status: "PUBLISHED", updatedAt: new Date() })
      .where(eq(books.id, book.id));
    await tx.insert(auditLogs).values({
      id: id(),
      actorId: actor.id,
      targetId: chapterId,
      action: "chapter.published",
    });
  });
}

export async function setChapterPrice(
  db: Database,
  actor: Actor,
  chapterId: string,
  priceMinor: number,
) {
  requireVerified(actor);
  z.number().int().min(0).max(100_000).parse(priceMinor);
  await db.transaction(async (tx) => {
    const [reference] = await tx
      .select({ bookId: chapters.bookId })
      .from(chapters)
      .where(eq(chapters.id, chapterId));
    if (!reference) throw new DomainError("NOT_FOUND", "Bölüm bulunamadı.");
    const [book] = await tx
      .select()
      .from(books)
      .where(eq(books.id, reference.bookId))
      .for("update");
    requireOwner(actor, book);
    const [chapter] = await tx
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .for("update");
    if (priceMinor > 0) requirePaidEligibility(book, chapter);
    await tx
      .update(chapters)
      .set({ accessType: priceMinor > 0 ? "PAID" : "FREE", priceMinor })
      .where(eq(chapters.id, chapterId));
    await tx.insert(auditLogs).values({
      id: id(),
      actorId: actor.id,
      targetId: chapterId,
      action: "chapter.price_changed",
      detail: String(priceMinor),
    });
  });
}
