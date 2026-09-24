import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser, requireUser } from "@/lib/session";
import { recordChapterRead } from "@/modules/analytics/service";
import {
  getAuthorBookStats,
  getAuthorChapterStats,
  getPublicReadCount,
} from "@/modules/analytics/queries";
import { POST } from "@/app/api/chapters/[chapterId]/read/route";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/session", () => ({
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const author = {
  id: "writer",
  name: "Yazar",
  email: "writer@example.test",
  emailVerified: true,
  role: "reader",
  avatarUrl: null,
  coinBalance: 0,
};
const content = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Yayımlanan metin." }],
    },
  ],
};

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  await db.user.createMany({
    data: [author, { ...author, id: "other", email: "other@example.test" }],
  });
  await db.book.createMany({
    data: [
      {
        id: "book",
        authorId: "writer",
        title: "Kitap",
        slug: "kitap",
        description: "Açıklama",
        genres: ["Fantastik"],
        status: "PUBLISHED",
      },
      {
        id: "other-book",
        authorId: "other",
        title: "Başka Kitap",
        slug: "baska",
        description: "Açıklama",
        genres: ["Fantastik"],
      },
    ],
  });
  await db.volume.createMany({
    data: [
      { id: "volume", bookId: "book", title: "Birinci Cilt", position: 1 },
      {
        id: "other-volume",
        bookId: "other-book",
        title: "Başka Cilt",
        position: 1,
      },
    ],
  });
  await db.chapter.createMany({
    data: [
      ...["first", "second", "draft", "hidden", "paid", "empty"].map(
        (id, index) => ({
          id,
          bookId: "book",
          volumeId: "volume",
          title: id,
          position: index + 1,
          content,
          publishedContent: id === "empty" ? Prisma.JsonNull : content,
          publishedTitle: id,
          firstPublishedAt: id === "draft" ? null : new Date(),
          status: id === "draft" ? "DRAFT" : "PUBLISHED",
          hidden: id === "hidden",
          accessType: id === "paid" ? "PAID" : "FREE",
        }),
      ),
      {
        id: "other-chapter",
        bookId: "other-book",
        volumeId: "other-volume",
        title: "Başka Bölüm",
        position: 1,
        content,
      },
    ],
  });
});
beforeEach(async () => {
  vi.mocked(requireUser).mockResolvedValue(author);
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  await db.chapterRead.deleteMany();
});
afterAll(close);

describe("Bölüm okunmaları", () => {
  it("aynı gün yenilemeleri ve eşzamanlı istekleri tek sayar; farklı okur ve bölümleri toplar", async () => {
    const writes = await Promise.all(
      Array.from({ length: 5 }, () =>
        recordChapterRead(db, "first", { visitorId: "guest" }),
      ),
    );
    expect(writes.reduce((sum, n) => sum + n, 0)).toBe(1);
    await recordChapterRead(db, "second", { visitorId: "guest" });
    await recordChapterRead(db, "first", { userId: "other" });
    expect(await getPublicReadCount("book")).toBe(3);
    const chapters = await getAuthorChapterStats("book");
    expect(chapters.find((c) => c.id === "first")?._count.reads).toBe(2);
    expect(chapters.find((c) => c.id === "second")?._count.reads).toBe(1);
  });

  it("önceki günün okumasını korur ve yeni günün okumasını ayrıca sayar", async () => {
    await recordChapterRead(db, "first", { visitorId: "guest" });
    await db.$executeRaw`UPDATE chapter_reads SET read_on = read_on - 8, created_at = now() - interval '8 days'`;
    await recordChapterRead(db, "first", { visitorId: "guest" });
    expect((await getAuthorBookStats())[0]).toMatchObject({
      readCount: 2,
      recentReadCount: 1,
    });
  });

  it("yazarın kendi okumalarını, eksik/taslak/gizli/kilitli bölümleri saymaz", async () => {
    expect(await recordChapterRead(db, "first", { userId: "writer" })).toBe(0);
    for (const id of [
      "missing",
      "draft",
      "hidden",
      "paid",
      "empty",
      "other-chapter",
    ]) {
      expect(await recordChapterRead(db, id, { visitorId: "guest" })).toBe(0);
    }
    expect(await getPublicReadCount("book")).toBe(0);
  });

  it("gizlenen veya yayından kaldırılan kitabın bölümlerini saymaz", async () => {
    try {
      await db.book.update({ where: { id: "book" }, data: { hidden: true } });
      expect(await recordChapterRead(db, "first", { visitorId: "guest" })).toBe(
        0,
      );
      await db.book.update({
        where: { id: "book" },
        data: { hidden: false, status: "ARCHIVED" },
      });
      expect(await recordChapterRead(db, "first", { visitorId: "guest" })).toBe(
        0,
      );
    } finally {
      await db.book.update({
        where: { id: "book" },
        data: { hidden: false, status: "PUBLISHED" },
      });
    }
  });

  it("kitap ve bölüm istatistiklerini oturum sahibine sınırlar; sıfır okumalı taslakları da gösterir", async () => {
    expect(await getAuthorBookStats()).toEqual([
      expect.objectContaining({ id: "book", readCount: 0 }),
    ]);
    expect(await getAuthorBookStats("other-book")).toEqual([]);
    expect(await getAuthorChapterStats("other-book")).toEqual([]);
    vi.mocked(requireUser).mockResolvedValue({ ...author, id: "other" });
    expect(await getAuthorBookStats()).toEqual([
      expect.objectContaining({
        id: "other-book",
        readCount: 0,
        chapterCount: 1,
      }),
    ]);
    vi.mocked(requireUser).mockRejectedValue(new Error("Giriş gerekli"));
    await expect(getAuthorBookStats()).rejects.toThrow("Giriş gerekli");
    await expect(getAuthorChapterStats("book")).rejects.toThrow(
      "Giriş gerekli",
    );
  });

  it("yorum, puan ve kütüphane istatistiklerini okuma sayısını çoğaltmadan toplar", async () => {
    await db.libraryEntry.create({
      data: { id: "library", bookId: "book", userId: "other" },
    });
    await db.rating.create({
      data: { id: "rating", bookId: "book", userId: "other", score: 4 },
    });
    await db.comment.createMany({
      data: [
        { id: "comment", bookId: "book", userId: "other", body: "Yorum" },
        {
          id: "hidden-comment",
          bookId: "book",
          userId: "other",
          body: "Gizli",
          hidden: true,
        },
      ],
    });
    await recordChapterRead(db, "first", { visitorId: "guest" });
    expect((await getAuthorBookStats())[0]).toMatchObject({
      readCount: 1,
      libraryCount: 1,
      commentCount: 1,
      ratingCount: 1,
      averageRating: 4,
    });
  });

  it("misafir çerezini oluşturur, tekrar kullanır ve başka kaynaktan gelen POST isteğini reddeder", async () => {
    const url = "http://localhost:3000/api/chapters/first/read";
    const context = { params: Promise.resolve({ chapterId: "first" }) };
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
      context,
    );
    expect(response.status).toBe(204);
    const cookie = response.cookies.get("satir-reader");
    expect(cookie?.httpOnly).toBe(true);
    await POST(
      new NextRequest(url, {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          cookie: `satir-reader=${cookie?.value}`,
        },
      }),
      context,
    );
    expect(await getPublicReadCount("book")).toBe(1);
    const forbidden = await POST(
      new NextRequest(url, {
        method: "POST",
        headers: { origin: "https://other.example" },
      }),
      context,
    );
    expect(forbidden.status).toBe(403);
    expect(await getPublicReadCount("book")).toBe(1);
  });
});
