import "dotenv/config";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  isKnownLegacyHash,
  migrateLocal,
  migrationFiles,
} from "../src/db/migrate-local";

function prisma(args: string[]) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", ...args],
    { stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) throw new Error("Prisma migration tamamlanamadı.");
}
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS legacy",
    );
    if (rows[0].legacy) {
      const legacy = await pool.query(
        "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at",
      );
      if (legacy.rows.some((row, index) => !isKnownLegacyHash(row.hash, index)))
        throw new Error(
          "Eski migration geçmişi tanınmıyor; otomatik geçiş durduruldu.",
        );
      const state = await pool.query(
        "SELECT to_regclass('public._prisma_migrations')::text AS history",
      );
      const applied = state.rows[0].history
        ? (
            await pool.query(
              'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
            )
          ).rows
        : [];
      const files = await migrationFiles();
      for (const file of files.slice(0, legacy.rows.length)) {
        if (!applied.some((row) => row.migration_name === file.name))
          prisma(["migrate", "resolve", "--applied", file.name]);
      }
    }
  } finally {
    await pool.end();
  }
  prisma(["migrate", "deploy"]);
} else {
  if (process.env.LOCAL_DATABASE !== "true")
    throw new Error("DATABASE_URL veya LOCAL_DATABASE=true gerekli.");
  const dataPath = path.resolve(process.env.PGLITE_PATH || ".data/postgres");
  mkdirSync(path.dirname(dataPath), { recursive: true });
  const client = new PGlite(dataPath);
  try {
    await migrateLocal(client);
  } finally {
    await client.close();
  }
}
console.log("Prisma migration'ları uygulandı. Mevcut veriler korundu.");
