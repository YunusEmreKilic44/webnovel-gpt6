import { expect, test } from "@playwright/test";

test("slider sayfaları önizlenir, eklenir, düzenlenir, sıralanır ve silinir", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/giris");
  await page.getByLabel("E-posta adresin").fill("admin@e2e.example.test");
  await page
    .getByLabel("Şifren", { exact: true })
    .fill("E2E-test-only-password!2026");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.goto("/admin/slider");
  const cards = page.locator(".slider-admin-card");
  await expect(cards).toHaveCount(6);
  await expect(page.locator(".slider-admin-stats strong")).toHaveText([
    "6",
    "6",
    "0",
  ]);
  await expect(cards.first()).toContainText("1. sayfa · Yayında");
  await expect(cards.first().locator(".slider-admin-image img")).toBeVisible();
  const newSlide = page.getByRole("region", { name: "Yeni sayfa ekle" });
  await expect(newSlide.getByLabel("Sıra", { exact: false })).toHaveValue("7");
  await newSlide
    .getByLabel("Başlık", { exact: true })
    .fill("Test slider sayfası");
  await newSlide
    .getByLabel("Açıklama", { exact: true })
    .fill("Yeni sayfanın açıklaması");
  await newSlide
    .getByRole("button", { name: "Slayt ekle", exact: true })
    .click();
  await expect(cards).toHaveCount(7);
  await expect(page.locator(".slider-admin-stats strong")).toHaveText([
    "7",
    "6",
    "1",
  ]);
  const draft = page.getByRole("article", {
    name: "Test slider sayfası",
    exact: true,
  });
  await expect(draft).toContainText("Taslak · Ana sayfada görünmüyor");
  await draft.getByText("Sayfayı düzenle", { exact: true }).click();
  await draft
    .getByLabel("Başlık", { exact: true })
    .fill("Düzenlenmiş slider sayfası");
  await draft
    .locator('textarea[name="description"]')
    .fill("Güncellenmiş açıklama");
  await draft.getByLabel("Sıra", { exact: false }).fill("0");
  await draft.getByLabel("Ana sayfada yayımla").check();
  await draft
    .getByRole("button", { name: "Slaytı kaydet", exact: true })
    .click();
  await expect(cards.first()).toContainText("Düzenlenmiş slider sayfası");
  await expect(cards.first()).toContainText("1. sayfa · Yayında");
  await expect(page.locator(".slider-admin-stats strong")).toHaveText([
    "7",
    "7",
    "0",
  ]);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Düzenlenmiş slider sayfası",
  );
  await page.goto("/admin/slider");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards.first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/slider-admin-mobile.png" });
  await cards.first().getByText("Sayfayı sil", { exact: true }).click();
  await cards
    .first()
    .getByRole("button", { name: "Kalıcı olarak sil" })
    .click();
  await expect(cards).toHaveCount(6);
  await expect(page.locator(".slider-admin-stats strong")).toHaveText([
    "6",
    "6",
    "0",
  ]);
  await page.reload();
  await expect(
    page.getByRole("article", {
      name: "Düzenlenmiş slider sayfası",
      exact: true,
    }),
  ).toHaveCount(0);
});
