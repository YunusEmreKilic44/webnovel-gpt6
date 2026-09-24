import "dotenv/config";
import { cp, mkdir, mkdtemp, stat } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

// One-time import into an empty, migrated database. Stop any old PGlite server
// before running. Always read a fresh backup; never open the original directory.
const tables = [
  "user",
  "account",
  "session",
  "verification",
  "books",
  "tags",
  "book_tags",
  "volumes",
  "chapters",
  "chapter_revisions",
  "applications",
  "audit_logs",
  "comments",
  "library_entries",
  "ratings",
  "reading_progress",
  "rate_limits",
] as const;
const source = path.resolve(".data/postgres");
const destination =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!destination) throw new Error("Neon DATABASE_URL gerekli.");
if (!(await stat(source)).isDirectory())
  throw new Error("Yerel veritabanı bulunamadı.");
await mkdir(".data", { recursive: true });
const backup = await mkdtemp(path.resolve(".data/neon-import-backup-"));
await cp(source, path.join(backup, "postgres"), {
  recursive: true,
  errorOnExist: true,
  force: false,
});
console.log(`Yerel yedek: ${backup}`);
const local = new PGlite(path.join(backup, "postgres"));
const pool = new Pool({
  connectionString: destination,
  connectionTimeoutMillis: 15000,
});
try {
  const records = await local.transaction(async (tx) => {
    const result = [];
    for (const table of tables) {
      if (table === "tags" || table === "book_tags") {
        const exists = await tx.query<{ present: boolean }>(
          "SELECT to_regclass($1) IS NOT NULL AS present",
          [table],
        );
        if (!exists.rows[0].present) {
          result.push({ table, data: "[]", count: 0 });
          continue;
        }
      }
      // PostgreSQL serializes timestamps directly, preserving microseconds.
      // Legacy user rows predate bans; provide defaults when importing that schema.
      const rowData =
        table === "user"
          ? "jsonb_build_object('banned', false, 'ban_reason', '', 'banned_at', NULL) || to_jsonb(t)"
          : table === "books"
            ? `(to_jsonb(t) - 'genre') || jsonb_build_object('genres', COALESCE(
                (SELECT jsonb_agg(g) FROM jsonb_array_elements(COALESCE(to_jsonb(t)->'genres', jsonb_build_array(to_jsonb(t)->>'genre'))) g WHERE g <> '"LGBT+"'::jsonb),
                '["Diğer"]'::jsonb))`
            : table === "applications"
              ? "to_jsonb(t) || jsonb_build_object('snapshot', (CASE WHEN t.snapshot::jsonb ? 'genres' THEN t.snapshot::jsonb ELSE (t.snapshot::jsonb - 'genre') || jsonb_build_object('genres', jsonb_build_array(t.snapshot::jsonb->>'genre')) END) || jsonb_build_object('tags', COALESCE(t.snapshot::jsonb->'tags', '[]'::jsonb)))"
              : "to_jsonb(t)";
      const { rows } = await tx.query<{ data: string; count: number }>(
        `SELECT COALESCE(json_agg(${rowData}), '[]')::text AS data, count(*)::int AS count FROM "${table}" t`,
      );
      result.push({ table, ...rows[0] });
    }
    return result;
  });
  console.table(records.map(({ table, count }) => ({ table, count })));
  if (!process.argv.includes("--apply")) {
    console.log("Ön inceleme tamamlandı. Aktarmak için --apply ekleyin.");
  } else {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '15s'");
      await client.query(
        `LOCK TABLE ${tables.map((t) => `public."${t}"`).join(", ")} IN ACCESS EXCLUSIVE MODE`,
      );
      for (const { table } of records) {
        const { rows } = await client.query(
          `SELECT EXISTS (SELECT 1 FROM public."${table}") AS occupied`,
        );
        if (rows[0].occupied)
          throw new Error(
            `Hedef ${table} tablosu boş değil; aktarım durduruldu.`,
          );
      }
      for (const { table, data } of records) {
        await client.query(
          `INSERT INTO public."${table}" SELECT * FROM json_populate_recordset(NULL::public."${table}", $1::json)`,
          [data],
        );
        const { rows } = await client.query(
          `SELECT NOT EXISTS (
            (SELECT to_jsonb(t) FROM public."${table}" t EXCEPT SELECT to_jsonb(s) FROM json_populate_recordset(NULL::public."${table}", $1::json) s)
            UNION ALL
            (SELECT to_jsonb(s) FROM json_populate_recordset(NULL::public."${table}", $1::json) s EXCEPT SELECT to_jsonb(t) FROM public."${table}" t)
          ) AS matches`,
          [data],
        );
        if (!rows[0].matches)
          throw new Error(`Aktarım doğrulaması başarısız: ${table}`);
      }
      await client.query("COMMIT");
      console.log(
        "Tüm kayıtlar tek işlemde aktarıldı ve alan değerleri birebir doğrulandı.",
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await local.close();
  await pool.end();
}
