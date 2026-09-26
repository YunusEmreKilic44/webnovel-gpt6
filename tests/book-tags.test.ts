import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createLocalDatabase } from "./support/database";
import { migrateLocal } from "./support/migrate";
import { getDb } from "@/db";
import { bookTagsInput, parseTags, tagKey } from "@/lib/tags";
import {
  bookInput,
  createBook,
  updateBookDetails,
  saveChapter,
  submitApplication,
} from "@/modules/publishing/service";
import { updateBook } from "@/modules/admin/service";
import {
  getCatalog,
  getPopularTags,
  getPublicBook,
  getLibrary,
} from "@/modules/catalog/queries";
import { bookTagSelection, tagNames } from "@/modules/catalog/tags";

vi.mock("server-only", () => ({}));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: vi.fn(),
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const author = {
  id: "tag-author",
  name: "Etiket Yazarı",
  role: "reader",
  emailVerified: true,
};
const other = { ...author, id: "other-author", name: "Diğer Etiket Yazarı" };
const admin = {
  ...author,
  id: "tag-admin",
  name: "Etiket Yöneticisi",
  role: "admin",
};
const details = {
  title: "Etiketli Yolculuk",
  description:
    "Kaybolmuş dünyalarda geçen gizemli bir yolculuğun uzun hikâyesi.",
  genres: ["Fantastik"] as ["Fantastik"],
  cover: "forest" as const,
};
const readTags = async (id: string) =>
  tagNames(
    (
      await db.book.findUniqueOrThrow({
        where: { id },
        select: { tags: bookTagSelection },
      })
    ).tags,
  );

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [author, other, admin])
    await db.user.create({
      data: { ...actor, email: `${actor.id}@example.test` },
    });
});
afterAll(close);

describe("Yazar etiketleri", () => {
  it("isteğe bağlıdır; parantezleri, boşlukları, harf farklarını ve tekrarları normalize eder", () => {
    expect(bookTagsInput.parse(undefined)).toEqual([]);
    expect(bookTagsInput.parse(["", " "])).toEqual([]);
    expect(
      bookTagsInput.parse(["(İSEKAİ), (yeni   dünya)", "isekai", "yeni dunya"]),
    ).toEqual(["isekai", "yeni dünya"]);
    expect(tagKey("IŞIK")).toBe(tagKey("ışık"));
    expect(tagKey("İSEKAİ")).toBe(tagKey("isekai"));
    expect(bookInput.shape.genres.safeParse(["LGBT+"]).success).toBe(false);
    expect(bookInput.shape.genres.safeParse(["Diğer"]).success).toBe(true);
  });

  it("cümle, bağlantı, HTML, çok uzun veya çok sayıda etiketi reddeder", () => {
    for (const value of [
      "Bu kitap yeni dünyada geçen bir hikâye",
      "yeni dünya.",
      "https://example.com",
      "<script>alert</script>",
      "a",
      "x".repeat(33),
      "yeni\ndünya",
      "()",
    ])
      expect(bookTagsInput.safeParse([value]).success, value).toBe(false);
    expect(
      parseTags(Array.from({ length: 11 }, (_, i) => `etiket ${i}`)).error,
    ).toBeTruthy();
    expect(bookTagsInput.safeParse([new File([], "tag")]).success).toBe(false);
  });

  it("etiketsiz kitap oluşturur ve aynı etiketi kitaplar arasında paylaşır", async () => {
    const empty = await createBook(db, author, details);
    expect(await readTags(empty)).toEqual([]);
    const first = await createBook(db, author, {
      ...details,
      tags: ["(isekai), (yeni dünya)"],
    });
    const second = await createBook(db, author, {
      ...details,
      tags: ["İSEKAİ", "yeni dunya"],
    });
    expect(await readTags(first)).toEqual(["isekai", "yeni dünya"]);
    expect(await readTags(second)).toEqual(["isekai", "yeni dünya"]);
    expect(
      await db.tag.count({ where: { key: { in: ["isekai", "yeni dunya"] } } }),
    ).toBe(2);
    expect(await getPopularTags()).toEqual([]);
    await expect(
      db.bookTag.create({ data: { bookId: first, tagKey: "isekai" } }),
    ).rejects.toThrow();
  });

  it("etiketle arar, tam etiket filtresini diğer filtrelerle birleştirir ve gizli/taslak kitapları dışlar", async () => {
    const id = await createBook(db, author, {
      ...details,
      tags: ["arama dünyası"],
    });
    const hidden = await createBook(db, author, {
      ...details,
      tags: ["arama dünyası", "gizli etiket"],
    });
    await createBook(db, author, {
      ...details,
      tags: ["arama dünyası", "taslak etiket"],
    });
    await db.book.update({
      where: { id },
      data: { status: "PUBLISHED", storyStatus: "COMPLETED" },
    });
    await db.book.update({
      where: { id: hidden },
      data: { status: "PUBLISHED", hidden: true },
    });
    expect(
      (await getCatalog({ q: "ARAMA DUNYASI" })).map((book) => book.id),
    ).toEqual([id]);
    expect(
      (
        await getCatalog({
          tag: "(Arama Dünyası)",
          genre: "Fantastik",
          completed: true,
          q: "Yolculuk",
          sort: "rating",
        })
      ).map((book) => book.id),
    ).toEqual([id]);
    expect(await getCatalog({ tag: "arama" })).toEqual([]);
    expect(await getCatalog({ tag: "arama dünyası", genre: "Gizem" })).toEqual(
      [],
    );
    expect(await getCatalog({ q: "%" })).toEqual([]);
    expect(await getCatalog({ q: "_" })).toEqual([]);
    expect(await getCatalog({ q: "()" })).toEqual([]);
    expect(await getPopularTags()).toEqual([
      { name: "arama dünyası", key: "arama dunyasi", count: 1 },
    ]);
    const book = await db.book.findUniqueOrThrow({ where: { id } });
    expect((await getPublicBook(book.slug))?.tags).toEqual(["arama dünyası"]);
    await db.libraryEntry.create({
      data: { id: "tag-library", bookId: id, userId: author.id },
    });
    expect((await getLibrary(author.id))[0].tags).toEqual(["arama dünyası"]);
  });

  it("etiketleri atomik olarak değiştirir, temizler ve başka kitabın ilişkisini korur", async () => {
    const first = await createBook(db, author, {
      ...details,
      tags: ["ortak etiket"],
    });
    const second = await createBook(db, author, {
      ...details,
      tags: ["ortak etiket"],
    });
    const edit = { ...details, bookId: first, storyStatus: "ONGOING" as const };
    await updateBookDetails(db, author, { ...edit, tags: ["başka etiket"] });
    expect(await readTags(first)).toEqual(["başka etiket"]);
    expect(await readTags(second)).toEqual(["ortak etiket"]);
    await expect(
      updateBookDetails(db, author, {
        ...edit,
        title: "Değişmemeli",
        tags: ["Uzun bir açıklama metni burada yazılıyor"],
      }),
    ).rejects.toThrow();
    expect(
      (await db.book.findUniqueOrThrow({ where: { id: first } })).title,
    ).toBe(details.title);
    await expect(
      updateBookDetails(db, other, { ...edit, tags: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await readTags(first)).toEqual(["başka etiket"]);
    await updateBookDetails(db, author, { ...edit, tags: [] });
    expect(await readTags(first)).toEqual([]);
    expect(await readTags(second)).toEqual(["ortak etiket"]);
  });

  it("yönetici aynı kurallarla etiketleri düzenler ve işlem kaydına yazar", async () => {
    const id = await createBook(db, author, {
      ...details,
      tags: ["eski etiket"],
    });
    const edit = {
      ...details,
      id,
      reason: "Etiket düzeltmesi",
      storyStatus: "ONGOING" as const,
      hidden: false,
      featured: false,
    };
    await updateBook(db, admin, { ...edit, tags: ["yönetilen etiket"] });
    expect(await readTags(id)).toEqual(["yönetilen etiket"]);
    const log = await db.auditLog.findFirstOrThrow({
      where: { targetId: id, action: "ADMIN_BOOK_UPDATED" },
    });
    expect(JSON.parse(log.detail)).toMatchObject({
      before: { tags: ["eski etiket"] },
      after: { tags: ["yönetilen etiket"] },
    });
    await expect(
      updateBook(db, admin, { ...edit, tags: ["https://example.com"] }),
    ).rejects.toThrow();
    expect(await readTags(id)).toEqual(["yönetilen etiket"]);
  });

  it("başvurudaki etiketleri kitabın sonraki düzenlemelerinden bağımsız saklar", async () => {
    const id = await createBook(db, author, {
      ...details,
      tags: ["ilk etiket"],
    });
    const chapter = await db.chapter.findFirstOrThrow({
      where: { bookId: id },
    });
    await saveChapter(db, author, {
      chapterId: chapter.id,
      title: "İlk Bölüm",
      expectedVersion: 1,
      rawContent: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Bir yolcu eski dünyayı yeniden keşfetmek için uzun bir yolculuğa çıktı. ".repeat(
                  4,
                ),
              },
            ],
          },
        ],
      }),
    });
    await submitApplication(db, author, id, "PUBLICATION");
    await updateBookDetails(db, author, {
      ...details,
      bookId: id,
      storyStatus: "ONGOING",
      tags: ["sonraki etiket"],
    });
    const application = await db.application.findFirstOrThrow({
      where: { bookId: id },
    });
    expect(application.snapshot).toMatchObject({ tags: ["ilk etiket"] });
    expect(await readTags(id)).toEqual(["sonraki etiket"]);
  });
});
