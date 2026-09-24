import { expect, test } from "@playwright/test";

test("kitabın kategorilerini seçer, arar, kaldırır ve düzenlemede korur", async ({
  page,
}) => {
  const login = await page.request.post("/api/auth/sign-in/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      email: "admin@e2e.example.test",
      password: "E2E-test-only-password!2026",
    },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/studio/yeni");
  await page.getByLabel("Kitabın adı").fill(`Kategori denemesi ${Date.now()}`);
  await page
    .getByLabel("Arka kapak yazısı")
    .fill(
      "Birden fazla dünyada geçen fantastik ve gizemli bir yolculuğun hikâyesi.",
    );
  await page.getByRole("checkbox", { name: "Fantastik", exact: true }).check();
  await page
    .getByRole("textbox", { name: "Yeni etiket", exact: true })
    .fill("(isekai), (yeni dünya)");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "isekai etiketini kaldır" }),
  ).toBeVisible();
  // Text that has not been confirmed with Enter is still part of the save.
  await page
    .getByRole("textbox", { name: "Yeni etiket", exact: true })
    .fill("güçlü karakter");
  await page.getByRole("searchbox", { name: "Kategori ara" }).fill("gizem");
  await page.getByRole("checkbox", { name: "Gizem", exact: true }).check();
  await expect(page.locator(".genre-field-count")).toHaveText("2/5 seçili");
  // The checked category hidden by search must still be submitted.
  await page.getByRole("button", { name: "Kitabımı oluştur" }).click();
  await expect(page).toHaveURL(/\/studio\/books\/[^/]+$/);
  const bookUrl = page.url();
  const bookId = new URL(bookUrl).pathname.split("/").at(-1);
  await page.goto(`${bookUrl}/duzenle`);
  await expect(
    page.getByRole("button", { name: "isekai etiketini kaldır" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "yeni dünya etiketini kaldır" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "güçlü karakter etiketini kaldır" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "güçlü karakter etiketini kaldır" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Fantastik", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Gizem", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Fantastik kategorisini kaldır" })
    .click();
  await page.getByRole("checkbox", { name: "Macera", exact: true }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/book-genres-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(
    page.getByText("Kitap bilgileri kaydedildi.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "güçlü karakter etiketini kaldır" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "yeni dünya etiketini kaldır" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Fantastik", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Gizem", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Macera", exact: true }),
  ).toBeChecked();
  await page.goto(`/admin/kitaplar/${bookId}`);
  await expect(
    page.getByRole("button", { name: "isekai etiketini kaldır" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Gizem", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Macera", exact: true }),
  ).toBeChecked();
});
