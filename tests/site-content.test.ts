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
} from "@/modules/site-content/queries";

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
