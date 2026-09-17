import { z } from "zod";
import type { JSONContent } from "@tiptap/react";
import type { Database } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor, ApplicationSnapshot } from "@/db/schema";
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
const json = (value: JSONContent | ApplicationSnapshot) =>
  value as Prisma.InputJsonValue;
type Transaction = Prisma.TransactionClient;

// All publishing mutations acquire the book lock first, including revision writes.
async function lockBook(tx: Transaction, bookId: string) {
  await tx.$queryRaw`SELECT id FROM books WHERE id = ${bookId} FOR UPDATE`;
  const book = await tx.book.findUnique({ where: { id: bookId } });
  if (!book) throw new DomainError("NOT_FOUND", "Kitap bulunamadı.");
  return book;
}
async function chapterBook(tx: Transaction, chapterId: string) {
  const reference = await tx.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true },
  });
  if (!reference) throw new DomainError("NOT_FOUND", "Bölüm bulunamadı.");
  return lockBook(tx, reference.bookId);
}
async function databaseTime(tx: Transaction) {
  const [row] = await tx.$queryRaw<
    { at: Date }[]
  >`SELECT clock_timestamp() AS at`;
  return row.at;
}

export async function createBook(
  db: Database,
  actor: Actor,
  input: z.infer<typeof bookInput>,
) {
  requireVerified(actor);
  const data = bookInput.parse(input);
  const bookId = id();
  await db.$transaction(async (tx) => {
    await tx.book.create({
      data: {
        id: bookId,
        authorId: actor.id,
        ...data,
        slug: `${slugify(data.title)}-${bookId.slice(0, 8)}`,
      },
    });
    const volumeId = id();
    await tx.volume.create({
      data: { id: volumeId, bookId, title: "Birinci Cilt", position: 1 },
    });
    await tx.chapter.create({
      data: {
        id: id(),
        bookId,
        volumeId,
        title: "İlk Bölüm",
        position: 1,
        content: json(emptyContent),
      },
    });
    await tx.auditLog.create({
      data: {
        id: id(),
        actorId: actor.id,
        targetId: bookId,
        action: "book.created",
      },
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
  await db.$transaction(async (tx) => {
    const book = await lockBook(tx, bookId);
    requireOwner(actor, book);
    const last = await tx.volume.aggregate({
      where: { bookId },
      _max: { position: true },
    });
    await tx.volume.create({
      data: {
        id: id(),
        bookId,
        title: name,
        position: (last._max.position ?? 0) + 1,
      },
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
  await db.$transaction(async (tx) => {
    const book = await lockBook(tx, bookId);
    requireOwner(actor, book);
    const volume = await tx.volume.findFirst({
      where: { id: volumeId, bookId },
    });
    if (!volume)
      throw new DomainError("NOT_FOUND", "Cilt bu kitaba ait değil.");
    const last = await tx.chapter.aggregate({
      where: { volumeId },
      _max: { position: true },
    });
    await tx.chapter.create({
      data: {
        id: chapterId,
        bookId,
        volumeId,
        title: name,
        position: (last._max.position ?? 0) + 1,
        content: json(emptyContent),
      },
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
  return db.$transaction(async (tx) => {
    const book = await chapterBook(tx, input.chapterId);
    requireOwner(actor, book);
    const nextVersion = input.expectedVersion + 1;
    const updated = await tx.chapter.updateMany({
      where: { id: input.chapterId, version: input.expectedVersion },
      data: {
        title,
        content: json(content),
        wordCount: wordCount(content),
        version: nextVersion,
        updatedAt: new Date(),
      },
    });
    if (!updated.count)
      throw new DomainError(
        "REVISION_CONFLICT",
        "Bu bölüm başka bir sekmede değiştirildi. Metnini kopyalayıp sayfayı yenile.",
      );
    await tx.chapterRevision.create({
      data: {
        id: id(),
        chapterId: input.chapterId,
        title,
        content: json(content),
        version: nextVersion,
      },
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
  await db.$transaction(async (tx) => {
    const book = await lockBook(tx, bookId);
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
    if (
      await tx.application.count({ where: { bookId, type, status: "PENDING" } })
    )
      throw new DomainError(
        "ALREADY_PENDING",
        "Bu türde bir başvurun zaten inceleniyor.",
      );
    const samples = await tx.chapter.findMany({
      where: { bookId },
      orderBy: { createdAt: "asc" },
    });
    const complete = samples
      .filter((c) => wordCount(c.content as JSONContent) >= 30)
      .slice(0, 3);
    if (!complete.length)
      throw new DomainError(
        "SAMPLE_REQUIRED",
        "En az 30 kelimelik bir örnek bölüm kaydetmelisin.",
      );
    await tx.application.create({
      data: {
        id: id(),
        bookId,
        type,
        snapshot: json({
          title: book.title,
          description: book.description,
          genre: book.genre,
          chapters: complete.map((c) => ({
            id: c.id,
            title: c.title,
            version: c.version,
            content: c.content as JSONContent,
          })),
        }),
      },
    });
    await tx.auditLog.create({
      data: {
        id: id(),
        actorId: actor.id,
        targetId: bookId,
        action: `application.${type.toLowerCase()}.submitted`,
      },
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
  await db.$transaction(async (tx) => {
    const reference = await tx.application.findUnique({
      where: { id: applicationId },
      select: { bookId: true },
    });
    if (!reference) throw new DomainError("NOT_FOUND", "Başvuru bulunamadı.");
    const book = await lockBook(tx, reference.bookId);
    requireReviewer(actor);
    const application = await tx.application.findUniqueOrThrow({
      where: { id: applicationId },
    });
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
        const samples = (application.snapshot as ApplicationSnapshot).chapters;
        const chapters = await tx.chapter.findMany({
          where: { bookId: book.id, id: { in: samples.map((c) => c.id) } },
        });
        if (
          !samples.length ||
          chapters.length !== samples.length ||
          chapters.some((c) => c.hidden || c.status !== "DRAFT")
        )
          throw new DomainError(
            "UNAVAILABLE",
            "İncelenen bölümler artık yayın için uygun değil.",
          );
        const publishedAt = await databaseTime(tx);
        // Publish the reviewed snapshot, leaving newer author drafts untouched.
        for (const sample of samples) {
          const chapter = chapters.find((c) => c.id === sample.id)!;
          await tx.chapter.update({
            where: { id: chapter.id },
            data: {
              status: "PUBLISHED",
              publishedContent: json(sample.content),
              publishedTitle: sample.title,
              publishedWordCount: wordCount(sample.content),
              ...(chapter.firstPublishedAt
                ? {}
                : { firstPublishedAt: publishedAt }),
              updatedAt: publishedAt,
            },
          });
          await tx.auditLog.create({
            data: {
              id: id(),
              actorId: actor.id,
              targetId: chapter.id,
              action: "chapter.published",
              detail: `publication.approved:${application.id}`,
            },
          });
        }
        await tx.book.update({
          where: { id: book.id },
          data: { status: "PUBLISHED", updatedAt: publishedAt },
        });
      } else {
        if (book.status !== "PUBLISHED")
          throw new DomainError("NOT_PUBLISHED", "Kitap yayında olmalı.");
        await tx.book.update({
          where: { id: book.id },
          data: {
            premiumStatus: "ACTIVE",
            ...(book.firstPremiumApprovedAt
              ? {}
              : { firstPremiumApprovedAt: await databaseTime(tx) }),
            updatedAt: new Date(),
          },
        });
      }
    }
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status: decision,
        note: reason,
        reviewerId: actor.id,
        reviewedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        id: id(),
        actorId: actor.id,
        targetId: applicationId,
        action: `application.${decision.toLowerCase()}`,
        detail: reason,
      },
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
  await db.$transaction(async (tx) => {
    const book = await chapterBook(tx, chapterId);
    requireOwner(actor, book);
    if (!["APPROVED", "PUBLISHED"].includes(book.status) || book.hidden)
      throw new DomainError(
        "NOT_APPROVED",
        "Kitabın yayın başvurusu henüz onaylanmadı.",
      );
    const chapter = await tx.chapter.findUniqueOrThrow({
      where: { id: chapterId },
    });
    if (chapter.version !== expectedVersion)
      throw new DomainError(
        "REVISION_CONFLICT",
        "Bölüm değişti. Sayfayı yenileyip tekrar dene.",
      );
    if (
      book.status === "PUBLISHED" &&
      wordCount(chapter.content as JSONContent) < 30
    )
      throw new DomainError(
        "TOO_SHORT",
        "Yayınlamak için en az 30 kelime yazmalısın.",
      );
    if (chapter.hidden)
      throw new DomainError("HIDDEN", "Gizlenmiş bölüm yayımlanamaz.");
    let publication = {
      title: chapter.title,
      content: chapter.content as JSONContent,
      wordCount: chapter.wordCount,
    };
    if (book.status === "APPROVED") {
      const approved = await tx.application.findMany({
        where: { bookId: book.id, type: "PUBLICATION", status: "APPROVED" },
      });
      const reviewed = approved
        .flatMap((a) => (a.snapshot as ApplicationSnapshot).chapters)
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
    await tx.chapter.update({
      where: { id: chapterId },
      data: {
        status: "PUBLISHED",
        publishedContent: json(publication.content),
        publishedTitle: publication.title,
        publishedWordCount: publication.wordCount,
        ...(chapter.firstPublishedAt
          ? {}
          : { firstPublishedAt: await databaseTime(tx) }),
        updatedAt: new Date(),
      },
    });
    await tx.book.update({
      where: { id: book.id },
      data: { status: "PUBLISHED", updatedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        id: id(),
        actorId: actor.id,
        targetId: chapterId,
        action: "chapter.published",
      },
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
  await db.$transaction(async (tx) => {
    const book = await chapterBook(tx, chapterId);
    requireOwner(actor, book);
    const chapter = await tx.chapter.findUniqueOrThrow({
      where: { id: chapterId },
    });
    if (priceMinor > 0) requirePaidEligibility(book, chapter);
    await tx.chapter.update({
      where: { id: chapterId },
      data: { accessType: priceMinor > 0 ? "PAID" : "FREE", priceMinor },
    });
    await tx.auditLog.create({
      data: {
        id: id(),
        actorId: actor.id,
        targetId: chapterId,
        action: "chapter.price_changed",
        detail: String(priceMinor),
      },
    });
  });
}
