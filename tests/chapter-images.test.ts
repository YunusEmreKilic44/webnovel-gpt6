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
import { createLocalDatabase } from "./support/database";
import { migrateLocal } from "./support/migrate";
import {
  createBook,
  saveChapter,
  publishChapter,
  submitApplication,
  reviewApplication,
} from "@/modules/publishing/service";
import { parseContent, wordCount } from "@/modules/publishing/content";
import { chapterImageIds } from "@/modules/publishing/image-content";
import { getReadableChapterImage } from "@/modules/publishing/images";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { GET } from "@/app/api/chapter-images/[id]/route";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));
const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const writer = {
  id: "image-writer",
  name: "Yazar",
  role: "reader",
  emailVerified: true,
};
const stranger = {
  ...writer,
  id: "image-stranger",
  name: "Diğer Görsel Yazarı",
};
const admin = {
  ...writer,
  id: "image-admin",
  name: "Görsel Yöneticisi",
  role: "admin",
};
const text = {
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "Gökyüzü aydınlanırken genç yolcu defterini açtı ve eski bir hikâyenin ilk satırlarını okumaya başladı. Yol uzun, sorular çoktu ama içinde taşıdığı umut her zamankinden daha güçlüydü. Bu yeni dünyada her kapının ardında başka bir sır saklanıyordu.",
    },
  ],
};
const doc = (...images: string[]) => ({
  type: "doc",
  content: [
    text,
    ...images.map((imageId) => ({
      type: "image",
      attrs: { imageId, alt: "Orman manzarası" },
    })),
    text,
  ],
});
const png = async () =>
  new File(
    [
      new Uint8Array(
        await sharp({
          create: { width: 20, height: 10, channels: 3, background: "green" },
        })
          .png()
          .toBuffer(),
      ),
    ],
    "test.png",
    { type: "image/png" },
  );
let bookId: string;
let chapterId: string;
let imageId: string;
const save = async (
  images: string[],
  expectedVersion: number,
  files = new Map<string, File>(),
  actor = writer,
) =>
  saveChapter(
    db,
    actor,
    {
      chapterId,
      title: "Resimli bölüm",
      rawContent: JSON.stringify(doc(...images)),
      expectedVersion,
    },
    files,
  );
const load = (id: string, viewerId: string | null = null) =>
  getReadableChapterImage(db, id, viewerId);

beforeAll(async () => {
  await migrateLocal(client);
  vi.mocked(getDb).mockReturnValue(db);
  for (const actor of [writer, stranger, admin])
    await db.user.create({
      data: { ...actor, email: `${actor.id}@example.test` },
    });
});
beforeEach(async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  await db.user.update({ where: { id: stranger.id }, data: { banned: false } });
  bookId = await createBook(db, writer, {
    title: "Resimli hikâye",
    description:
      "Ormanda geçen, resimlerle anlatılan uzun bir yolculuğun hikâyesi.",
    genres: ["Fantastik"],
    cover: "forest",
  });
  chapterId = (await db.chapter.findFirstOrThrow({ where: { bookId } })).id;
  imageId = crypto.randomUUID();
});
afterAll(close);

describe("Bölüm görselleri", () => {
  it("görseli ve sürümü birlikte kaydeder, WebP'ye çevirir, metin sırasını ve kelime sayısını korur", async () => {
    expect(await save([imageId], 1, new Map([[imageId, await png()]]))).toBe(2);
    const chapter = await db.chapter.findUniqueOrThrow({
      where: { id: chapterId },
    });
    expect(chapter.content).toEqual(doc(imageId));
    expect(chapter.publishedContent).toBeNull();
    expect(chapter.wordCount).toBe(wordCount(doc()));
    const data = await load(imageId, writer.id);
    expect((await sharp(Buffer.from(data!)).metadata()).format).toBe("webp");
    expect(
      (await db.chapterRevision.findFirstOrThrow({ where: { chapterId } }))
        .content,
    ).toEqual(doc(imageId));
    await save([imageId], 2);
    expect(await db.chapterImage.count({ where: { chapterId } })).toBe(1);
  });

  it("taslak görsellerini yalnız yazar ve doğrulanmış yöneticiye açar; kaydetmeyi sahiplikle sınırlar", async () => {
    await save([imageId], 1, new Map([[imageId, await png()]]));
    expect(await load(imageId)).toBeNull();
    expect(await load(imageId, stranger.id)).toBeNull();
    expect(await load(imageId, admin.id)).not.toBeNull();
    const otherId = crypto.randomUUID();
    await expect(
      save([otherId], 2, new Map([[otherId, await png()]]), stranger),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      await db.chapterImage.findUnique({ where: { id: otherId } }),
    ).toBeNull();
  });

  it("inceleme anlık görüntüsünün görsellerini sonraki taslaklardan bağımsız yayımlar", async () => {
    await save([imageId], 1, new Map([[imageId, await png()]]));
    await submitApplication(db, writer, bookId, "PUBLICATION");
    const application = await db.application.findFirstOrThrow({
      where: { bookId },
    });
    const draftImage = crypto.randomUUID();
    await save([draftImage], 2, new Map([[draftImage, await png()]]));
    await reviewApplication(
      db,
      admin,
      application.id,
      "APPROVED",
      "İçerik ve görseller yayın için uygun bulundu.",
    );
    expect(await load(imageId)).not.toBeNull();
    expect(await load(draftImage)).toBeNull();
    expect(await load(draftImage, writer.id)).not.toBeNull();
    await publishChapter(db, writer, chapterId, 3);
    expect(await load(draftImage)).not.toBeNull();
    expect(await load(imageId)).toBeNull();
    // Saved history and application previews still need the old asset.
    expect(await load(imageId, admin.id)).not.toBeNull();
  });

  it("ücretli, gizli ve yayından kaldırılmış bölümlerin görsellerine erişimi denetler", async () => {
    await db.book.update({
      where: { id: bookId },
      data: {
        status: "PUBLISHED",
        premiumStatus: "ACTIVE",
        firstPremiumApprovedAt: new Date("2020-01-01"),
      },
    });
    await save([imageId], 1, new Map([[imageId, await png()]]));
    await publishChapter(db, writer, chapterId, 2);
    await db.chapter.update({
      where: { id: chapterId },
      data: { accessType: "PAID" },
    });
    expect(await load(imageId)).toBeNull();
    expect(await load(imageId, stranger.id)).toBeNull();
    await db.chapterUnlock.create({
      data: {
        id: crypto.randomUUID(),
        userId: stranger.id,
        chapterId,
        coinsSpent: 5,
      },
    });
    expect(await load(imageId, stranger.id)).not.toBeNull();
    await db.user.update({
      where: { id: stranger.id },
      data: { banned: true },
    });
    expect(await load(imageId, stranger.id)).toBeNull();
    await db.user.update({
      where: { id: stranger.id },
      data: { banned: false },
    });
    await db.chapter.update({
      where: { id: chapterId },
      data: { hidden: true },
    });
    expect(await load(imageId, stranger.id)).toBeNull();
    await db.chapter.update({
      where: { id: chapterId },
      data: { hidden: false },
    });
    await db.book.update({ where: { id: bookId }, data: { hidden: true } });
    expect(await load(imageId, stranger.id)).toBeNull();
  });

  it("büyük görselleri okuma sütununa uygun boyuta küçültür, küçükleri büyütmez", async () => {
    const huge = new File(
      [
        new Uint8Array(
          await sharp({
            create: {
              width: 2600,
              height: 4000,
              channels: 3,
              background: "blue",
            },
          })
            .jpeg()
            .toBuffer(),
        ),
      ],
      "huge.jpg",
      { type: "image/jpeg" },
    );
    await save([imageId], 1, new Map([[imageId, huge]]));
    const stored = await db.chapterImage.findUniqueOrThrow({
      where: { id: imageId },
    });
    const meta = await sharp(Buffer.from(stored.imageData)).metadata();
    expect(meta.height).toBeLessThanOrEqual(2000);
    expect(meta.width).toBeLessThanOrEqual(1600);
    // Aspect ratio is kept (2600×4000 → 1300×2000).
    expect(meta).toMatchObject({ width: 1300, height: 2000 });

    const small = crypto.randomUUID();
    await save([small], 2, new Map([[small, await png()]]));
    const tiny = await db.chapterImage.findUniqueOrThrow({
      where: { id: small },
    });
    expect(await sharp(Buffer.from(tiny.imageData)).metadata()).toMatchObject({
      width: 20,
      height: 10,
    });
  });

  it("bozuk dosyada, eksik görselde veya sürüm çakışmasında hiçbir kısmi kayıt bırakmaz", async () => {
    await expect(
      save(
        [imageId],
        1,
        new Map([[imageId, new File(["invalid"], "invalid.png")]]),
      ),
    ).rejects.toMatchObject({ code: "IMAGE_INVALID" });
    await expect(save([imageId], 1)).rejects.toMatchObject({
      code: "IMAGE_MISSING",
    });
    const other = crypto.randomUUID();
    await expect(
      save([imageId, other], 1, new Map([[imageId, await png()]])),
    ).rejects.toThrow("Bir bölüme en fazla 1 görsel ekleyebilirsin.");
    await expect(
      save([imageId], 99, new Map([[imageId, await png()]])),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(await db.chapterImage.count({ where: { chapterId } })).toBe(0);
    expect(await db.chapterRevision.count({ where: { chapterId } })).toBe(0);
    expect(
      (await db.chapter.findUniqueOrThrow({ where: { id: chapterId } }))
        .version,
    ).toBe(1);
  });

  it("başka bölümün görselini kullanamaz; yeni dosya mevcut görüntünün baytlarını değiştiremez", async () => {
    await save([imageId], 1, new Map([[imageId, await png()]]));
    const original = await load(imageId, writer.id);
    const replacement = new File(
      [
        new Uint8Array(
          await sharp({
            create: { width: 30, height: 30, channels: 3, background: "red" },
          })
            .png()
            .toBuffer(),
        ),
      ],
      "different.png",
    );
    await save([imageId], 2, new Map([[imageId, replacement]]));
    expect(await load(imageId, writer.id)).toEqual(original);
    const otherBook = await createBook(db, writer, {
      title: "Başka bir kitap",
      description: "Başka bir dünyada geçen resimli maceranın uzun hikâyesi.",
      genres: ["Fantastik"],
      cover: "forest",
    });
    const chapter = await db.chapter.findFirstOrThrow({
      where: { bookId: otherBook },
    });
    await expect(
      saveChapter(db, writer, {
        chapterId: chapter.id,
        title: "Bölüm",
        rawContent: JSON.stringify(doc(imageId)),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_MISSING" });
  });

  it("harici URL, HTML, görsel içine metin ve aşırı sayıda görseli reddeder", () => {
    for (const image of [
      {
        type: "image",
        attrs: { imageId, alt: "", src: "https://example.com/track.png" },
      },
      { type: "image", attrs: { imageId: "../../secret", alt: "" } },
      { type: "image", attrs: { imageId, alt: "" }, text: "sahte kelimeler" },
    ])
      expect(() =>
        parseContent(JSON.stringify({ type: "doc", content: [image] })),
      ).toThrow();
    expect(() =>
      parseContent(JSON.stringify(doc(imageId, crypto.randomUUID()))),
    ).toThrow();
    expect(() => parseContent(JSON.stringify(doc(imageId, imageId)))).toThrow(
      "Bir bölüme en fazla 1 görsel ekleyebilirsin.",
    );
    expect(chapterImageIds(parseContent(JSON.stringify(doc())))).toEqual([]);
    expect(() =>
      parseContent(
        JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [doc(imageId).content[1]] }],
        }),
      ),
    ).toThrow();
    expect(chapterImageIds(parseContent(JSON.stringify(doc(imageId))))).toEqual(
      [imageId],
    );
  });

  it("görsel HTTP yanıtlarını ortak önbelleğe açmaz ve misafire taslak baytlarını vermez", async () => {
    await save([imageId], 1, new Map([[imageId, await png()]]));
    const request = () =>
      GET(new Request(`http://localhost/api/chapter-images/${imageId}`), {
        params: Promise.resolve({ id: imageId }),
      });
    expect((await request()).status).toBe(404);
    vi.mocked(getCurrentUser).mockResolvedValue({
      ...writer,
      email: "writer@example.test",
      avatarUrl: null,
      slug: "yazar",
      coinBalance: 0,
    });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
