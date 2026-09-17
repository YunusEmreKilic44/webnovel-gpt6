import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { legacyHashes, migrateLocal, migrationFiles } from "@/db/migrate-local";
import { createLocalDatabase } from "@/db";

describe("Prisma migration geçişi", () => {
  it("eski verileri korur, migration geçmişini taşır ve tekrar çalıştırılabilir", async () => {
    const client = new PGlite();
    const { db, close } = createLocalDatabase(client);
    try {
      for (const migration of await migrationFiles())
        await client.exec(migration.sql);
      await client.exec(
        "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (hash text, created_at bigint)",
      );
      for (const [index, hash] of legacyHashes.entries())
        await client.query(
          "INSERT INTO drizzle.__drizzle_migrations VALUES ($1, $2)",
          [hash, index],
        );
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
  it("bilinmeyen eski geçmişi kabul etmez", async () => {
    const client = new PGlite();
    try {
      await client.exec(
        "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (hash text, created_at bigint); INSERT INTO drizzle.__drizzle_migrations VALUES ('unknown', 1)",
      );
      await expect(migrateLocal(client)).rejects.toThrow("tanınmıyor");
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
