import { PGlite } from "@electric-sql/pglite";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import path from "node:path";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
type Connection = { db: Database; close: () => Promise<void> };
const globalDb = globalThis as unknown as { satirDb?: Connection };

export function openDatabase(): Connection {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 8,
    });
    return { db: drizzle(pool, { schema }), close: () => pool.end() };
  }
  if (process.env.LOCAL_DATABASE !== "true")
    throw new Error(
      "DATABASE_URL gerekli. Yerel geliştirme için LOCAL_DATABASE=true kullanın.",
    );
  const dataPath = path.resolve(process.env.PGLITE_PATH || ".data/postgres");
  mkdirSync(path.dirname(dataPath), { recursive: true });
  const client = new PGlite(dataPath);
  // Both adapters implement Drizzle's PostgreSQL query/transaction API.
  const db = pgliteDrizzle(client, { schema }) as unknown as Database;
  return { db, close: () => client.close() };
}

export function getDb(): Database {
  globalDb.satirDb ??= openDatabase();
  return globalDb.satirDb.db;
}
