import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import { publishChapter, saveChapter } from "@/modules/publishing/service";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/modules/notifications/service";
import { canReadChapter, unlockChapter } from "@/modules/coins/service";

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
const follower = user("follower");
const second = user("second");
const stranger = user("stranger");
const banned = user("banned", { banned: true });
const text =
  "Gökyüzü aydınlanırken genç yolcu defterini açtı ve eski bir hikâyenin ilk satırlarını okumaya başladı. Yol uzun, sorular çoktu ama içinde taşıdığı umut her zamankinden daha güçlüydü. Bu yeni dünyada her kapının ardında başka bir sır saklanıyordu.";
const content = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
};

let position = 1;
/** A draft chapter in the published book, ready to be published by the author. */
async function draftChapter(title: string) {
  const id = `chapter-${position}`;
  await db.chapter.create({
    data: {
      id,
      bookId: "book",
      volumeId: "volume",
      title,
      position: position++,
      content,
      wordCount: 40,
    },
  });
  return id;
}

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [author, follower, second, stranger, banned])
    await db.user.create({ data: actor });
  await db.book.create({
    data: {
      id: "book",
      authorId: author.id,
      slug: "takip-edilen",
      title: "Takip edilen kitap",
      description: "Bildirim akışını deneyen yeterince uzun bir açıklama.",
      genres: ["Fantastik"],
      status: "PUBLISHED",
      premiumStatus: "ACTIVE",
      firstPremiumApprovedAt: new Date("2026-01-01T00:00:00Z"),
    },
  });
  await db.volume.create({
    data: { id: "volume", bookId: "book", title: "Cilt", position: 1 },
  });
  // The author following their own book must not notify themselves.
  for (const reader of [follower, second, banned, author])
    await db.libraryEntry.create({
      data: {
        id: `library-${reader.id}`,
        userId: reader.id,
        bookId: "book",
      },
    });
});
afterAll(close);

describe("Yeni bölüm bildirimleri", () => {
  it("ilk yayında yalnız kitabı kütüphanesinde olan okurlara bildirim gider", async () => {
    const chapterId = await draftChapter("Yeni bölüm");
    await publishChapter(db, author, chapterId, 1);
    const recipients = await db.notification.findMany({
      where: { chapterId },
      select: { userId: true, type: true, readAt: true },
      orderBy: { userId: "asc" },
    });
    expect(recipients).toEqual([
      { userId: "follower", type: "NEW_CHAPTER", readAt: null },
      { userId: "second", type: "NEW_CHAPTER", readAt: null },
    ]);
    expect(await getUnreadCount(db, follower.id)).toBe(1);
    expect(await getUnreadCount(db, stranger.id)).toBe(0);
    expect(await getUnreadCount(db, author.id)).toBe(0);
  });

  it("yayındaki bölümü düzenleyip yeniden yayımlamak tekrar bildirim üretmez", async () => {
    const chapterId = "chapter-1";
    await saveChapter(db, author, {
      chapterId,
      title: "Düzenlenmiş başlık",
      rawContent: JSON.stringify(content),
      expectedVersion: 1,
    });
    await publishChapter(db, author, chapterId, 2);
    expect(await db.notification.count({ where: { chapterId } })).toBe(2);
    const [item] = await getNotifications(db, follower.id);
    // Titles are read live, so the edit shows up in the existing notice.
    expect(item.chapter?.publishedTitle).toBe("Düzenlenmiş başlık");
  });

  it("okundu işaretleme yalnız bildirimin sahibine açıktır ve bölüme yönlendirir", async () => {
    const [item] = await getNotifications(db, follower.id);
    expect(await markNotificationRead(db, stranger.id, item.id)).toBeNull();
    expect(await markNotificationRead(db, follower.id, "")).toBeNull();
    expect(await getUnreadCount(db, follower.id)).toBe(1);
    expect(await markNotificationRead(db, follower.id, item.id)).toBe(
      "/oku/chapter-1",
    );
    expect(await getUnreadCount(db, follower.id)).toBe(0);
    expect(
      await getNotifications(db, follower.id, { filter: "unread" }),
    ).toEqual([]);
    // The other reader's copy is untouched.
    expect(await getUnreadCount(db, second.id)).toBe(1);
  });

  it("tümünü okundu işaretler; gizlenen bölümün bildirimi listelenmez ve sayılmaz", async () => {
    const hidden = await draftChapter("Sonra gizlenecek");
    await publishChapter(db, author, hidden, 1);
    expect(await getUnreadCount(db, second.id)).toBe(2);
    await db.chapter.update({ where: { id: hidden }, data: { hidden: true } });
    expect(await getUnreadCount(db, second.id)).toBe(1);
    expect(
      (await getNotifications(db, second.id)).map((n) => n.chapter?.id),
    ).toEqual(["chapter-1"]);
    expect(await markAllNotificationsRead(db, second.id)).toBe(2);
    expect(await getUnreadCount(db, second.id)).toBe(0);
  });

  it("premium bölüm bildirimi açılışa kadar kilitli bölüme götürür", async () => {
    const premium = await draftChapter("Premium bölüm");
    await publishChapter(db, author, premium, 1);
    await db.chapter.update({
      where: { id: premium },
      data: { accessType: "PAID" },
    });
    const [item] = await getNotifications(db, follower.id, {
      filter: "unread",
    });
    expect(item.chapter).toMatchObject({
      id: premium,
      accessType: "PAID",
      unlocked: false,
    });
    const target = await markNotificationRead(db, follower.id, item.id);
    expect(target).toBe(`/oku/${premium}`);
    const chapter = { id: premium, accessType: "PAID", authorId: author.id };
    expect(await canReadChapter(db, follower.id, chapter)).toBe(false);

    await db.user.update({
      where: { id: follower.id },
      data: { coinBalance: 10 },
    });
    await unlockChapter(db, follower, premium);
    expect(await canReadChapter(db, follower.id, chapter)).toBe(true);
    expect(
      (await getNotifications(db, follower.id)).find(
        (n) => n.chapter?.id === premium,
      )?.chapter?.unlocked,
    ).toBe(true);
  });
});
