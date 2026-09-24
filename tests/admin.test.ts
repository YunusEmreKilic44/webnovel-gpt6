import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import {
  updateUser,
  revokeUserSessions,
  updateBook,
  setChapterVisibility,
  setCommentVisibility,
} from "@/modules/admin/service";
import {
  adminFilters,
  getAdminOverview,
  getAdminUsers,
  getAdminUser,
  getAdminBooks,
  getAdminBook,
  getAdminChapters,
  getAdminChapter,
  getAdminComments,
  getAdminApplications,
  getAdminAudit,
} from "@/modules/admin/queries";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("ADMIN_NOT_FOUND");
  },
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const admin = {
  id: "admin",
  name: "Yönetici",
  email: "admin@example.test",
  role: "admin",
  emailVerified: true,
  avatarUrl: null,
  coinBalance: 0,
};
const secondAdmin = {
  ...admin,
  id: "second-admin",
  email: "second@example.test",
};
const writer = {
  ...admin,
  id: "writer",
  email: "writer@example.test",
  role: "reader",
};
const unverified = {
  ...writer,
  id: "unverified",
  email: "unverified@example.test",
  emailVerified: false,
};
const reason = "İçerik ve hesap incelemesi tamamlandı.";
const content = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Bölüm metni." }] },
  ],
};
const bookEdit = {
  id: "book",
  reason,
  title: "Yönetilen Kitap",
  description: "Yönetici tarafından incelenen fantastik bir yolculuk hikâyesi.",
  genres: ["Fantastik"] as ["Fantastik"],
  storyStatus: "ONGOING" as const,
  hidden: false,
  featured: false,
};
const filters = adminFilters({});

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  await db.user.createMany({ data: [admin, secondAdmin, writer, unverified] });
  await db.book.create({
    data: {
      id: "book",
      authorId: writer.id,
      title: bookEdit.title,
      slug: "yonetilen-kitap",
      description: bookEdit.description,
      genres: ["Fantastik"],
      status: "PUBLISHED",
    },
  });
  await db.volume.create({
    data: { id: "volume", bookId: "book", title: "İlk Cilt", position: 1 },
  });
  await db.chapter.create({
    data: {
      id: "chapter",
      bookId: "book",
      volumeId: "volume",
      title: "İlk Bölüm",
      position: 1,
      content,
      publishedContent: content,
      publishedTitle: "İlk Bölüm",
      status: "PUBLISHED",
      firstPublishedAt: new Date(),
    },
  });
  await db.comment.create({
    data: {
      id: "comment",
      bookId: "book",
      userId: writer.id,
      body: "Örnek yorum metni.",
    },
  });
});
beforeEach(async () => {
  vi.mocked(requireUser).mockResolvedValue(admin);
  await db.user.updateMany({
    where: { id: { in: [admin.id, secondAdmin.id] } },
    data: { role: "admin", emailVerified: true },
  });
  await db.user.update({
    where: { id: writer.id },
    data: { role: "reader", name: writer.name },
  });
  await db.book.update({
    where: { id: "book" },
    data: { status: "PUBLISHED", hidden: false, featured: false },
  });
  await db.chapter.update({
    where: { id: "chapter" },
    data: { hidden: false },
  });
  await db.comment.update({
    where: { id: "comment" },
    data: { hidden: false },
  });
  await db.session.deleteMany();
  await db.auditLog.deleteMany();
});
afterAll(close);

describe("Yönetim işlemlerinin yetki ve kayıt sınırları", () => {
  it("okur ve doğrulanmamış yönetici yazamaz; eski yönetici rolünü veritabanında tekrar denetler", async () => {
    await expect(updateBook(db, writer, bookEdit)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      setCommentVisibility(
        db,
        { ...admin, emailVerified: false },
        { id: "comment", hidden: true, reason },
      ),
    ).rejects.toMatchObject({ code: "EMAIL_UNVERIFIED" });
    await expect(
      updateBook(db, { ...writer, role: "admin" }, bookEdit),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.auditLog.count()).toBe(0);
  });

  it("kendi rolünü düşürmeyi ve doğrulanmamış hesabı yönetici yapmayı reddeder", async () => {
    await expect(
      updateUser(db, admin, {
        id: admin.id,
        name: admin.name,
        role: "reader",
        reason,
      }),
    ).rejects.toMatchObject({ code: "SELF_DEMOTION" });
    await expect(
      updateUser(db, admin, {
        id: unverified.id,
        name: unverified.name,
        role: "admin",
        reason,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_UNVERIFIED" });
    expect(await db.auditLog.count()).toBe(0);
  });

  it("eşzamanlı yetki düşürmelerinde en az bir yönetici bırakır", async () => {
    const results = await Promise.allSettled([
      updateUser(db, admin, {
        id: secondAdmin.id,
        name: secondAdmin.name,
        role: "reader",
        reason,
      }),
      updateUser(db, secondAdmin, {
        id: admin.id,
        name: admin.name,
        role: "reader",
        reason,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await db.user.count({ where: { role: "admin", emailVerified: true } }),
    ).toBe(1);
  });

  it("rol değişince yalnız hedefin oturumlarını kapatır ve önceki/yeni değerleri kaydeder", async () => {
    await db.session.createMany({
      data: [
        {
          id: "target-session",
          userId: writer.id,
          token: "target-token",
          expiresAt: new Date(Date.now() + 60000),
        },
        {
          id: "admin-session",
          userId: admin.id,
          token: "admin-token",
          expiresAt: new Date(Date.now() + 60000),
        },
      ],
    });
    await updateUser(db, admin, {
      id: writer.id,
      name: "Yeni Yönetici",
      role: "admin",
      reason,
    });
    expect(await db.session.findMany({ select: { id: true } })).toEqual([
      { id: "admin-session" },
    ]);
    const log = await db.auditLog.findFirstOrThrow();
    expect(log).toMatchObject({
      actorId: admin.id,
      targetId: writer.id,
      action: "ADMIN_USER_UPDATED",
    });
    expect(JSON.parse(log.detail)).toMatchObject({
      reason,
      before: { role: "reader" },
      after: { name: "Yeni Yönetici", role: "admin" },
    });
  });

  it("oturum kapatma hesabı ve kitapları silmez", async () => {
    await db.session.create({
      data: {
        id: "session",
        userId: writer.id,
        token: "session-token",
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    expect(await revokeUserSessions(db, admin, { id: writer.id, reason })).toBe(
      1,
    );
    expect(
      await db.user.findUnique({ where: { id: writer.id } }),
    ).not.toBeNull();
    expect(await db.book.count({ where: { authorId: writer.id } })).toBe(1);
    expect(await db.auditLog.findFirst()).toMatchObject({
      action: "ADMIN_SESSIONS_REVOKED",
    });
  });

  it("kitap bilgilerini düzenlerken yayın ve premium durumunu değiştirmez", async () => {
    await updateBook(db, admin, {
      ...bookEdit,
      title: "Yeni Kitap Başlığı",
      genres: ["Gizem", "Fantastik", "Gizem"],
      featured: true,
    });
    expect(await db.book.findUnique({ where: { id: "book" } })).toMatchObject({
      title: "Yeni Kitap Başlığı",
      genres: ["Fantastik", "Gizem"],
      featured: true,
      status: "PUBLISHED",
      premiumStatus: "NONE",
    });
    await expect(
      updateBook(db, admin, { ...bookEdit, genres: [] }),
    ).rejects.toThrow();
    await expect(
      updateBook(db, admin, { ...bookEdit, hidden: true, featured: true }),
    ).rejects.toMatchObject({ code: "NOT_PUBLIC" });
    await db.book.update({
      where: { id: "book" },
      data: { status: "DRAFT", featured: false },
    });
    await expect(
      updateBook(db, admin, { ...bookEdit, featured: true }),
    ).rejects.toMatchObject({ code: "NOT_PUBLIC" });
  });

  it("bölüm ve yorumları gerekçeyle gizler ve geri açar; metni ve ilk yayın tarihini korur", async () => {
    const original = await db.chapter.findUniqueOrThrow({
      where: { id: "chapter" },
    });
    for (const hidden of [true, false]) {
      await setChapterVisibility(db, admin, { id: "chapter", hidden, reason });
      await setCommentVisibility(db, admin, { id: "comment", hidden, reason });
      expect(
        await db.chapter.findUnique({ where: { id: "chapter" } }),
      ).toMatchObject({
        hidden,
        publishedContent: original.publishedContent,
        firstPublishedAt: original.firstPublishedAt,
      });
      expect(
        await db.comment.findUnique({ where: { id: "comment" } }),
      ).toMatchObject({ hidden, body: "Örnek yorum metni." });
    }
    expect(await db.auditLog.count()).toBe(4);
  });

  it("eksik hedefi ve boş gerekçeyi reddeder", async () => {
    await expect(
      setCommentVisibility(db, admin, { id: "missing", hidden: true, reason }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setChapterVisibility(db, admin, {
        id: "chapter",
        hidden: true,
        reason: " ",
      }),
    ).rejects.toThrow();
    expect(await db.auditLog.count()).toBe(0);
  });

  it("işlem kaydı yazılamazsa değişikliği de geri alır", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    await db.auditLog.create({
      data: { id, actorId: admin.id, targetId: "comment", action: "EXISTING" },
    });
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(id);
    try {
      await expect(
        setCommentVisibility(db, admin, {
          id: "comment",
          hidden: true,
          reason,
        }),
      ).rejects.toThrow();
      expect(
        await db.comment.findUnique({ where: { id: "comment" } }),
      ).toMatchObject({ hidden: false });
    } finally {
      uuid.mockRestore();
    }
  });
});

describe("Yönetim sayfalarının veri erişimi", () => {
  it("tüm sorgular yönetici yetkisini ayrı ayrı denetler", async () => {
    vi.mocked(requireUser).mockResolvedValue(writer);
    for (const query of [
      () => getAdminOverview(),
      () => getAdminUsers(filters),
      () => getAdminUser(writer.id),
      () => getAdminBooks(filters),
      () => getAdminBook("book"),
      () => getAdminChapters("book", filters),
      () => getAdminChapter("book", "chapter"),
      () => getAdminComments(filters),
      () => getAdminApplications(filters),
      () => getAdminAudit(filters),
    ])
      await expect(query()).rejects.toThrow("ADMIN_NOT_FOUND");
  });

  it("aramayı ve rol filtresini uygular; parola ve oturum tokenı döndürmez", async () => {
    const result = await getAdminUsers(
      adminFilters({ q: "writer@example.test" }),
    );
    expect(result.total).toBe(1);
    expect(result.rows[0]).toMatchObject({ id: writer.id });
    expect(result.rows[0]).not.toHaveProperty("accounts");
    const detail = await getAdminUser(writer.id);
    expect(detail).not.toHaveProperty("sessions");
    expect(
      (await getAdminUsers(adminFilters({ filter: "admin" }))).rows,
    ).toHaveLength(2);
  });

  it("bölüm önizlemesini kitap kimliğiyle sınırlar", async () => {
    expect(await getAdminChapter("other-book", "chapter")).toBeNull();
    expect(await getAdminChapter("book", "chapter")).toMatchObject({
      id: "chapter",
      content,
      publishedContent: content,
    });
  });

  it("geçersiz sayfalama girdilerini sınırlar ve boş listeleri döndürür", async () => {
    expect(adminFilters({ page: "-1", q: ["unexpected"] })).toEqual({
      page: 1,
      q: "",
      filter: "",
    });
    expect(adminFilters({ page: "1.5" }).page).toBe(1);
    expect(adminFilters({ page: "9999999" }).page).toBe(100000);
    expect((await getAdminBooks(adminFilters({ page: "2" }))).rows).toEqual([]);
  });
});
