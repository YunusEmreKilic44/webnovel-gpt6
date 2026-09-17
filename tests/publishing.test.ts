import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { ApplicationSnapshot } from "@/db/schema";
import { migrateLocal } from "@/db/migrate-local";
import { createLocalDatabase, getDb } from "@/db";
import {
  getCatalog,
  getPublicBook,
  getPublicChapters,
} from "@/modules/catalog/queries";
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

vi.mock("server-only", () => ({}));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: vi.fn(),
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
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
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [writer, admin, stranger])
    await db.user.create({
      data: { ...actor, email: `${actor.id}@example.test` },
    });
});
afterAll(async () => {
  await close();
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
    const [chapter] = await db.chapter.findMany({ where: { bookId: bookId } });
    chapterId = chapter.id;
    volumeId = chapter.volumeId;
    expect(chapter.status).toBe("DRAFT");
    expect(
      await db.volume.findMany({ where: { bookId: bookId } }),
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
    const [app] = await db.application.findMany({ where: { bookId: bookId } });
    expect((app.snapshot as ApplicationSnapshot).chapters[0].version).toBe(2);
    await expect(
      reviewApplication(db, writer, app.id, "APPROVED", "Kendi onayım"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await reviewApplication(
      db,
      admin,
      app.id,
      "APPROVED",
      "İçerik yayın için uygun.",
    );
    expect(
      await db.book.findUniqueOrThrow({ where: { id: bookId } }),
    ).toMatchObject({ status: "PUBLISHED" });
    expect(await getCatalog()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: bookId, chapterCount: 1 }),
      ]),
    );
    expect(await getPublicChapters(bookId)).toHaveLength(1);
    await expect(
      reviewApplication(db, admin, app.id, "REJECTED", "İkinci karar"),
    ).rejects.toMatchObject({ code: "ALREADY_REVIEWED" });
  });
  it("ilk yayını açar ve premium öncesi bölümü ücretlendirmez", async () => {
    await expect(
      setChapterPrice(db, writer, chapterId, 500),
    ).rejects.toMatchObject({ code: "PREMIUM_NOT_ACTIVE" });
    await submitApplication(db, writer, bookId, "PREMIUM");
    const apps = await db.application.findMany({ where: { bookId: bookId } });
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
    const [before] = await db.chapter.findMany({ where: { id: chapterId } });
    await saveChapter(db, writer, {
      chapterId,
      title: "Düzenlenen başlık",
      rawContent: content,
      expectedVersion: 2,
    });
    const [draft] = await db.chapter.findMany({ where: { id: chapterId } });
    expect(draft.publishedTitle).toBe("İlk Bölüm");
    await publishChapter(db, writer, chapterId, 3);
    const [after] = await db.chapter.findMany({ where: { id: chapterId } });
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
    const [book] = await db.book.findMany({ where: { id: bookId } });
    const [chapter] = await db.chapter.findMany({ where: { id: nextId } });
    expect(chapter.priceMinor).toBe(750);
    expect(canReadPublic(book, chapter)).toBe(false);
    await setChapterPrice(db, writer, nextId, 0);
    const [free] = await db.chapter.findMany({ where: { id: nextId } });
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
      db.chapter.updateMany({
        where: { id: chapterId },
        data: { firstPublishedAt: new Date() },
      }),
    ).rejects.toThrow();
    await expect(
      db.book.updateMany({
        where: { id: bookId },
        data: { firstPremiumApprovedAt: null },
      }),
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
    const [draft] = await db.chapter.findMany({ where: { bookId: freshBook } });
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
    const [app] = await db.application.findMany({
      where: { bookId: freshBook },
    });
    expect((app.snapshot as ApplicationSnapshot).chapters[0].title).toBe(
      "İncelenen başlık",
    );
    await reviewApplication(
      db,
      admin,
      app.id,
      "APPROVED",
      "İlk sürüm uygun bulundu.",
    );
    const [published] = await db.chapter.findMany({ where: { id: draft.id } });
    expect(published.publishedTitle).toBe("İncelenen başlık");
    expect(JSON.stringify(published.publishedContent)).not.toContain(
      "Onaylanmamış",
    );
    expect(JSON.stringify(published.content)).toContain("Onaylanmamış");
    const publicBook = await getPublicBook(
      (await db.book.findUniqueOrThrow({ where: { id: freshBook } })).slug,
    );
    expect(publicBook?.id).toBe(freshBook);
    expect((await getPublicChapters(freshBook))[0].title).toBe(
      "İncelenen başlık",
    );
  });
});

describe("Onayla otomatik yayın", () => {
  it("yalnız incelenen bölümleri yayımlar; sonraki taslakları açmaz", async () => {
    const freshBook = await createBook(db, writer, {
      title: "Toplu İlk Yayın",
      description:
        "İncelenen bölümler ve daha sonra yazılan taslaklar ayrı tutulur.",
      genre: "Fantastik",
      cover: "forest",
    });
    const first = await db.chapter.findFirstOrThrow({
      where: { bookId: freshBook },
    });
    const ids = [first.id];
    for (let index = 2; index <= 4; index++)
      ids.push(
        await addChapter(
          db,
          writer,
          freshBook,
          first.volumeId,
          `Bölüm ${index}`,
        ),
      );
    for (const chapterId of ids)
      await saveChapter(db, writer, {
        chapterId,
        title: "Örnek bölüm",
        rawContent: content,
        expectedVersion: 1,
      });
    await submitApplication(db, writer, freshBook, "PUBLICATION");
    const app = await db.application.findFirstOrThrow({
      where: { bookId: freshBook },
    });
    const reviewedIds = (app.snapshot as ApplicationSnapshot).chapters.map(
      (c) => c.id,
    );
    await reviewApplication(
      db,
      admin,
      app.id,
      "APPROVED",
      "İncelenen üç bölüm uygun.",
    );
    const published = await getPublicChapters(freshBook);
    expect(published.map((c) => c.id).sort()).toEqual([...reviewedIds].sort());
    const unreviewed = await db.chapter.findMany({
      where: { bookId: freshBook, id: { notIn: reviewedIds } },
    });
    expect(unreviewed).toHaveLength(1);
    expect(unreviewed[0]).toMatchObject({
      status: "DRAFT",
      publishedContent: null,
      firstPublishedAt: null,
    });
    expect(
      await db.auditLog.count({
        where: { action: "chapter.published", targetId: { in: reviewedIds } },
      }),
    ).toBe(3);
  });

  it.each(["hidden", "missing"])(
    "%s örnek bölüm varsa onayı ve yayını birlikte geri alır",
    async (failure) => {
      const freshBook = await createBook(db, writer, {
        title: `Geçersiz Örnek ${failure}`,
        description:
          "İnceleme sonrasında kullanılamayan bir bölümün yayın kontrolü.",
        genre: "Gizem",
        cover: "ocean",
      });
      const first = await db.chapter.findFirstOrThrow({
        where: { bookId: freshBook },
      });
      const second = await addChapter(
        db,
        writer,
        freshBook,
        first.volumeId,
        "İkinci örnek",
      );
      for (const chapterId of [first.id, second])
        await saveChapter(db, writer, {
          chapterId,
          title: "Örnek bölüm",
          rawContent: content,
          expectedVersion: 1,
        });
      await submitApplication(db, writer, freshBook, "PUBLICATION");
      const app = await db.application.findFirstOrThrow({
        where: { bookId: freshBook },
      });
      if (failure === "hidden")
        await db.chapter.update({
          where: { id: second },
          data: { hidden: true },
        });
      else {
        await db.chapterRevision.deleteMany({ where: { chapterId: second } });
        await db.chapter.delete({ where: { id: second } });
      }
      await expect(
        reviewApplication(db, admin, app.id, "APPROVED", "Örnekleri yayımla."),
      ).rejects.toMatchObject({ code: "UNAVAILABLE" });
      expect(
        await db.book.findUniqueOrThrow({ where: { id: freshBook } }),
      ).toMatchObject({ status: "DRAFT" });
      expect(
        await db.application.findUniqueOrThrow({ where: { id: app.id } }),
      ).toMatchObject({ status: "PENDING", reviewerId: null });
      expect(await getPublicChapters(freshBook)).toHaveLength(0);
      expect(
        await getPublicBook(
          (await db.book.findUniqueOrThrow({ where: { id: freshBook } })).slug,
        ),
      ).toBeUndefined();
      expect(
        await db.auditLog.count({
          where: { action: "chapter.published", targetId: first.id },
        }),
      ).toBe(0);
    },
  );
});

describe("Yöneticinin kendi kitabını değerlendirmesi", () => {
  it.each([
    ["PUBLICATION", "APPROVED"],
    ["PUBLICATION", "REJECTED"],
    ["PREMIUM", "APPROVED"],
    ["PREMIUM", "REJECTED"],
  ] as const)("%s başvurusunda %s kararı verir", async (type, decision) => {
    const ownBookId = await createBook(db, admin, {
      title: `Yönetici Kitabı ${type} ${decision}`,
      description:
        "Yöneticinin yazdığı kitabın yayın ve premium başvurusu örneği.",
      genre: "Fantastik",
      cover: "forest",
    });
    const chapter = await db.chapter.findFirstOrThrow({
      where: { bookId: ownBookId },
    });
    await saveChapter(db, admin, {
      chapterId: chapter.id,
      title: "İlk bölüm",
      rawContent: content,
      expectedVersion: 1,
    });
    await submitApplication(db, admin, ownBookId, "PUBLICATION");
    if (type === "PREMIUM") {
      const publication = await db.application.findFirstOrThrow({
        where: { bookId: ownBookId, type: "PUBLICATION" },
      });
      await reviewApplication(
        db,
        admin,
        publication.id,
        "APPROVED",
        "Yayın için uygun.",
      );
      await submitApplication(db, admin, ownBookId, "PREMIUM");
    }
    const application = await db.application.findFirstOrThrow({
      where: { bookId: ownBookId, type },
    });
    for (const actor of [writer, { ...admin, role: "reader" }]) {
      await expect(
        reviewApplication(
          db,
          actor,
          application.id,
          decision,
          "Yetkisiz karar.",
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(
      reviewApplication(
        db,
        { ...admin, emailVerified: false },
        application.id,
        decision,
        "Doğrulanmamış hesap.",
      ),
    ).rejects.toMatchObject({ code: "EMAIL_UNVERIFIED" });
    expect(
      await db.application.findUniqueOrThrow({ where: { id: application.id } }),
    ).toMatchObject({ status: "PENDING", reviewerId: null });
    const note = "Yöneticinin kendi kitabı için inceleme kararı.";
    await reviewApplication(db, admin, application.id, decision, note);
    expect(
      await db.application.findUniqueOrThrow({ where: { id: application.id } }),
    ).toMatchObject({
      status: decision,
      reviewerId: admin.id,
      reviewedAt: expect.any(Date),
      note,
    });
    expect(
      await db.auditLog.findFirstOrThrow({
        where: { targetId: application.id },
      }),
    ).toMatchObject({
      actorId: admin.id,
      action: `application.${decision.toLowerCase()}`,
      detail: note,
    });
    const book = await db.book.findUniqueOrThrow({ where: { id: ownBookId } });
    expect(book.status).toBe(
      type === "PREMIUM"
        ? "PUBLISHED"
        : decision === "APPROVED"
          ? "PUBLISHED"
          : "DRAFT",
    );
    expect(book.premiumStatus).toBe(
      type === "PREMIUM" && decision === "APPROVED" ? "ACTIVE" : "NONE",
    );
    expect(book.firstPremiumApprovedAt).toEqual(
      type === "PREMIUM" && decision === "APPROVED" ? expect.any(Date) : null,
    );
    await expect(
      reviewApplication(db, admin, application.id, decision, note),
    ).rejects.toMatchObject({ code: "ALREADY_REVIEWED" });
  });
});

describe("Güvenli içerik ve tarih sınırları", () => {
  it("eski PostgreSQL kayıtlarının mikrosaniyeli ilk yayın tarihini aynen korur", async () => {
    const migratedBook = await createBook(db, writer, {
      title: "Eski Kayıt",
      description:
        "Eski veritabanından taşınmış bir kitabın mikrosaniye hassasiyetindeki tarih kaydı.",
      genre: "Gizem",
      cover: "ocean",
    });
    const chapter = await db.chapter.findFirstOrThrow({
      where: { bookId: migratedBook },
    });
    await saveChapter(db, writer, {
      chapterId: chapter.id,
      title: "Eski bölüm",
      rawContent: content,
      expectedVersion: 1,
    });
    await db.book.update({
      where: { id: migratedBook },
      data: { status: "PUBLISHED" },
    });
    await db.$executeRaw`UPDATE chapters SET first_published_at = '2026-01-01 12:00:00.123456+00'::timestamptz WHERE id = ${chapter.id}`;
    await publishChapter(db, writer, chapter.id, 2);
    const [row] = await db.$queryRaw<
      { stamp: string }[]
    >`SELECT (first_published_at AT TIME ZONE 'UTC')::text AS stamp FROM chapters WHERE id = ${chapter.id}`;
    expect(row.stamp).toContain("12:00:00.123456");
  });
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
