import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { testDatabaseUrl } from "./environment";

// Lock only the disposable E2E database to make slow queries deterministic.
async function holdTable(table: "user" | "comments" | "session") {
  const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query(`LOCK TABLE "${table}" IN ACCESS EXCLUSIVE MODE`);
  } catch (error) {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
    throw error;
  }
  return async () => {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  };
}

test("oturum ve katalog beklerken menü ve bölüm iskeletleri görünür", async ({
  page,
}) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta adresin").fill("admin@e2e.example.test");
  await page
    .getByLabel("Şifren", { exact: true })
    .fill("E2E-test-only-password!2026");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await expect(page.getByRole("button", { name: "Hesabım" })).toBeVisible();

  const release = await holdTable("user");
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(
      page.getByRole("navigation", { name: "Ana menü" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Hesap yükleniyor" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Öne çıkan hikâye yükleniyor" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Son güncellemeler" }),
    ).toBeVisible();
  } finally {
    await release();
  }
  await expect(page.getByRole("button", { name: "Hesabım" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kül ve Yıldız", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Öne çıkan hikâye yükleniyor" }),
  ).toHaveCount(0);
});

test("oturum beklerken bölüm metni ve gezinme bağlantıları yüklenir", async ({
  page,
}) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta adresin").fill("admin@e2e.example.test");
  await page
    .getByLabel("Şifren", { exact: true })
    .fill("E2E-test-only-password!2026");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hesabım" })).toBeVisible();
  const release = await holdTable("session");
  try {
    await page.goto("/oku/kul-ve-yildiz-1", { waitUntil: "commit" });
    await expect(page.locator(".prose-content")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sonraki bölüm" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Okuma işareti yükleniyor" }),
    ).toBeVisible();
  } finally {
    await release();
  }
  await expect(
    page.getByRole("button", { name: "Burada kaldığımı kaydet" }),
  ).toBeVisible();
});

test("arama tam sayfa yenilemeden sonuçlara geçer", async ({ page }) => {
  await page.goto("/kesfet");
  await expect(page.locator(".book-card").first()).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.navigationProbe = "retained";
  });
  await page
    .getByRole("textbox", { name: "Kitap veya yazar adı", exact: true })
    .fill("Kül");
  await page.getByRole("button", { name: "Ara", exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.locator(".catalog-count")).toContainText("Kül");
  await expect(page.locator("html")).toHaveAttribute(
    "data-navigation-probe",
    "retained",
  );
});

test("yorumlar beklerken kitap ve bölüm listesi okunabilir", async ({
  page,
}) => {
  const release = await holdTable("comments");
  try {
    await page.goto("/kitap/kul-ve-yildiz", { waitUntil: "commit" });
    await expect(
      page.getByRole("heading", { name: "Kül ve Yıldız", level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".chapter-row")).toHaveCount(12);
    await expect(
      page.getByRole("link", { name: "Okumaya başla", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Yorumlar yükleniyor", exact: true }),
    ).toBeVisible();
  } finally {
    await release();
  }
  await expect(page.locator(".comment").first()).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Yorumlar yükleniyor", exact: true }),
  ).toHaveCount(0);
});
