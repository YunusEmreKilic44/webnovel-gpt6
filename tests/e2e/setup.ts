import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
export default async function setup() {
  const env = {
    ...process.env,
    DATABASE_URL: "",
    LOCAL_DATABASE: "true",
    PGLITE_PATH: ".data/e2e",
    BETTER_AUTH_URL: "http://localhost:3100",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    DEV_SKIP_EMAIL_VERIFICATION: "true",
  };
  for (const script of [
    "scripts/migrate.ts",
    "scripts/seed.ts",
    "tests/e2e/fixtures.ts",
  ]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", script], {
      env,
      stdio: "inherit",
    });
    if (result.status !== 0)
      throw new Error(`E2E hazırlığı başarısız: ${script}`);
  }
}
