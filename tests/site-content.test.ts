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
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { getDb } from "@/db";
import { deleteImage, uploadImage } from "@/lib/cloudinary";
import { createLocalDatabase } from "./support/database";
import { migrateLocal } from "./support/migrate";
import {
  saveAnnouncement,
  saveSlide,
  deleteSiteContent,
  prepareSlideImage,
} from "@/modules/site-content/service";
import {
  getAnnouncements,
  getHomeSlides,
  getAnnouncementArchive,
  getPublishedAnnouncement,
} from "@/modules/site-content/queries";
import { readAnnouncementBlocks } from "@/modules/site-content/announcement-content";

const png = () =>
  sharp({ create: { width: 20, height: 10, channels: 3, background: "red" } })
    .png()
    .toBuffer();

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({
  mediaFolder: (name: string) => `test/${name}`,
  uploadImage: vi.fn(async (_data: Uint8Array, folder: string) => {
    const publicId = `${folder}/${crypto.randomUUID()}`;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.webp`,
      publicId,
      width: 20,
      height: 10,
    };
  }),
  deleteImage: vi.fn(async () => {}),
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const admin = {
  id: "admin",
  name: "Yönetici",
  role: "admin",
  emailVerified: true,
};
const reader = { ...admin, id: "reader", role: "reader" };
const announcement = {
  title: "Yeni duyuru",
  body: "Yeni hikâyeler yayında.",
  linkPath: "/kesfet",
  linkLabel: "Keşfet",
  position: 0,
  published: false,
};
const slide = {
  title: "Yeni dünyalar",
  description: "Hikâyeye katıl.",
  linkPath: "/kesfet",
  linkLabel: "İncele",
  position: 0,
  published: false,
  imagePreset: "hero" as const,
  imageAlt: "Dağ manzarası",
  usePreset: false,
};
beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [admin, reader])
    await db.user.create({
      data: { ...actor, email: `${actor.id}@example.test` },
    });
});
beforeEach(async () => {
  await db.announcement.deleteMany();
  await db.homeSlide.deleteMany();
  await db.auditLog.deleteMany();
  await db.user.update({
    where: { id: admin.id },
    data: { role: "admin", banned: false },
  });
});
afterAll(close);

describe("Duyuru ve slider yönetimi", () => {
  it("arşiv tüm yayımlanan duyuruları sayfalar, ana sayfayı sınırlar ve taslak ayrıntısını gizler", async () => {
    await db.announcement.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        id: `archive-${i}`,
        title: `Duyuru ${i}`,
        body: `İçerik ${i}`,
        position: i,
        published: true,
      })),
    });
    const draft = await saveAnnouncement(db, admin, announcement);
    expect(await getPublishedAnnouncement(draft)).toBeNull();
    expect(await getPublishedAnnouncement("missing")).toBeNull();
    expect((await getAnnouncements()).map((item) => item.id)).toEqual([
      "archive-0",
      "archive-1",
      "archive-2",
    ]);
    const archive = await getAnnouncementArchive(2);
    expect(archive).toMatchObject({ total: 55, page: 2, pages: 5 });
    expect(archive.rows).toHaveLength(12);
    expect(archive.rows[0].id).toBe("archive-12");
    expect(archive.rows[0]).not.toHaveProperty("content");
    expect((await getAnnouncementArchive(999)).rows).toHaveLength(7);
    expect((await getAnnouncementArchive(NaN)).page).toBe(1);
    expect(await getPublishedAnnouncement("archive-54")).toMatchObject({
      body: "İçerik 54",
    });
  });

  it("metin arasına görsel kaydeder, sırasını ve dosyayı korur; kaldırırken medyayı temizler", async () => {
    vi.mocked(uploadImage).mockClear();
    vi.mocked(deleteImage).mockClear();
    const file = new File([new Uint8Array(await png())], "image.png", {
      type: "image/png",
    });
    const content = [
      { type: "text" as const, id: "intro", text: "Giriş metni" },
      { type: "image" as const, id: "photo", alt: "Etkinlik görseli" },
      { type: "text" as const, id: "outro", text: "Son metin" },
    ];
    const id = await saveAnnouncement(
      db,
      admin,
      { ...announcement, content, published: true },
      new Map([["photo", file]]),
    );
    const row = await db.announcement.findUniqueOrThrow({ where: { id } });
    const stored = readAnnouncementBlocks(row.content, row.body);
    expect(stored.map((block) => block.type)).toEqual([
      "text",
      "image",
      "text",
    ]);
    expect(row.body).toBe("Giriş metni\n\nSon metin");
    const image = stored[1];
    if (image.type !== "image") throw new Error("image missing");
    expect(image).toMatchObject({
      alt: "Etkinlik görseli",
      width: 20,
      height: 10,
    });
    expect(vi.mocked(uploadImage).mock.calls[0][1]).toBe("test/announcements");
    expect(
      (
        await sharp(
          Buffer.from(vi.mocked(uploadImage).mock.calls[0][0]),
        ).metadata()
      ).format,
    ).toBe("webp");
    await saveAnnouncement(db, admin, {
      ...announcement,
      id,
      content: [content[1], content[2], content[0]],
    });
    const reordered = await db.announcement.findUniqueOrThrow({
      where: { id },
    });
    expect(
      readAnnouncementBlocks(reordered.content, reordered.body)[0],
    ).toEqual(image);
    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(deleteImage).not.toHaveBeenCalledWith(image.publicId);
    await saveAnnouncement(
      db,
      admin,
      { ...announcement, id, content },
      new Map([["photo", file]]),
    );
    expect(deleteImage).toHaveBeenCalledWith(image.publicId);
    const replaced = await db.announcement.findUniqueOrThrow({ where: { id } });
    const replacement = readAnnouncementBlocks(
      replaced.content,
      replaced.body,
    )[1];
    if (replacement.type !== "image") throw new Error("image missing");
    await saveAnnouncement(db, admin, {
      ...announcement,
      id,
      content: [content[0], content[2]],
    });
    expect(deleteImage).toHaveBeenCalledWith(replacement.publicId);
    await saveAnnouncement(
      db,
      admin,
      { ...announcement, id, content },
      new Map([["photo", file]]),
    );
    const finalImage = (await vi.mocked(uploadImage).mock.results.at(-1)!.value)
      .publicId;
    await deleteSiteContent(db, admin, "announcement", id);
    expect(deleteImage).toHaveBeenCalledWith(finalImage);
  });

  it("başarısız ve kısmi yüklemeleri temizler; başka duyurunun görselini veya istemci URL'sini kabul etmez", async () => {
    vi.mocked(deleteImage).mockClear();
    const file = new File([new Uint8Array(await png())], "image.png", {
      type: "image/png",
    });
    const content = [
      { type: "text" as const, id: "text", text: "Duyuru metni" },
      { type: "image" as const, id: "photo", alt: "" },
    ];
    await expect(
      saveAnnouncement(
        db,
        admin,
        { ...announcement, id: "missing", content },
        new Map([["photo", file]]),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deleteImage).toHaveBeenCalledWith(
      (await vi.mocked(uploadImage).mock.results.at(-1)!.value).publicId,
    );
    await saveAnnouncement(
      db,
      admin,
      { ...announcement, content },
      new Map([["photo", file]]),
    );
    await expect(
      saveAnnouncement(db, admin, { ...announcement, content }),
    ).rejects.toMatchObject({ code: "IMAGE_MISSING" });
    const forged = [
      ...content.slice(0, 1),
      { ...content[1], url: "javascript:alert(1)", publicId: "another-image" },
    ];
    await expect(
      saveAnnouncement(db, admin, { ...announcement, content: forged }),
    ).rejects.toMatchObject({ code: "IMAGE_MISSING" });
    await expect(
      saveAnnouncement(
        db,
        admin,
        {
          ...announcement,
          content: [...content, { type: "image", id: "broken", alt: "" }],
        },
        new Map([
          ["photo", file],
          ["broken", new File(["broken"], "bad.png")],
        ]),
      ),
    ).rejects.toMatchObject({ code: "IMAGE_INVALID" });
    expect(deleteImage).toHaveBeenCalledWith(
      (await vi.mocked(uploadImage).mock.results.at(-1)!.value).publicId,
    );
    expect(await db.announcement.count()).toBe(1);
  });

  it("duyuru görsel yüklemelerini yetki ve boyut sınırlarıyla doğrular", async () => {
    vi.mocked(uploadImage).mockClear();
    const text = { type: "text" as const, id: "text", text: "Duyuru metni" };
    const image = { type: "image" as const, id: "image", alt: "" };
    const content = [text, image];
    await expect(
      saveAnnouncement(
        db,
        reader,
        { ...announcement, content },
        new Map([["image", new File(["data"], "x.png")]]),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveAnnouncement(
        db,
        admin,
        { ...announcement, content },
        new Map([
          ["image", new File([new Uint8Array(3 * 1024 * 1024 + 1)], "x.png")],
        ]),
      ),
    ).rejects.toMatchObject({ code: "IMAGE_SIZE" });
    await expect(
      saveAnnouncement(db, admin, {
        ...announcement,
        content: [
          text,
          ...Array.from({ length: 9 }, (_, i) => ({
            ...image,
            id: `image-${i}`,
          })),
        ],
      }),
    ).rejects.toThrow();
    await expect(
      saveAnnouncement(db, admin, { ...announcement, content: [text, text] }),
    ).rejects.toThrow();
    await expect(
      saveAnnouncement(db, admin, { ...announcement, content: [image] }),
    ).rejects.toThrow();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("otomatik katalog sayfalarını bir kez düzenlenebilir slaytlara taşır", async () => {
    const sql = await readFile(
      "prisma/migrations/20260926000000_managed_home_slides/migration.sql",
      "utf8",
    );
    await db.book.createMany({
      data: Array.from({ length: 8 }, (_, index) => ({
        id: `slider-book-${index}`,
        slug: `slider-book-${index}`,
        authorId: admin.id,
        title: `Kitap ${index}`,
        description: "Kitap açıklaması",
        genres: ["Fantastik"],
        status: index === 7 ? "DRAFT" : "PUBLISHED",
        featured: index === 0,
        cover: index === 0 ? "ember" : "forest",
        coverUrl:
          index === 1
            ? "https://res.cloudinary.com/demo/image/upload/book.webp"
            : null,
        updatedAt: new Date(2026, 0, 10 - index),
      })),
    });
    try {
      await client.exec(sql);
      const slides = await getHomeSlides();
      expect(slides).toHaveLength(6);
      expect(slides.map((item) => item.title)).toEqual(
        Array.from({ length: 6 }, (_, i) => `Kitap ${i}`),
      );
      expect(slides[0]).toMatchObject({
        imagePreset: "hero",
        linkPath: "/kitap/slider-book-0",
      });
      expect(slides[1].imageUrl).toContain("/book.webp");
      await saveSlide(
        db,
        admin,
        {
          ...slide,
          id: slides[0].id,
          title: "Düzenlenmiş sayfa",
          published: true,
          position: 9,
        },
        null,
      );
      await client.exec(sql);
      expect(await db.homeSlide.count()).toBe(6);
      expect((await getHomeSlides()).at(-1)?.title).toBe("Düzenlenmiş sayfa");
      for (const item of slides)
        await deleteSiteContent(db, admin, "slide", item.id);
      expect(await getHomeSlides()).toEqual([]);
    } finally {
      await db.book.deleteMany({
        where: { id: { startsWith: "slider-book-" } },
      });
    }
  });

  it("duyuruları taslakta tutar, yayınlar, sıralar ve yayından kaldırır", async () => {
    const id = await saveAnnouncement(db, admin, announcement);
    expect(await getAnnouncements()).toEqual([]);
    await saveAnnouncement(db, admin, {
      ...announcement,
      id,
      published: true,
      position: 2,
    });
    const first = await saveAnnouncement(db, admin, {
      ...announcement,
      title: "Önce göster",
      published: true,
      position: 1,
    });
    expect((await getAnnouncements()).map((row) => row.id)).toEqual([
      first,
      id,
    ]);
    await saveAnnouncement(db, admin, {
      ...announcement,
      id,
      body: "Güncel metin",
      published: false,
    });
    expect((await getAnnouncements()).map((row) => row.id)).toEqual([first]);
    expect(await db.announcement.findUnique({ where: { id } })).toMatchObject({
      body: "Güncel metin",
    });
    await deleteSiteContent(db, admin, "announcement", id);
    expect(await db.announcement.findUnique({ where: { id } })).toBeNull();
    expect(
      await db.auditLog.count({
        where: { action: "ADMIN_ANNOUNCEMENT_DELETED" },
      }),
    ).toBe(1);
  });

  it("okur, banlı yönetici ve yetkisi kaldırılmış yöneticinin değişiklik yapmasını engeller", async () => {
    await expect(
      saveAnnouncement(db, reader, announcement),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.user.update({ where: { id: admin.id }, data: { banned: true } });
    await expect(saveSlide(db, admin, slide, null)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await db.user.update({
      where: { id: admin.id },
      data: { banned: false, role: "reader" },
    });
    await expect(
      saveAnnouncement(db, admin, announcement),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      deleteSiteContent(db, admin, "slide", "missing"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.announcement.count()).toBe(0);
    expect(await db.homeSlide.count()).toBe(0);
  });

  it("tehlikeli bağlantıları ve eksik düğme metnini kabul etmez", async () => {
    for (const linkPath of [
      "javascript:alert(1)",
      "//example.com",
      "/\\example.com",
      "https://example.com",
    ]) {
      await expect(
        saveAnnouncement(db, admin, { ...announcement, linkPath }),
      ).rejects.toThrow();
    }
    await expect(
      saveSlide(db, admin, { ...slide, linkLabel: "" }, null),
    ).rejects.toThrow();
  });

  it("görseli WebP'ye çevirip Cloudinary'ye yükler, metin düzenlerken korur ve hazır görsele dönebilir", async () => {
    vi.mocked(uploadImage).mockClear();
    vi.mocked(deleteImage).mockClear();
    const file = new File([new Uint8Array(await png())], "image.png", {
      type: "image/png",
    });
    const id = await saveSlide(db, admin, slide, file);
    expect(await getHomeSlides()).toEqual([]);
    const [sent, folder] = vi.mocked(uploadImage).mock.calls[0];
    expect(folder).toBe("test/slides");
    expect((await sharp(Buffer.from(sent)).metadata()).format).toBe("webp");
    const before = await db.homeSlide.findUniqueOrThrow({ where: { id } });
    expect(before).toMatchObject({ imageData: null });
    expect(before.imageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    await saveSlide(
      db,
      admin,
      { ...slide, id, title: "Güncel başlık", published: true },
      null,
    );
    expect(
      await db.homeSlide.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({
      imageUrl: before.imageUrl,
      imagePublicId: before.imagePublicId,
    });
    expect(deleteImage).not.toHaveBeenCalledWith(before.imagePublicId);
    const visible = await getHomeSlides();
    expect(visible[0]).toMatchObject({ id, title: "Güncel başlık" });
    expect(visible[0]).not.toHaveProperty("imageData");
    expect(visible[0].imageUrl).toBe(before.imageUrl);

    // Replacing the image removes the previous asset.
    await saveSlide(db, admin, { ...slide, id, published: true }, file);
    expect(deleteImage).toHaveBeenLastCalledWith(before.imagePublicId);
    const replaced = await db.homeSlide.findUniqueOrThrow({ where: { id } });
    expect(replaced.imagePublicId).not.toBe(before.imagePublicId);

    await saveSlide(
      db,
      admin,
      { ...slide, id, usePreset: true, imagePreset: "forest" },
      null,
    );
    expect(deleteImage).toHaveBeenLastCalledWith(replaced.imagePublicId);
    expect(await db.homeSlide.findUnique({ where: { id } })).toMatchObject({
      imageUrl: null,
      imagePublicId: null,
      imagePreset: "forest",
    });
    expect(await getHomeSlides()).toEqual([]);
    await deleteSiteContent(db, admin, "slide", id);
    expect(await db.homeSlide.count()).toBe(0);
  });

  it("kayıt başarısız olursa yüklenen görseli siler; slayt silinince görseli de siler", async () => {
    vi.mocked(deleteImage).mockClear();
    const file = new File([new Uint8Array(await png())], "image.png", {
      type: "image/png",
    });
    await expect(
      saveSlide(db, admin, { ...slide, id: "missing" }, file),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const orphan = (await vi.mocked(uploadImage).mock.results.at(-1)!.value)
      .publicId;
    expect(deleteImage).toHaveBeenCalledWith(orphan);

    const id = await saveSlide(db, admin, slide, file);
    const { imagePublicId } = await db.homeSlide.findUniqueOrThrow({
      where: { id },
    });
    await deleteSiteContent(db, admin, "slide", id);
    expect(deleteImage).toHaveBeenLastCalledWith(imagePublicId);
  });

  it("eski veritabanı görsellerini API adresinden sunmaya devam eder", async () => {
    const id = await saveSlide(db, admin, { ...slide, published: true }, null);
    await db.homeSlide.update({
      where: { id },
      data: { imageData: new Uint8Array(await png()) },
    });
    expect((await getHomeSlides())[0].imageUrl).toContain(
      `/api/slides/${id}/image?v=`,
    );
  });

  it("bozuk ve aşırı büyük dosyaları reddeder", async () => {
    await expect(
      prepareSlideImage(
        new File(["not an image"], "fake.png", { type: "image/png" }),
      ),
    ).rejects.toMatchObject({ code: "IMAGE_INVALID" });
    await expect(
      prepareSlideImage(
        new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.png"),
      ),
    ).rejects.toMatchObject({ code: "IMAGE_SIZE" });
    await expect(
      prepareSlideImage(
        new File(
          ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'],
          "image.svg",
        ),
      ),
    ).rejects.toMatchObject({ code: "IMAGE_INVALID" });
  });
});
