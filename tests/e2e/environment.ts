import "dotenv/config";

export function testDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value)
    throw new Error(
      "E2E için ayrı bir TEST_DATABASE_URL gerekli (veritabanı adı _e2e ile bitmeli).",
    );
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.pathname.endsWith("_e2e")
  )
    throw new Error(
      "TEST_DATABASE_URL ayrı bir PostgreSQL _e2e veritabanını göstermeli.",
    );
  for (const configured of [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
  ]) {
    if (!configured) continue;
    const app = new URL(configured);
    if (
      app.hostname.replace("-pooler.", ".") ===
        url.hostname.replace("-pooler.", ".") &&
      (app.port || "5432") === (url.port || "5432") &&
      app.pathname === url.pathname
    )
      throw new Error("E2E veritabanı uygulama veritabanıyla aynı olamaz.");
  }
  return value;
}
