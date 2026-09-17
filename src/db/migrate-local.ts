import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

export const legacyHashes = [
  "d2aa2c9658b2a21088da62a0dd4eaaff955d568eb2f15e71aff82a0bc1e4bfd7",
  "6853e7dfcc1c2603a1200f19585a8f29a34659e6137dc6a7095be802f28f1c0a",
];
const legacyWindowsHashes = [
  "2908710f3ddc932416a48f8bf358333bc2246d3e4b475d618952ca7374b34518",
  "2addd4f275f92407c323767548f1fe957597d551368d2b45167f1bb08cd4a5f3",
];
export function isKnownLegacyHash(hash: string, index: number) {
  return hash === legacyHashes[index] || hash === legacyWindowsHashes[index];
}
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

// PGlite has no network endpoint for the Prisma CLI. Apply the same checked-in
// Prisma migrations locally and record the standard Prisma migration history.
export async function migrateLocal(client: PGlite) {
  const migrations = await migrationFiles();
  await client.transaction(async (tx) => {
    const legacyTable = await tx.query<{ table: string | null }>(
      "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS table",
    );
    const legacy = legacyTable.rows[0].table
      ? (
          await tx.query<{ hash: string }>(
            "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at",
          )
        ).rows
      : [];
    if (legacy.some((row, index) => !isKnownLegacyHash(row.hash, index)))
      throw new Error(
        "Eski migration geçmişi tanınmıyor; otomatik geçiş durduruldu.",
      );
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
    for (const [index, migration] of migrations.entries()) {
      const previous = applied.find(
        (row) => row.migration_name === migration.name,
      );
      if (previous) {
        if (!previous.finished_at || previous.checksum !== migration.checksum)
          throw new Error("Migration geçmişi uyuşmuyor: " + migration.name);
        continue;
      }
      if (index >= legacy.length) await tx.exec(migration.sql);
      await tx.query(
        'INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1, $2, $3, now(), 1)',
        [randomUUID(), migration.checksum, migration.name],
      );
    }
  });
}
