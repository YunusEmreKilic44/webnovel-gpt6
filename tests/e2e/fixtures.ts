import "dotenv/config";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { openDatabase } from "../../src/db";
import { account, books, chapters, user, volumes } from "../../src/db/schema";
if (process.env.PGLITE_PATH !== ".data/e2e")
  throw new Error("Bu fixture yalnız ayrı E2E veritabanında çalıştırılır.");
const { db, close } = openDatabase();
try {
  await db.transaction(async (tx) => {
    const adminId = "e2e-admin";
    await tx
      .insert(user)
      .values({
        id: adminId,
        name: "Test Yöneticisi",
        email: "admin@e2e.example.test",
        emailVerified: true,
        role: "admin",
      })
      .onConflictDoNothing();
    await tx
      .insert(account)
      .values({
        id: "e2e-admin-account",
        accountId: adminId,
        userId: adminId,
        providerId: "credential",
        password: await hashPassword("E2E-test-only-password!2026"),
      })
      .onConflictDoNothing();
    await tx
      .insert(books)
      .values({
        id: "locked-fixture",
        authorId: adminId,
        title: "Erişim Sınırı",
        slug: "erisim-siniri",
        description:
          "Ücretli metnin HTML ve RSC yanıtına sızmadığını doğrulamak için ayrılmış test kitabı.",
        genre: "Gizem",
        status: "PUBLISHED",
        premiumStatus: "ACTIVE",
        firstPremiumApprovedAt: new Date("2026-09-01T00:00:00Z"),
        cover: "ocean",
      })
      .onConflictDoNothing();
    await tx
      .insert(volumes)
      .values({
        id: "locked-volume",
        bookId: "locked-fixture",
        title: "Test Cildi",
        position: 1,
      })
      .onConflictDoNothing();
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "SECRET_PAID_BODY_SHOULD_NOT_LEAK_2026" },
          ],
        },
      ],
    };
    await tx
      .insert(chapters)
      .values({
        id: "locked-chapter",
        bookId: "locked-fixture",
        volumeId: "locked-volume",
        title: "Kilitli bölüm",
        publishedTitle: "Kilitli bölüm",
        position: 1,
        content,
        publishedContent: content,
        status: "PUBLISHED",
        accessType: "PAID",
        priceMinor: 500,
        firstPublishedAt: new Date("2026-09-02T00:00:00Z"),
      })
      .onConflictDoNothing();
    // Keep the fixture out of the featured home shelf without hiding its access test.
    await tx
      .update(books)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(books.id, "locked-fixture"));
  });
} finally {
  await close();
}
