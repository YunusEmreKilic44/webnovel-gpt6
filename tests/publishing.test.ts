import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database } from "@/db";
import {
  addChapter,
  addVolume,
  createBook,
  publishChapter,
  reviewApplication,
  saveChapter,
  setChapterPrice,
  submitApplication,
} from "@/modules/publishing/service";
import {
  canReadPublic,
  requirePaidEligibility,
} from "@/modules/publishing/policies";
import { parseContent } from "@/modules/publishing/content";

const client = new PGlite();
const nativeDb = drizzle(client, { schema });
const db = nativeDb as unknown as Database;
const writer = {
  id: "writer",
  name: "Yazar",
  role: "reader" as const,
  emailVerified: true,
};
const admin = {
  id: "admin",
  name: "Yönetici",
  role: "admin" as const,
  emailVerified: true,
};
const stranger = {
  id: "stranger",
  name: "Başka Yazar",
  role: "reader" as const,
  emailVerified: true,
};
const text =
  "Gökyüzü aydınlanırken genç yolcu defterini açtı ve eski bir hikâyenin ilk satırlarını okumaya başladı. Yol uzun, sorular çoktu ama içinde taşıdığı umut her zamankinden daha güçlüydü. Bu yeni dünyada her kapının ardında başka bir sır saklanıyordu.";
const content = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
let bookId: string;
let chapterId: string;
let volumeId: string;
beforeAll(async () => {
  await migrate(nativeDb, { migrationsFolder: "./drizzle" });
  for (const actor of [writer, admin, stranger])
    await db
      .insert(schema.user)
      .values({ ...actor, email: `${actor.id}@example.test` });
});
afterAll(async () => {
  await client.close();
});

describe("Yayın ve premium akışı — gerçek PostgreSQL motoru", () => {
  it("kitap oluşturur, varsayılan cilt ve taslak bölüm bağlar", async () => {
    bookId = await createBook(db, writer, {
      title: "Test Dünyası",
      description:
        "Yeni dünyalara açılan uzun ve gizemli bir yolculuğun hikâyesi.",
      genre: "Fantastik",
      cover: "forest",
    });
    const [chapter] = await db
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.bookId, bookId));
    chapterId = chapter.id;
    volumeId = chapter.volumeId;
    expect(chapter.status).toBe("DRAFT");
    expect(
      await db
        .select()
        .from(schema.volumes)
        .where(eq(schema.volumes.bookId, bookId)),
    ).toHaveLength(1);
  });
  it("başka yazarın içeriği değiştirmesini ve doğrulanmamış yazarı engeller", async () => {
    await expect(
      saveChapter(db, stranger, {
        chapterId,
        title: "Çalınmış",
        rawContent: content,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      addVolume(db, { ...writer, emailVerified: false }, bookId, "Yeni cilt"),
    ).rejects.toMatchObject({ code: "EMAIL_UNVERIFIED" });
  });
  it("onaysız yayını engeller; eski sürüm yazımı metni ezmez", async () => {
    await expect(
      publishChapter(db, writer, chapterId, 1),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });
    expect(
      await saveChapter(db, writer, {
        chapterId,
        title: "İlk Bölüm",
        rawContent: content,
        expectedVersion: 1,
      }),
    ).toBe(2);
    await expect(
      saveChapter(db, writer, {
        chapterId,
        title: "Eski Sekme",
        rawContent: content,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });
  it("başvuru anlık görüntüsünü korur ve yinelenen başvuruyu engeller", async () => {
    await submitApplication(db, writer, bookId, "PUBLICATION");
    await expect(
      submitApplication(db, writer, bookId, "PUBLICATION"),
    ).rejects.toMatchObject({ code: "ALREADY_PENDING" });
    const [app] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.bookId, bookId));
    expect(app.snapshot.chapters[0].version).toBe(2);
    await expect(
      reviewApplication(
        db,
        { ...writer, role: "admin" },
        app.id,
        "APPROVED",
        "Kendi onayım",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await reviewApplication(
      db,
      admin,
      app.id,
      "APPROVED",
      "İçerik yayın için uygun.",
    );
    await expect(
      reviewApplication(db, admin, app.id, "REJECTED", "İkinci karar"),
    ).rejects.toMatchObject({ code: "ALREADY_REVIEWED" });
  });
  it("ilk yayını açar ve premium öncesi bölümü ücretlendirmez", async () => {
    await publishChapter(db, writer, chapterId, 2);
    await expect(
      setChapterPrice(db, writer, chapterId, 500),
    ).rejects.toMatchObject({ code: "PREMIUM_NOT_ACTIVE" });
    await submitApplication(db, writer, bookId, "PREMIUM");
    const apps = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.bookId, bookId));
    const premium = apps.find((a) => a.type === "PREMIUM")!;
    await reviewApplication(
      db,
      admin,
      premium.id,
      "APPROVED",
      "Premium incelemesi uygun.",
    );
    await expect(
      setChapterPrice(db, writer, chapterId, 500),
    ).rejects.toMatchObject({ code: "CHAPTER_PREDATES_PREMIUM" });
  });
  it("düzenleme ve yeniden yayın ilk yayın tarihini değiştirmez", async () => {
    const [before] = await db
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.id, chapterId));
    await saveChapter(db, writer, {
      chapterId,
      title: "Düzenlenen başlık",
      rawContent: content,
      expectedVersion: 2,
    });
    const [draft] = await db
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.id, chapterId));
    expect(draft.publishedTitle).toBe("İlk Bölüm");
    await publishChapter(db, writer, chapterId, 3);
    const [after] = await db
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.id, chapterId));
    expect(after.firstPublishedAt).toEqual(before.firstPublishedAt);
    await expect(
      setChapterPrice(db, writer, chapterId, 500),
    ).rejects.toMatchObject({ code: "CHAPTER_PREDATES_PREMIUM" });
  });
  it("onay sonrası yeni bölüm ücretli olur; genel okuyucuya açılmaz", async () => {
    const nextId = await addChapter(
      db,
      writer,
      bookId,
      volumeId,
      "İkinci bölüm",
    );
    await saveChapter(db, writer, {
      chapterId: nextId,
      title: "İkinci bölüm",
      rawContent: content,
      expectedVersion: 1,
    });
    await publishChapter(db, writer, nextId, 2);
    await setChapterPrice(db, writer, nextId, 750);
    const [book] = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.id, bookId));
    const [chapter] = await db
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.id, nextId));
    expect(chapter.priceMinor).toBe(750);
    expect(canReadPublic(book, chapter)).toBe(false);
    await setChapterPrice(db, writer, nextId, 0);
    const [free] = await db
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.id, nextId));
    expect(canReadPublic(book, free)).toBe(true);
  });
  it("yabancı kitaba ait cilde bölüm eklenemez", async () => {
    const otherBook = await createBook(db, stranger, {
      title: "Başka Kitap",
      description:
        "Yeterince uzun bir özet ve bambaşka bir dünyaya açılan kapı.",
      genre: "Gizem",
      cover: "ocean",
    });
    await expect(
      addChapter(db, stranger, otherBook, volumeId, "Yanlış cilt"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("eşzamanlı kayıtlardan yalnız biri kazanır", async () => {
    const results = await Promise.allSettled([
      saveChapter(db, writer, {
        chapterId,
        title: "Sekme A",
        rawContent: content,
        expectedVersion: 3,
      }),
      saveChapter(db, writer, {
        chapterId,
        title: "Sekme B",
        rawContent: content,
        expectedVersion: 3,
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("DB ilk yayın ve premium tarihinin doğrudan değiştirilmesini de engeller", async () => {
    await expect(
      db
        .update(schema.chapters)
        .set({ firstPublishedAt: new Date() })
        .where(eq(schema.chapters.id, chapterId)),
    ).rejects.toThrow();
    await expect(
      db
        .update(schema.books)
        .set({ firstPremiumApprovedAt: null })
        .where(eq(schema.books.id, bookId)),
    ).rejects.toThrow();
  });
  it("başvurudan sonra taslak değişse de ilk yayın yalnız incelenen metni açar", async () => {
    const freshBook = await createBook(db, writer, {
      title: "Sabit Başvuru",
      description:
        "İncelemeye gönderilen sürümün sonradan değişmediği bir kitap örneği.",
      genre: "Gizem",
      cover: "ocean",
    });
    const [draft] = await db
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.bookId, freshBook));
    await saveChapter(db, writer, {
      chapterId: draft.id,
      title: "İncelenen başlık",
      rawContent: content,
      expectedVersion: 1,
    });
    await submitApplication(db, writer, freshBook, "PUBLICATION");
    const changed = content.replace("Gökyüzü", "Onaylanmamış gizli değişiklik");
    await saveChapter(db, writer, {
      chapterId: draft.id,
      title: "Yeni taslak",
      rawContent: changed,
      expectedVersion: 2,
    });
    const [app] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.bookId, freshBook));
    expect(app.snapshot.chapters[0].title).toBe("İncelenen başlık");
    await reviewApplication(
      db,
      admin,
      app.id,
      "APPROVED",
      "İlk sürüm uygun bulundu.",
    );
    await publishChapter(db, writer, draft.id, 3);
    const [published] = await db
      .select()
      .from(schema.chapters)
      .where(eq(schema.chapters.id, draft.id));
    expect(published.publishedTitle).toBe("İncelenen başlık");
    expect(JSON.stringify(published.publishedContent)).not.toContain(
      "Onaylanmamış",
    );
    expect(JSON.stringify(published.content)).toContain("Onaylanmamış");
  });
});

describe("Güvenli içerik ve tarih sınırları", () => {
  it("eşit veya boş premium tarihi ücretli uygunluğu sağlamaz", () => {
    const at = new Date("2026-09-10T10:00:00Z");
    const book = {
      status: "PUBLISHED" as const,
      hidden: false,
      premiumStatus: "ACTIVE" as const,
      firstPremiumApprovedAt: at,
    };
    const chapter = {
      status: "PUBLISHED" as const,
      hidden: false,
      firstPublishedAt: at,
    };
    expect(() => requirePaidEligibility(book, chapter)).toThrow(
      "önce yayımlanan",
    );
    expect(() =>
      requirePaidEligibility(
        { ...book, firstPremiumApprovedAt: null },
        chapter,
      ),
    ).toThrow();
    expect(() =>
      requirePaidEligibility(
        { ...book, premiumStatus: "SUSPENDED" },
        { ...chapter, firstPublishedAt: new Date(at.getTime() + 100) },
      ),
    ).toThrow("aktif premium");
  });
  it("script/html düğümü ve keyfi HTML özelliklerini reddeder", () => {
    expect(() =>
      parseContent(
        JSON.stringify({
          type: "doc",
          content: [{ type: "script", text: "alert(1)" }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseContent(
        JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", attrs: { onclick: "evil()" } }],
        }),
      ),
    ).toThrow();
    expect(parseContent(content).type).toBe("doc");
  });
});
