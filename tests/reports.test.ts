import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import {
  countOpenReports,
  createReport,
  getAdminReport,
  resolveReport,
} from "@/modules/reports/service";

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
const other = user("other");
const troll = user("troll");
const admin = user("admin", { role: "admin" });
const unverified = user("unverified", { emailVerified: false });
const content = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Metin" }] }],
};

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [author, reader, other, troll, admin, unverified])
    await db.user.create({ data: actor });
  await db.book.create({
    data: {
      id: "book",
      authorId: author.id,
      slug: "sikayet-kitabi",
      title: "Şikâyet kitabı",
      description: "Şikâyet akışını deneyen yeterince uzun bir açıklama.",
      genres: ["Fantastik"],
      status: "PUBLISHED",
    },
  });
  await db.volume.create({
    data: { id: "volume", bookId: "book", title: "Cilt", position: 1 },
  });
  await db.chapter.create({
    data: {
      id: "chapter",
      bookId: "book",
      volumeId: "volume",
      title: "Bölüm",
      publishedTitle: "Bölüm",
      position: 1,
      content,
      publishedContent: content,
      status: "PUBLISHED",
      firstPublishedAt: new Date(),
    },
  });
  await db.comment.create({
    data: {
      id: "comment",
      userId: troll.id,
      bookId: "book",
      body: "Kaba bir yorum",
    },
  });
});
afterAll(close);

describe("Şikâyet gönderme", () => {
  it("kitap, bölüm, yorum ve kullanıcı şikâyet edilebilir", async () => {
    await createReport(db, reader, {
      targetType: "COMMENT",
      targetId: "comment",
      reason: "HARASSMENT",
      details: "Diğer okurlara hakaret ediyor.",
    });
    await createReport(db, reader, {
      targetType: "BOOK",
      targetId: "book",
      reason: "COPYRIGHT",
    });
    await createReport(db, reader, {
      targetType: "CHAPTER",
      targetId: "chapter",
      reason: "SPAM",
    });
    await createReport(db, reader, {
      targetType: "USER",
      targetId: troll.id,
      reason: "IMPERSONATION",
    });
    expect(await countOpenReports(db)).toBe(4);
    expect(
      await db.report.findFirst({ where: { targetId: "comment" } }),
    ).toMatchObject({
      reporterId: reader.id,
      status: "OPEN",
      details: "Diğer okurlara hakaret ediyor.",
    });
  });

  it("aynı içeriği açık şikâyet varken tekrar şikâyet ettirmez", async () => {
    await expect(
      createReport(db, reader, {
        targetType: "COMMENT",
        targetId: "comment",
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_REPORTED" });
  });

  it("kendi içeriğini, hedefe uymayan sebebi ve açıklamasız “Diğer”i reddeder", async () => {
    await expect(
      createReport(db, author, {
        targetType: "BOOK",
        targetId: "book",
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ code: "SELF_REPORT" });
    await expect(
      createReport(db, troll, {
        targetType: "USER",
        targetId: troll.id,
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ code: "SELF_REPORT" });
    // Spoiler is a comment reason, not a book reason.
    await expect(
      createReport(db, other, {
        targetType: "BOOK",
        targetId: "book",
        reason: "SPOILER",
      }),
    ).rejects.toThrow();
    await expect(
      createReport(db, other, {
        targetType: "BOOK",
        targetId: "book",
        reason: "OTHER",
        details: "kısa",
      }),
    ).rejects.toThrow(/en az 10 karakter/);
    await expect(
      createReport(db, other, {
        targetType: "BOOK",
        targetId: "missing",
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createReport(db, unverified, {
        targetType: "BOOK",
        targetId: "book",
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ code: "EMAIL_UNVERIFIED" });
  });
});

describe("Şikâyet yönetimi", () => {
  it("yalnız yöneticiler karar verebilir", async () => {
    const report = await db.report.findFirstOrThrow({
      where: { targetId: "comment" },
    });
    await expect(
      resolveReport(db, reader, {
        id: report.id,
        decision: "RESOLVED",
        action: "HIDE",
        note: "Kendi kararım",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("haklı bulunca yorumu gizler ve aynı yorum hakkındaki tüm açık şikâyetleri kapatır", async () => {
    await createReport(db, other, {
      targetType: "COMMENT",
      targetId: "comment",
      reason: "HATE",
    });
    const report = await db.report.findFirstOrThrow({
      where: { targetId: "comment", reporterId: reader.id },
    });
    const closed = await resolveReport(db, admin, {
      id: report.id,
      decision: "RESOLVED",
      action: "HIDE",
      note: "Topluluk kurallarını ihlal ediyor.",
    });
    expect(closed).toBe(2);
    expect(
      await db.comment.findUniqueOrThrow({ where: { id: "comment" } }),
    ).toMatchObject({ hidden: true });
    expect(
      await db.report.findMany({
        where: { targetId: "comment" },
        select: { status: true, action: true, handledById: true },
      }),
    ).toEqual([
      { status: "RESOLVED", action: "HIDE", handledById: admin.id },
      { status: "RESOLVED", action: "HIDE", handledById: admin.id },
    ]);
    expect(
      await db.auditLog.count({ where: { action: "ADMIN_REPORT_RESOLVED" } }),
    ).toBe(1);
    await expect(
      resolveReport(db, admin, {
        id: report.id,
        decision: "DISMISSED",
        note: "Tekrar deneme",
      }),
    ).rejects.toMatchObject({ code: "ALREADY_HANDLED" });
    const detail = await getAdminReport(db, report.id);
    expect(detail?.target).toMatchObject({ type: "COMMENT" });
    expect(detail?.related).toHaveLength(1);
  });

  it("reddetmek içeriğe dokunmaz; sonuçlanan şikâyetten sonra yeniden şikâyet edilebilir", async () => {
    const report = await db.report.findFirstOrThrow({
      where: { targetId: "book" },
    });
    await resolveReport(db, admin, {
      id: report.id,
      decision: "DISMISSED",
      // An action is ignored when the report is dismissed.
      action: "HIDE",
      note: "Telif iddiası doğrulanamadı.",
    });
    expect(
      await db.book.findUniqueOrThrow({ where: { id: "book" } }),
    ).toMatchObject({ hidden: false });
    expect(
      await db.report.findUniqueOrThrow({ where: { id: report.id } }),
    ).toMatchObject({ status: "DISMISSED", action: "NONE" });
    await createReport(db, reader, {
      targetType: "BOOK",
      targetId: "book",
      reason: "MISLEADING",
    });
  });

  it("kullanıcı şikâyetinde banlayabilir; kullanıcı gizlenemez", async () => {
    const report = await db.report.findFirstOrThrow({
      where: { targetType: "USER", targetId: troll.id },
    });
    await expect(
      resolveReport(db, admin, {
        id: report.id,
        decision: "RESOLVED",
        action: "HIDE",
        note: "Yanlış işlem",
      }),
    ).rejects.toMatchObject({ code: "INVALID_ACTION" });
    await resolveReport(db, admin, {
      id: report.id,
      decision: "RESOLVED",
      action: "BAN",
      note: "Başka bir yazarı taklit ediyor.",
    });
    expect(
      await db.user.findUniqueOrThrow({ where: { id: troll.id } }),
    ).toMatchObject({ banned: true });
    expect(
      await db.auditLog.count({ where: { action: "ADMIN_USER_BANNED" } }),
    ).toBe(1);
  });

  it("bölümü gizleyerek çözer", async () => {
    const report = await db.report.findFirstOrThrow({
      where: { targetType: "CHAPTER" },
    });
    await resolveReport(db, admin, {
      id: report.id,
      decision: "RESOLVED",
      action: "HIDE",
      note: "Spam içerik kaldırıldı.",
    });
    expect(
      await db.chapter.findUniqueOrThrow({ where: { id: "chapter" } }),
    ).toMatchObject({ hidden: true });
  });
});
