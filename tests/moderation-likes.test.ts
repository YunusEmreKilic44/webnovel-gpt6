import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createLocalDatabase } from "./support/database";
import { migrateLocal } from "./support/migrate";
import { getDb } from "@/db";
import { assertSessionAllowed } from "@/lib/ban-policy";
import { setUserBan, updateUser } from "@/modules/admin/service";
import { setCommentLike } from "@/modules/community/likes";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const admin = {
  id: "admin",
  name: "Yönetici",
  role: "admin",
  emailVerified: true,
};
const otherAdmin = { ...admin, id: "other-admin", name: "İkinci Yönetici" };
const reader = { ...admin, id: "reader", name: "Okur", role: "reader" };
const otherReader = { ...reader, id: "other-reader", name: "İkinci Okur" };
const reason = "Tekrarlanan topluluk kuralı ihlalleri.";
const likeInput = { bookId: "book", commentId: "comment", liked: true };

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  await db.user.createMany({
    data: [admin, otherAdmin, reader, otherReader].map((user) => ({
      ...user,
      email: `${user.id}@example.test`,
    })),
  });
  await db.book.create({
    data: {
      id: "book",
      slug: "test-kitabi",
      title: "Test Kitabı",
      description: "Yorum ve beğeni için kullanılan örnek bir kitap.",
      genres: ["Fantastik"],
      authorId: admin.id,
      status: "PUBLISHED",
    },
  });
  await db.comment.create({
    data: {
      id: "comment",
      bookId: "book",
      userId: otherReader.id,
      body: "Kitap hakkındaki görüşüm.",
    },
  });
});
beforeEach(async () => {
  await db.user.updateMany({
    data: { banned: false, bannedAt: null, banReason: "", emailVerified: true },
  });
  await db.user.updateMany({
    where: { id: { in: [admin.id, otherAdmin.id] } },
    data: { role: "admin" },
  });
  await db.user.updateMany({
    where: { id: { in: [reader.id, otherReader.id] } },
    data: { role: "reader" },
  });
  await db.book.update({
    where: { id: "book" },
    data: { hidden: false, status: "PUBLISHED" },
  });
  await db.comment.update({
    where: { id: "comment" },
    data: { hidden: false },
  });
  await db.commentLike.deleteMany();
  await db.session.deleteMany();
  await db.auditLog.deleteMany();
  await db.rateLimit.deleteMany();
});
afterAll(close);

const sessionData = () => ({
  id: crypto.randomUUID(),
  userId: reader.id,
  token: crypto.randomUUID(),
  expiresAt: new Date(Date.now() + 60000),
});

describe("Kullanıcı banı", () => {
  it("ban gerekçesini kaydeder, oturumları siler ve yeni oturum oluşturmayı engeller", async () => {
    await db.session.create({ data: sessionData() });
    await setUserBan(db, admin, { id: reader.id, banned: true, reason });
    expect(
      await db.user.findUnique({ where: { id: reader.id } }),
    ).toMatchObject({
      banned: true,
      banReason: reason,
      bannedAt: expect.any(Date),
    });
    expect(await db.session.count({ where: { userId: reader.id } })).toBe(0);
    await expect(assertSessionAllowed(reader.id)).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: "BANNED_USER" },
    });
    await expect(db.session.create({ data: sessionData() })).rejects.toThrow();
    expect(await db.auditLog.findFirst()).toMatchObject({
      actorId: admin.id,
      targetId: reader.id,
      action: "ADMIN_USER_BANNED",
    });
  });

  it("ban kaldırıldığında eski oturumları geri açmadan yeni girişe izin verir", async () => {
    await setUserBan(db, admin, { id: reader.id, banned: true, reason });
    await setUserBan(db, admin, {
      id: reader.id,
      banned: false,
      reason: "İtiraz incelendi, ban kaldırıldı.",
    });
    expect(
      await db.user.findUnique({ where: { id: reader.id } }),
    ).toMatchObject({ banned: false, banReason: "", bannedAt: null });
    expect(await db.session.count()).toBe(0);
    await expect(assertSessionAllowed(reader.id)).resolves.toBeUndefined();
    await expect(
      db.session.create({ data: sessionData() }),
    ).resolves.toMatchObject({ userId: reader.id });
  });

  it("kendi hesabını banlamayı, yetkisiz ve banlı yöneticinin işlem yapmasını engeller", async () => {
    await expect(
      setUserBan(db, admin, { id: admin.id, banned: true, reason }),
    ).rejects.toMatchObject({ code: "SELF_BAN" });
    await expect(
      setUserBan(db, reader, { id: otherReader.id, banned: true, reason }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setUserBan(db, admin, { id: otherAdmin.id, banned: true, reason });
    await expect(
      setUserBan(db, otherAdmin, { id: reader.id, banned: true, reason }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("eşzamanlı banlarda en az bir aktif yönetici bırakır", async () => {
    const results = await Promise.allSettled([
      setUserBan(db, admin, { id: otherAdmin.id, banned: true, reason }),
      setUserBan(db, otherAdmin, { id: admin.id, banned: true, reason }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await db.user.count({
        where: { role: "admin", banned: false, emailVerified: true },
      }),
    ).toBe(1);
  });

  it("banlı yöneticinin rolünü kaldırırken aktif yöneticiyi korur", async () => {
    await setUserBan(db, admin, { id: otherAdmin.id, banned: true, reason });
    await updateUser(db, admin, {
      id: otherAdmin.id,
      name: otherAdmin.name,
      role: "reader",
      reason,
    });
    expect(
      await db.user.findUnique({ where: { id: otherAdmin.id } }),
    ).toMatchObject({ role: "reader", banned: true });
    expect(
      await db.user.count({ where: { role: "admin", banned: false } }),
    ).toBe(1);
  });

  it("banlı kullanıcıya yönetici rolü vermez; gerekçesiz banı reddeder", async () => {
    await expect(
      setUserBan(db, admin, { id: reader.id, banned: true, reason: "" }),
    ).rejects.toThrow();
    await setUserBan(db, admin, { id: reader.id, banned: true, reason });
    await expect(
      updateUser(db, admin, {
        id: reader.id,
        name: reader.name,
        role: "admin",
        reason,
      }),
    ).rejects.toMatchObject({ code: "USER_BANNED" });
  });
});

describe("Kitap yorumu beğenileri", () => {
  it("yinelenen ve eşzamanlı beğenileri tek kayıtta tutar", async () => {
    await Promise.all(
      Array.from({ length: 3 }, () => setCommentLike(db, reader, likeInput)),
    );
    expect(await db.commentLike.count()).toBe(1);
    expect(await setCommentLike(db, otherReader, likeInput)).toMatchObject({
      likeCount: 2,
      liked: true,
    });
  });

  it("yalnız oturum sahibinin beğenisini geri alır; tekrar geri alma sayıyı bozmaz", async () => {
    await setCommentLike(db, reader, likeInput);
    await setCommentLike(db, otherReader, likeInput);
    expect(
      await setCommentLike(db, reader, { ...likeInput, liked: false }),
    ).toMatchObject({ likeCount: 1, liked: false });
    expect(
      await setCommentLike(db, reader, { ...likeInput, liked: false }),
    ).toMatchObject({ likeCount: 1 });
    expect(await db.commentLike.findMany({ select: { userId: true } })).toEqual(
      [{ userId: otherReader.id }],
    );
  });

  it("gizli yorum, farklı kitap kimliği ve yayında olmayan kitaba beğeni eklemez", async () => {
    await expect(
      setCommentLike(db, reader, { ...likeInput, bookId: "other-book" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.comment.update({
      where: { id: "comment" },
      data: { hidden: true },
    });
    await expect(setCommentLike(db, reader, likeInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await db.comment.update({
      where: { id: "comment" },
      data: { hidden: false },
    });
    for (const data of [{ hidden: true }, { hidden: false, status: "DRAFT" }]) {
      await db.book.update({ where: { id: "book" }, data });
      await expect(setCommentLike(db, reader, likeInput)).rejects.toMatchObject(
        { code: "NOT_FOUND" },
      );
    }
    expect(await db.commentLike.count()).toBe(0);
  });

  it("banlı ve doğrulanmamış kullanıcıyı güncel veritabanı kaydından kontrol eder", async () => {
    await setUserBan(db, admin, { id: reader.id, banned: true, reason });
    await expect(setCommentLike(db, reader, likeInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await db.user.update({
      where: { id: reader.id },
      data: { banned: false, emailVerified: false },
    });
    await expect(setCommentLike(db, reader, likeInput)).rejects.toMatchObject({
      code: "EMAIL_UNVERIFIED",
    });
  });

  it("istek sınırını aştığında beğeni yazmaz", async () => {
    // Use the database clock, just like the production rate-limit query.
    await db.$executeRaw`
      INSERT INTO rate_limits (key, count, window_start)
      VALUES (${`${reader.id}:comment-like`}, 60, now())
    `;
    await expect(setCommentLike(db, reader, likeInput)).rejects.toMatchObject({
      code: "RATE_LIMIT",
    });
    expect(await db.commentLike.count()).toBe(0);
  });
});
