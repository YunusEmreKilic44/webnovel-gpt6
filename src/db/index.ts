import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import path from "node:path";
import { mkdirSync } from "node:fs";

export type Database = PrismaClient;
type Connection = { db: Database; close: () => Promise<void> };
const globalDb = globalThis as unknown as { satirPrisma?: Connection };

export function createLocalDatabase(client: PGlite): Connection {
  const db = new PrismaClient({
    adapter: new PrismaPGlite(client),
    transactionOptions: { maxWait: 15000, timeout: 30000 },
  });
  return {
    db,
    close: async () => {
      await db.$disconnect();
      if (!client.closed) await client.close();
    },
  };
}
export function openDatabase(): Connection {
  if (process.env.DATABASE_URL) {
    const db = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 8,
      }),
      transactionOptions: { maxWait: 15000, timeout: 30000 },
    });
    return { db, close: () => db.$disconnect() };
  }
  if (process.env.LOCAL_DATABASE !== "true")
    throw new Error(
      "DATABASE_URL gerekli. Yerel geliştirme için LOCAL_DATABASE=true kullanın.",
    );
  const dataPath = path.resolve(process.env.PGLITE_PATH || ".data/postgres");
  mkdirSync(path.dirname(dataPath), { recursive: true });
  return createLocalDatabase(new PGlite(dataPath));
}
export function getDb(): Database {
  globalDb.satirPrisma ??= openDatabase();
  return globalDb.satirPrisma.db;
}
