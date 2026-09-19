import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";

describe("Prisma SQL migration'ları", () => {
  it("verileri korur, kısıtları oluşturur ve tekrar çalıştırılabilir", async () => {
    const client = new PGlite();
    const { db, close } = createLocalDatabase(client);
    try {
      await migrateLocal(client);
      await client.query(
        'INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)',
        ["existing", "Mevcut Kullanıcı", "existing@example.test"],
      );
      await migrateLocal(client);
      await migrateLocal(client);
      expect(
        await db.user.findUnique({ where: { id: "existing" } }),
      ).toMatchObject({ name: "Mevcut Kullanıcı" });
      expect(
        (await client.query('SELECT * FROM "_prisma_migrations"')).rows,
      ).toHaveLength(2);
      const triggers = await client.query(
        "SELECT tgname FROM pg_trigger WHERE tgname IN ('chapter_first_publication_immutable', 'book_first_premium_approval_immutable')",
      );
      expect(triggers.rows).toHaveLength(2);
    } finally {
      await close();
    }
  });
  it("tamamlanmamış migration geçmişini kabul etmez", async () => {
    const client = new PGlite();
    try {
      await migrateLocal(client);
      await client.exec('UPDATE "_prisma_migrations" SET finished_at = NULL');
      await expect(migrateLocal(client)).rejects.toThrow("uyuşmuyor");
    } finally {
      await client.close();
    }
  });
  it("migration checksum değişikliğini tespit eder", async () => {
    const client = new PGlite();
    try {
      await migrateLocal(client);
      await client.exec(
        "UPDATE \"_prisma_migrations\" SET checksum = 'changed'",
      );
      await expect(migrateLocal(client)).rejects.toThrow("uyuşmuyor");
    } finally {
      await client.close();
    }
  });
});
