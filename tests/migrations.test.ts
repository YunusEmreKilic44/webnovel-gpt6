import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrateLocal, migrationFiles } from "./support/migrate";
import { createLocalDatabase } from "./support/database";

describe("Prisma SQL migration'ları", () => {
  it("etiket tablolarını ekler ve kaldırılan kategoriyi kitabı kategorisiz bırakmadan temizler", async () => {
    const client = new PGlite();
    const { db, close } = createLocalDatabase(client);
    try {
      const migrations = await migrationFiles();
      const index = migrations.findIndex(
        (migration) => migration.name === "20260928000000_book_tags",
      );
      expect(index).toBeGreaterThan(0);
      for (const migration of migrations.slice(0, index))
        await client.exec(migration.sql);
      await client.exec(`
        INSERT INTO "user" (id, name, email) VALUES ('tag-legacy', 'Yazar', 'tag-legacy@example.test');
        INSERT INTO books (id, author_id, slug, title, description, genres) VALUES
          ('only-retired', 'tag-legacy', 'only-retired', 'Kitap', 'Açıklama', ARRAY['LGBT+']),
          ('multiple', 'tag-legacy', 'multiple', 'Kitap', 'Açıklama', ARRAY['Fantastik', 'LGBT+']),
          ('unchanged', 'tag-legacy', 'unchanged', 'Kitap', 'Açıklama', ARRAY['Gizem']);
        INSERT INTO applications (id, book_id, type, snapshot)
        VALUES ('old-tags', 'unchanged', 'PUBLICATION', '{"title":"Kitap","genres":["Gizem"],"chapters":[]}');
      `);
      await client.exec(migrations[index].sql);
      expect(
        (await db.book.findUniqueOrThrow({ where: { id: "only-retired" } }))
          .genres,
      ).toEqual(["Diğer"]);
      expect(
        (await db.book.findUniqueOrThrow({ where: { id: "multiple" } })).genres,
      ).toEqual(["Fantastik"]);
      expect(
        (await db.book.findUniqueOrThrow({ where: { id: "unchanged" } }))
          .genres,
      ).toEqual(["Gizem"]);
      expect(await db.bookTag.count()).toBe(0);
      expect(
        (await db.application.findUniqueOrThrow({ where: { id: "old-tags" } }))
          .snapshot,
      ).toEqual({
        title: "Kitap",
        genres: ["Gizem"],
        chapters: [],
        tags: [],
      });
    } finally {
      await close();
    }
  });
  it("tek kategorili kitapları ve eski başvuruları veri kaybetmeden taşır", async () => {
    const client = new PGlite();
    const { db, close } = createLocalDatabase(client);
    try {
      const migrations = await migrationFiles();
      const index = migrations.findIndex(
        (migration) => migration.name === "20260927000000_book_genres",
      );
      expect(index).toBeGreaterThan(0);
      for (const migration of migrations.slice(0, index))
        await client.exec(migration.sql);
      await client.exec(`
        INSERT INTO "user" (id, name, email) VALUES ('legacy-author', 'Yazar', 'legacy@example.test');
        INSERT INTO books (id, author_id, slug, title, description, genre)
        VALUES ('legacy-book', 'legacy-author', 'eski-kitap', 'Eski Kitap', 'Eski açıklama', 'Bilim Kurgu');
        INSERT INTO applications (id, book_id, type, snapshot)
        VALUES ('legacy-application', 'legacy-book', 'PUBLICATION',
          '{"title":"Eski Kitap","description":"Eski açıklama","genre":"Bilim Kurgu","chapters":[]}');
      `);
      await client.exec(migrations[index].sql);
      expect(
        await db.book.findUniqueOrThrow({ where: { id: "legacy-book" } }),
      ).toMatchObject({
        title: "Eski Kitap",
        slug: "eski-kitap",
        genres: ["Bilim Kurgu"],
      });
      const application = await db.application.findUniqueOrThrow({
        where: { id: "legacy-application" },
      });
      expect(application.snapshot).toEqual({
        title: "Eski Kitap",
        description: "Eski açıklama",
        genres: ["Bilim Kurgu"],
        chapters: [],
      });
      await expect(
        client.exec(
          "UPDATE books SET genres = ARRAY[]::text[] WHERE id = 'legacy-book'",
        ),
      ).rejects.toThrow(/books_genres_nonempty/);
      await expect(
        client.exec(
          "UPDATE books SET genres = ARRAY[NULL]::text[] WHERE id = 'legacy-book'",
        ),
      ).rejects.toThrow(/books_genres_nonempty/);
    } finally {
      await close();
    }
  });
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
      ).toHaveLength((await migrationFiles()).length);
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
