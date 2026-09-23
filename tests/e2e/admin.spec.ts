import { expect, test } from "@playwright/test";

test("yönetim menüsü, filtreler ve mobil görünüm", async ({ page }) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta adresin").fill("admin@e2e.example.test");
  await page
    .getByLabel("Şifren", { exact: true })
    .fill("E2E-test-only-password!2026");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Genel bakış", exact: true }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Yönetim menüsü" });
  await expect(nav.getByRole("link")).toHaveCount(6);
  await nav.getByRole("link", { name: "Kullanıcılar", exact: true }).click();
  await page.getByLabel("Ara", { exact: true }).fill("admin@e2e.example.test");
  await page.getByRole("button", { name: "Uygula", exact: true }).click();
  await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);
  await page.locator(".admin-table tbody a").first().click();
  await expect(
    page.getByRole("heading", { name: "Hesap bilgileri" }),
  ).toBeVisible();
  await expect(page.getByLabel("Rol", { exact: true })).toBeDisabled();
  await expect(
    nav.getByRole("link", { name: "Kullanıcılar", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  for (const name of ["Kitaplar", "Başvurular", "Yorumlar", "İşlem geçmişi"]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("yönetim alt sayfaları oturum gerektirir", async ({ page }) => {
  for (const path of [
    "/admin",
    "/admin/kullanicilar",
    "/admin/kullanicilar/e2e-admin",
    "/admin/kitaplar",
    "/admin/kitaplar/locked-fixture",
    "/admin/kitaplar/locked-fixture/bolumler/locked-chapter",
    "/admin/basvurular",
    "/admin/yorumlar",
    "/admin/islem-kaydi",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/giris$/);
  }
});
