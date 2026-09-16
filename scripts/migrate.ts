import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { openDatabase } from "../src/db";

const { db, close } = openDatabase();
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Veritabanı migration'ları uygulandı.");
} finally {
  await close();
}
