import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export type Database = PrismaClient;
type Connection = { db: Database; close: () => Promise<void> };
const globalDb = globalThis as unknown as { satirPrisma?: Connection };

export function openDatabase(): Connection {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL gerekli. Neon bağlantısını .env dosyasında tanımlayın.",
    );
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 8,
      connectionTimeoutMillis: 15000,
    }),
    transactionOptions: { maxWait: 15000, timeout: 30000 },
  });
  return { db, close: () => db.$disconnect() };
}
export function getDb(): Database {
  globalDb.satirPrisma ??= openDatabase();
  return globalDb.satirPrisma.db;
}
