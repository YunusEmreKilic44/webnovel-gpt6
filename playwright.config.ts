import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { testDatabaseUrl } from "./tests/e2e/environment";
const databaseUrl = testDatabaseUrl();
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1080 },
      },
    },
  ],
  webServer: {
    command: "node --import tsx tests/e2e/server.ts",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      DATABASE_URL: databaseUrl,
      DATABASE_URL_UNPOOLED: databaseUrl,
      TEST_DATABASE_URL: databaseUrl,
      E2E_TEST: "true",
      BETTER_AUTH_URL: "http://localhost:3100",
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      DEV_SKIP_EMAIL_VERIFICATION: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
