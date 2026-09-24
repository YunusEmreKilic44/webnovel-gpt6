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
import sharp from "sharp";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import { deleteImage, uploadImage } from "@/lib/cloudinary";
import { cloudinaryLoader } from "@/lib/cloudinary-loader";
import { createBook, updateBookDetails } from "@/modules/publishing/service";
import { updateBook } from "@/modules/admin/service";
import { updateAvatar } from "@/modules/account/service";

vi.mock("server-only", () => ({}));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: vi.fn(),
}));
vi.mock("@/lib/cloudinary", () => ({
  mediaFolder: (name: string) => `test/${name}`,
  uploadImage: vi.fn(async (_data: Uint8Array, folder: string) => {
    const publicId = `${folder}/${crypto.randomUUID()}`;
    return {
      url: `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.webp`,
      publicId,
      width: 12,
      height: 18,
    };
  }),
  deleteImage: vi.fn(async () => {}),
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const writer = {
  id: "writer",
  name: "Yazar",
  role: "reader" as const,
  emailVerified: true,
};
const stranger = { ...writer, id: "stranger", name: "Başka Yazar" };
const admin = {
  ...writer,
  id: "admin",
  name: "Yönetici",
  role: "admin" as const,
};
const book = {
  title: "Kapaklı kitap",
  description:
    "Kapak yükleme akışını deneyen, yeterince uzun bir arka kapak yazısı.",
  genres: ["Fantastik"] as ["Fantastik"],
  cover: "ocean" as const,
};
const details = (bookId: string) => ({
  ...book,
  bookId,
  subtitle: "",
  storyStatus: "ONGOING" as const,
});
const coverFile = async () =>
  new File(
    [
      new Uint8Array(
        await sharp({
          create: { width: 12, height: 18, channels: 3, background: "blue" },
        })
          .png()
          .toBuffer(),
      ),
    ],
    "kapak.png",
    { type: "image/png" },
  );

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [writer, stranger, admin])
    await db.user.create({
      data: { ...actor, email: `${actor.id}@example.test` },
    });
});
beforeEach(() => {
  vi.mocked(uploadImage).mockClear();
  vi.mocked(deleteImage).mockClear();
});
afterAll(close);

describe("Kitap kapağı yükleme", () => {
  it("kitabı yüklenen kapakla oluşturur; kapak WebP'ye çevrilip covers klasörüne gider", async () => {
    const id = await createBook(db, writer, book, await coverFile());
    const [sent, folder] = vi.mocked(uploadImage).mock.calls[0];
    expect(folder).toBe("test/covers");
    expect((await sharp(Buffer.from(sent)).metadata()).format).toBe("webp");
    const saved = await db.book.findUniqueOrThrow({ where: { id } });
    expect(saved.cover).toBe("ocean");
    expect(saved.coverUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(saved.coverPublicId).toMatch(/^test\/covers\//);
  });

  it("dosya seçilmezse hazır illüstrasyonla oluşturur ve yükleme yapmaz", async () => {
    const id = await createBook(db, writer, book, null);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(await db.book.findUniqueOrThrow({ where: { id } })).toMatchObject({
      cover: "ocean",
      coverUrl: null,
    });
  });

  it("yazar kitabın adını, alt başlığını, açıklamasını, türünü ve durumunu değiştirir; bağlantı aynı kalır", async () => {
    const id = await createBook(db, writer, book, null);
    const { slug } = await db.book.findUniqueOrThrow({ where: { id } });
    await updateBookDetails(
      db,
      writer,
      {
        ...details(id),
        title: "Yeni ad",
        subtitle: "Birinci kitap",
        description:
          "Tamamen yenilenmiş, okuru ilk satırdan yakalayan bir arka kapak yazısı.",
        genres: ["Gizem"],
        storyStatus: "COMPLETED",
      },
      null,
    );
    expect(await db.book.findUniqueOrThrow({ where: { id } })).toMatchObject({
      title: "Yeni ad",
      subtitle: "Birinci kitap",
      genres: ["Gizem"],
      storyStatus: "COMPLETED",
      slug,
    });
    const log = await db.auditLog.findFirstOrThrow({
      where: { targetId: id, action: "book.updated" },
    });
    expect(log.detail).toContain("title");
    await expect(
      updateBookDetails(db, writer, { ...details(id), title: "ab" }, null),
    ).rejects.toThrow();
  });

  it("kapağı değiştirir, eskisini siler ve hazır illüstrasyona dönebilir", async () => {
    const id = await createBook(db, writer, book, await coverFile());
    const first = await db.book.findUniqueOrThrow({ where: { id } });
    await updateBookDetails(
      db,
      writer,
      { ...details(id), cover: "rose" },
      await coverFile(),
    );
    const second = await db.book.findUniqueOrThrow({ where: { id } });
    expect(second.coverPublicId).not.toBe(first.coverPublicId);
    expect(second.cover).toBe("rose");
    expect(deleteImage).toHaveBeenLastCalledWith(first.coverPublicId);

    // Changing only the preset keeps the uploaded cover.
    await updateBookDetails(
      db,
      writer,
      { ...details(id), cover: "sand" },
      null,
    );
    expect(await db.book.findUniqueOrThrow({ where: { id } })).toMatchObject({
      cover: "sand",
      coverUrl: second.coverUrl,
    });

    await updateBookDetails(
      db,
      writer,
      { ...details(id), cover: "sand", removeCoverImage: true },
      null,
    );
    expect(await db.book.findUniqueOrThrow({ where: { id } })).toMatchObject({
      coverUrl: null,
      coverPublicId: null,
    });
    expect(deleteImage).toHaveBeenLastCalledWith(second.coverPublicId);
    expect(
      await db.auditLog.count({
        where: { targetId: id, action: "book.updated" },
      }),
    ).toBe(3);
  });

  it("başkasının kitabı düzenlenemez; yüklenen dosya geri silinir", async () => {
    const id = await createBook(db, writer, book, null);
    await expect(
      updateBookDetails(
        db,
        stranger,
        { ...details(id), title: "Ele geçirilmiş", cover: "rose" },
        await coverFile(),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const orphan = (await vi.mocked(uploadImage).mock.results[0].value)
      .publicId;
    expect(deleteImage).toHaveBeenCalledWith(orphan);
    expect(await db.book.findUniqueOrThrow({ where: { id } })).toMatchObject({
      cover: "ocean",
      coverUrl: null,
    });
  });

  it("yönetici uygunsuz kapağı kaldırabilir", async () => {
    const id = await createBook(db, writer, book, await coverFile());
    const { coverPublicId } = await db.book.findUniqueOrThrow({
      where: { id },
    });
    await updateBook(db, admin, {
      id,
      reason: "Uygunsuz kapak görseli",
      title: book.title,
      description: book.description,
      genres: book.genres,
      storyStatus: "ONGOING",
      hidden: false,
      featured: false,
      removeCoverImage: true,
    });
    expect(await db.book.findUniqueOrThrow({ where: { id } })).toMatchObject({
      coverUrl: null,
      cover: "ocean",
    });
    expect(deleteImage).toHaveBeenLastCalledWith(coverPublicId);
  });
});

describe("Profil resmi", () => {
  it("yükler, kare WebP'ye çevirir, değiştirince eskisini ve kaldırınca kendisini siler", async () => {
    const url = await updateAvatar(db, writer, await coverFile());
    const [sent, folder] = vi.mocked(uploadImage).mock.calls[0];
    expect(folder).toBe("test/avatars");
    const meta = await sharp(Buffer.from(sent)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(meta.height);
    const first = await db.user.findUniqueOrThrow({ where: { id: writer.id } });
    expect(first.avatarUrl).toBe(url);

    await updateAvatar(db, writer, await coverFile());
    expect(deleteImage).toHaveBeenLastCalledWith(first.avatarPublicId);
    const second = await db.user.findUniqueOrThrow({
      where: { id: writer.id },
    });

    await updateAvatar(db, writer, null, true);
    expect(deleteImage).toHaveBeenLastCalledWith(second.avatarPublicId);
    expect(
      await db.user.findUniqueOrThrow({ where: { id: writer.id } }),
    ).toMatchObject({ avatarUrl: null, avatarPublicId: null });
  });

  it("dosya olmadan kaydetmez; banlı kullanıcının yüklemesini geri siler", async () => {
    await expect(updateAvatar(db, writer, null)).rejects.toMatchObject({
      code: "IMAGE_REQUIRED",
    });
    await db.user.update({
      where: { id: stranger.id },
      data: { banned: true },
    });
    await expect(
      updateAvatar(db, stranger, await coverFile()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const orphan = (await vi.mocked(uploadImage).mock.results[0].value)
      .publicId;
    expect(deleteImage).toHaveBeenCalledWith(orphan);
  });
});

describe("Cloudinary loader", () => {
  it("genişliği ve otomatik formatı URL'ye ekler, diğer adreslere dokunmaz", () => {
    expect(
      cloudinaryLoader({
        src: "https://res.cloudinary.com/demo/image/upload/v1/satir/covers/a.webp",
        width: 384,
      }),
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_384/v1/satir/covers/a.webp",
    );
    expect(cloudinaryLoader({ src: "/art/ember.png", width: 384 })).toBe(
      "/art/ember.png",
    );
  });
});
