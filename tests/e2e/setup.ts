import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
export default async function setup() {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BETTER_AUTH_URL: "http://localhost:3100",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    DEV_SKIP_EMAIL_VERIFICATION: "true",
  };
  if (
    env.E2E_TEST !== "true" ||
    !env.DATABASE_URL ||
    env.DATABASE_URL !== env.TEST_DATABASE_URL ||
    !new URL(env.DATABASE_URL).pathname.endsWith("_e2e")
  )
    throw new Error(
      "E2E hazırlığı yalnız ayrı test veritabanında çalıştırılır.",
    );
  for (const args of [
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    ["--import", "tsx", "scripts/seed.ts"],
    ["--import", "tsx", "tests/e2e/fixtures.ts"],
  ]) {
    const result = spawnSync(process.execPath, args, {
      env,
      stdio: "inherit",
    });
    if (result.status !== 0)
      throw new Error(`E2E hazırlığı başarısız: ${args.join(" ")}`);
  }
}
