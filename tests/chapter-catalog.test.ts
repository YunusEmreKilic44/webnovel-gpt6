import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { getDb } from "@/db";
import {
  CHAPTER_PAGE_SIZE,
  CHAPTER_PREVIEW_SIZE,
  getPublicBook,
  getPublicChapters,
} from "@/modules/catalog/queries";
import { createLocalDatabase } from "./support/database";
import { migrateLocal } from "./support/migrate";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: vi.fn() }));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const content = { type: "doc", content: [] };

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  await db.user.create({
    data: { id: "author", name: "Yazar", email: "chapters@example.test" },
  });
  for (const id of ["public", "hidden", "draft", "empty"]) {
    await db.book.create({
      data: {
        id,
        slug: id,
        title: id,
        description: "Bölüm listesi için kitap.",
        genre: "Fantastik",
        authorId: "author",
        status: id === "draft" ? "DRAFT" : "PUBLISHED",
        hidden: id === "hidden",
      },
    });
    for (const position of [2, 1]) {
      await db.volume.create({
        data: {
          id: `${id}-${position}`,
          bookId: id,
          position,
          title: `Cilt ${position}`,
        },
      });
    }
    if (id === "empty") continue;
    // Insert out of order; pagination must follow volume and chapter positions.
    await db.chapter.createMany({
      data: Array.from({ length: 62 }, (_, i) => {
        const ordinal = 62 - i;
        return {
          id: `${id}-chapter-${ordinal}`,
          bookId: id,
          volumeId: `${id}-${ordinal <= 30 ? 1 : 2}`,
          position: ordinal <= 30 ? ordinal : ordinal - 30,
          title: "Yayımlanmamış düzenleme",
          publishedTitle: `Bölüm ${ordinal}`,
          content,
          publishedContent: content,
          publishedWordCount: 400,
          firstPublishedAt: new Date(),
          status: ordinal === 62 ? "DRAFT" : "PUBLISHED",
          hidden: ordinal === 61,
          accessType: ordinal === 60 ? "PAID" : "FREE",
          priceMinor: ordinal === 60 ? 100 : 0,
        };
      }),
    });
  }
});
afterAll(close);

describe("Okurlara açık bölüm listesi", () => {
  it("önizlemeyi sınırlar ve sayfalarda cilt sırasını tekrar veya atlama olmadan korur", async () => {
    const preview = await getPublicChapters("public", CHAPTER_PREVIEW_SIZE);
    const first = await getPublicChapters("public", CHAPTER_PAGE_SIZE);
    const second = await getPublicChapters(
      "public",
      CHAPTER_PAGE_SIZE,
      CHAPTER_PAGE_SIZE,
    );
    expect(preview).toHaveLength(10);
    expect(first).toHaveLength(50);
    expect(second).toHaveLength(10);
    expect(preview).toEqual(first.slice(0, 10));
    expect([...first, ...second].map((chapter) => chapter.id)).toEqual(
      Array.from({ length: 60 }, (_, i) => `public-chapter-${i + 1}`),
    );
    expect((await getPublicBook("public"))?.chapterCount).toBe(60);
    expect(second.at(-1)).toMatchObject({
      title: "Bölüm 60",
      accessType: "PAID",
      priceMinor: 100,
      wordCount: 400,
    });
  });

  it("gizli veya taslak kitapların bölümlerini göstermez", async () => {
    for (const id of ["hidden", "draft"]) {
      expect(await getPublicBook(id)).toBeUndefined();
      expect(await getPublicChapters(id, CHAPTER_PAGE_SIZE)).toEqual([]);
    }
  });

  it("boş kitap ve listenin sonundan sonraki sorgu için boş liste döndürür", async () => {
    expect(await getPublicChapters("empty", CHAPTER_PAGE_SIZE)).toEqual([]);
    expect(await getPublicChapters("public", CHAPTER_PAGE_SIZE, 100)).toEqual(
      [],
    );
  });
});
