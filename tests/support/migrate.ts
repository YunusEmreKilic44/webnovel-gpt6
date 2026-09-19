import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

export async function migrationFiles() {
  const directory = path.resolve("prisma/migrations");
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .map(async (name) => {
        const sql = await readFile(
          path.join(directory, name, "migration.sql"),
          "utf8",
        );
        return {
          name,
          sql,
          checksum: createHash("sha256").update(sql).digest("hex"),
        };
      }),
  );
}

// Apply the checked-in SQL to isolated test databases without a network server.
export async function migrateLocal(client: PGlite) {
  const migrations = await migrationFiles();
  await client.transaction(async (tx) => {
    await tx.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL,
      finished_at timestamptz, migration_name varchar(255) NOT NULL, logs text,
      rolled_back_at timestamptz, started_at timestamptz NOT NULL DEFAULT now(),
      applied_steps_count integer NOT NULL DEFAULT 0
    )`);
    const applied = (
      await tx.query<{
        migration_name: string;
        checksum: string;
        finished_at: Date | null;
      }>(
        'SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" WHERE rolled_back_at IS NULL',
      )
    ).rows;
    for (const migration of migrations) {
      const previous = applied.find(
        (row) => row.migration_name === migration.name,
      );
      if (previous) {
        if (!previous.finished_at || previous.checksum !== migration.checksum)
          throw new Error("Migration geçmişi uyuşmuyor: " + migration.name);
        continue;
      }
      await tx.exec(migration.sql);
      await tx.query(
        'INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1, $2, $3, now(), 1)',
        [randomUUID(), migration.checksum, migration.name],
      );
    }
  });
}
