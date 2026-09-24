import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { ApplicationSnapshot } from "@/db/schema";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import {
  reviewApplication,
  submitApplication,
} from "@/modules/publishing/service";
import {
  getNotifications,
  markNotificationRead,
} from "@/modules/notifications/service";
import { updatePremiumRules } from "@/modules/coins/service";
import { setFeatureFlag } from "@/modules/features/service";
import { getPremiumProgress } from "@/modules/premium/requirements";
import { createReport, resolveReport } from "@/modules/reports/service";

vi.mock("server-only", () => ({}));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: vi.fn(),
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const user = (id: string, extra: object = {}) => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role: "reader",
  emailVerified: true,
  ...extra,
});
const author = user("author");
const reader = user("reader");
const admin = user("admin", { role: "admin" });
const doc = (text: string) => ({
  type: "doc",
  content: text
    ? [{ type: "paragraph", content: [{ type: "text", text }] }]
    : [],
});
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `kelime${i}`).join(" ");

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [author, reader, admin])
    await db.user.create({ data: actor });
  await db.book.create({
    data: {
      id: "book",
      authorId: author.id,
      slug: "yeni-kitap",
      title: "Yeni kitap",
      description: "Başvuru kurallarını deneyen yeterince uzun bir açıklama.",
      genres: ["Fantastik"],
    },
  });
  await db.volume.create({
    data: { id: "volume", bookId: "book", title: "Cilt", position: 1 },
  });
  // Created out of order on purpose: reading order, not creation order, counts.
  await db.chapter.create({
    data: {
      id: "second",
      bookId: "book",
      volumeId: "volume",
      title: "İkinci bölüm",
      position: 2,
      content: doc(words(40)),
      wordCount: 40,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
  });
  await db.chapter.create({
    data: {
      id: "first",
      bookId: "book",
      volumeId: "volume",
      title: "İlk bölüm",
      position: 1,
      content: doc(""),
      createdAt: new Date("2026-01-02T00:00:00Z"),
    },
  });
});
afterAll(close);

describe("Yayın başvurusu", () => {
  it("ilk bölüm yazılmadan başvuru gönderilemez", async () => {
    await expect(
      submitApplication(db, author, "book", "PUBLICATION"),
    ).rejects.toMatchObject({ code: "FIRST_CHAPTER_REQUIRED" });
    expect(await db.application.count()).toBe(0);
  });

  it("ilk bölüm her zaman incelemeye gönderilen örneklerin başındadır", async () => {
    await db.chapter.update({
      where: { id: "first" },
      data: { content: doc(words(35)), wordCount: 35 },
    });
    await submitApplication(db, author, "book", "PUBLICATION");
    const application = await db.application.findFirstOrThrow();
    const snapshot = application.snapshot as ApplicationSnapshot;
    expect(snapshot.chapters.map((c) => c.id)).toEqual(["first", "second"]);
  });

  it("onaylanınca yazara bildirim gider ve kitaba yönlendirir", async () => {
    const application = await db.application.findFirstOrThrow();
    await reviewApplication(
      db,
      admin,
      application.id,
      "APPROVED",
      "Hikâye yayına uygun.",
    );
    const [notice] = await getNotifications(db, author.id);
    expect(notice).toMatchObject({
      type: "APPLICATION_APPROVED",
      application: { type: "PUBLICATION", note: "Hikâye yayına uygun." },
      book: { title: "Yeni kitap" },
    });
    expect(await markNotificationRead(db, author.id, notice.id)).toBe(
      "/studio/books/book",
    );
    expect(await getNotifications(db, reader.id)).toEqual([]);
  });
});

describe("Premium başvuru şartları", () => {
  it("premium başvuruları varsayılan olarak kapalıdır; yönetici açabilir", async () => {
    await expect(
      submitApplication(db, author, "book", "PREMIUM"),
    ).rejects.toMatchObject({ code: "PREMIUM_CLOSED" });
    await setFeatureFlag(db, admin, {
      key: "premiumApplications",
      enabled: true,
    });
  });

  it("varsayılan şartlar sağlanmadan başvurulamaz", async () => {
    expect(await getPremiumProgress(db, "book")).toMatchObject({
      chapters: 2,
      reads: 0,
      minChapters: 10,
      minReads: 500,
      eligible: false,
    });
    await expect(
      submitApplication(db, author, "book", "PREMIUM"),
    ).rejects.toMatchObject({ code: "PREMIUM_REQUIREMENTS" });
  });

  it("yönetici şartları değiştirebilir; şartları sağlayan kitap başvurur, ret bildirimi gider", async () => {
    await expect(
      updatePremiumRules(db, author, { minChapters: 0, minReads: 0 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updatePremiumRules(db, admin, { minChapters: 2, minReads: 3 });
    await db.chapterRead.createMany({
      data: ["a", "b"].map((viewer) => ({
        chapterId: "first",
        viewerKey: viewer,
        readOn: new Date("2026-09-01"),
      })),
    });
    await expect(
      submitApplication(db, author, "book", "PREMIUM"),
    ).rejects.toMatchObject({ code: "PREMIUM_REQUIREMENTS" });
    await db.chapterRead.create({
      data: {
        chapterId: "second",
        viewerKey: "c",
        readOn: new Date("2026-09-01"),
      },
    });
    expect((await getPremiumProgress(db, "book")).eligible).toBe(true);
    await submitApplication(db, author, "book", "PREMIUM");
    const premium = await db.application.findFirstOrThrow({
      where: { type: "PREMIUM" },
    });
    await reviewApplication(
      db,
      admin,
      premium.id,
      "REJECTED",
      "Önce birkaç bölüm daha yayımla.",
    );
    const [notice] = await getNotifications(db, author.id);
    expect(notice).toMatchObject({
      type: "APPLICATION_REJECTED",
      application: { type: "PREMIUM", note: "Önce birkaç bölüm daha yayımla." },
    });
  });
});

describe("Şikâyet geri bildirimi", () => {
  it("şikâyet eden sonucu bildirim olarak alır; yöneticinin iç notu paylaşılmaz", async () => {
    await createReport(db, reader, {
      targetType: "BOOK",
      targetId: "book",
      reason: "COPYRIGHT",
    });
    const report = await db.report.findFirstOrThrow();
    await resolveReport(db, admin, {
      id: report.id,
      decision: "DISMISSED",
      note: "İç not: telif sahibiyle konuşuldu.",
    });
    const [notice] = await getNotifications(db, reader.id);
    expect(notice).toMatchObject({
      type: "REPORT_DISMISSED",
      report: { targetType: "BOOK", reason: "COPYRIGHT" },
    });
    expect(JSON.stringify(notice)).not.toContain("İç not");
    expect(await markNotificationRead(db, reader.id, notice.id)).toBe(
      "/bildirimler",
    );
  });
});
