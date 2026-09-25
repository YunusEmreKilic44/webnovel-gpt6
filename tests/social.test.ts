import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import {
  addProfileComment,
  getFollowState,
  getProfileComments,
  removeProfileComment,
  setFollow,
} from "@/modules/social/service";
import {
  getNotifications,
  markNotificationRead,
} from "@/modules/notifications/service";
import {
  publishChapter,
  reviewApplication,
  submitApplication,
} from "@/modules/publishing/service";
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
const fan = user("fan");
const other = user("other");
const admin = user("admin", { role: "admin" });
const banned = user("banned", { banned: true });
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `kelime${i}`).join(" ");
const content = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: words(40) }] },
  ],
};

/** A draft book whose first chapter is ready for review. */
async function draftBook(id: string) {
  await db.book.create({
    data: {
      id,
      authorId: author.id,
      slug: id,
      title: `Kitap ${id}`,
      description:
        "Takipçi bildirimlerini deneyen yeterince uzun bir açıklama.",
      genres: ["Fantastik"],
    },
  });
  await db.volume.create({
    data: { id: `${id}-v`, bookId: id, title: "Cilt", position: 1 },
  });
  await db.chapter.create({
    data: {
      id: `${id}-c1`,
      bookId: id,
      volumeId: `${id}-v`,
      title: "İlk bölüm",
      position: 1,
      content,
      wordCount: 40,
    },
  });
}
const newBookNotices = async (userId: string) =>
  (await getNotifications(db, userId)).filter((n) => n.type === "NEW_BOOK");

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [author, fan, other, admin, banned])
    await db.user.create({ data: actor });
});
afterAll(close);

describe("Yazar takibi", () => {
  it("takip eder, tekrar etmek sorun olmaz, takibi bırakır; kendini takip edemez", async () => {
    await setFollow(db, fan, author.id, true);
    await setFollow(db, fan, author.id, true);
    expect(await getFollowState(db, author.id, fan.id)).toEqual({
      followers: 1,
      following: true,
    });
    await setFollow(db, other, author.id, true);
    await setFollow(db, other, author.id, false);
    expect(await getFollowState(db, author.id, other.id)).toEqual({
      followers: 1,
      following: false,
    });
    await expect(setFollow(db, author, author.id, true)).rejects.toMatchObject({
      code: "SELF_FOLLOW",
    });
    await expect(setFollow(db, fan, banned.id, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("kitap yayın onayıyla yayına girince yalnız takipçilere bir kez bildirim gider", async () => {
    await draftBook("first-book");
    await submitApplication(db, author, "first-book", "PUBLICATION");
    const application = await db.application.findFirstOrThrow({
      where: { bookId: "first-book" },
    });
    await reviewApplication(
      db,
      admin,
      application.id,
      "APPROVED",
      "Uygun kitap.",
    );
    const [notice] = await newBookNotices(fan.id);
    expect(notice).toMatchObject({
      type: "NEW_BOOK",
      book: { title: "Kitap first-book" },
    });
    expect(await markNotificationRead(db, fan.id, notice.id)).toBe(
      "/kitap/first-book",
    );
    expect(await getNotifications(db, other.id)).toEqual([]);
    // The author only hears about the approval, not about their own book.
    expect((await getNotifications(db, author.id)).map((n) => n.type)).toEqual([
      "APPLICATION_APPROVED",
    ]);
    expect(await db.notification.count({ where: { type: "NEW_BOOK" } })).toBe(
      1,
    );
  });

  it("onaylı kitap ilk bölümüyle yayına girdiğinde de bildirim gider; tekrar yayımlamak yinelemez", async () => {
    await draftBook("second-book");
    await db.book.update({
      where: { id: "second-book" },
      data: { status: "APPROVED" },
    });
    // publishChapter from APPROVED needs the reviewed snapshot.
    await db.application.create({
      data: {
        id: "second-app",
        bookId: "second-book",
        type: "PUBLICATION",
        status: "APPROVED",
        snapshot: {
          title: "Kitap second-book",
          description: "x",
          genres: ["Fantastik"],
          tags: [],
          chapters: [
            { id: "second-book-c1", title: "İlk bölüm", version: 1, content },
          ],
        },
      },
    });
    await publishChapter(db, author, "second-book-c1", 1);
    expect(await newBookNotices(fan.id)).toHaveLength(2);
    await publishChapter(db, author, "second-book-c1", 1);
    expect(await newBookNotices(fan.id)).toHaveLength(2);
  });
});

describe("Profil yorumları", () => {
  it("yorum eklenir; yazan veya profil sahibi silebilir, başkası silemez", async () => {
    const first = await addProfileComment(db, fan, {
      profileUserId: author.id,
      body: "Hikâyelerine bayılıyorum!",
    });
    const second = await addProfileComment(db, other, {
      profileUserId: author.id,
      body: "Yeni kitabı merakla bekliyorum.",
    });
    expect(
      (await getProfileComments(db, author.id)).map((c) => c.id).sort(),
    ).toEqual([first, second].sort());
    await expect(removeProfileComment(db, other, first)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await removeProfileComment(db, fan, first);
    await removeProfileComment(db, author, second);
    expect(await getProfileComments(db, author.id)).toEqual([]);
    await expect(
      addProfileComment(db, fan, { profileUserId: banned.id, body: "Selam" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      addProfileComment(db, fan, { profileUserId: author.id, body: " " }),
    ).rejects.toThrow();
  });

  it("profil yorumu şikâyet edilip yönetici kararıyla gizlenir", async () => {
    const id = await addProfileComment(db, other, {
      profileUserId: author.id,
      body: "Kaba bir profil yorumu",
    });
    await expect(
      createReport(db, other, {
        targetType: "PROFILE_COMMENT",
        targetId: id,
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ code: "SELF_REPORT" });
    await createReport(db, fan, {
      targetType: "PROFILE_COMMENT",
      targetId: id,
      reason: "HARASSMENT",
    });
    const report = await db.report.findFirstOrThrow({
      where: { targetType: "PROFILE_COMMENT" },
    });
    await resolveReport(db, admin, {
      id: report.id,
      decision: "RESOLVED",
      action: "HIDE",
      note: "Taciz içeren yorum gizlendi.",
    });
    expect(
      await db.profileComment.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject({ hidden: true });
    expect(await getProfileComments(db, author.id)).toEqual([]);
  });
});
