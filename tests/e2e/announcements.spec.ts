import { expect, test } from "@playwright/test";

test("duyuru editörü imleçte görsel ekler, hatada içeriği korur ve arşivden okunur", async ({
  page,
}) => {
  await page.goto("/giris");
  await page.getByLabel("E-posta adresin").fill("admin@e2e.example.test");
  await page
    .getByLabel("Şifren", { exact: true })
    .fill("E2E-test-only-password!2026");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.goto("/admin/duyurular");
  const create = page.locator("details.content-editor").first();
  if ((await create.getAttribute("open")) === null) {
    await create.getByText("Yeni duyuru ekle", { exact: true }).click();
  }
  const title = `Arşiv testi ${Date.now()}`;
  await create.getByLabel("Başlık", { exact: true }).fill(title);
  const text = create.getByLabel("Duyuru metni", { exact: true });
  await text.fill("BaşlangıçBitiş metni");
  await text.evaluate((element: HTMLTextAreaElement) => {
    element.focus();
    element.setSelectionRange(9, 9);
  });
  await create
    .getByRole("button", { name: "İmleç konumuna görsel ekle" })
    .click();
  await expect(create.locator("textarea")).toHaveCount(2);
  await expect(create.locator("textarea").nth(0)).toHaveValue("Başlangıç");
  await expect(create.locator("textarea").nth(1)).toHaveValue("Bitiş metni");
  const image = create.getByRole("region", {
    name: "2. görsel bloğu",
    exact: true,
  });
  await image.getByLabel("Görsel dosyası").setInputFiles({
    name: "preview.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(image.getByRole("img")).toBeVisible();
  await create
    .getByRole("button", { name: "2. bloğu yukarı taşı", exact: true })
    .click();
  await expect(
    create.locator(".announcement-edit-block").first(),
  ).toHaveAttribute("aria-label", "1. görsel bloğu");
  await create
    .locator(".announcement-edit-block")
    .first()
    .getByRole("button", { name: "Bloğu kaldır" })
    .click();
  await create
    .getByLabel("Bağlantı (isteğe bağlı)")
    .fill("https://example.com");
  await create.getByLabel("Bağlantı düğmesinin yazısı").fill("İncele");
  await create
    .getByRole("button", { name: "Duyuru ekle", exact: true })
    .click();
  await expect(create.getByRole("status")).toContainText("site içi");
  await expect(create.locator("textarea").nth(1)).toHaveValue("Bitiş metni");
  await expect(create.getByLabel("Başlık", { exact: true })).toHaveValue(title);
  await create.getByLabel("Bağlantı (isteğe bağlı)").fill("/kesfet");
  await create
    .getByRole("button", { name: "Duyuru ekle", exact: true })
    .click();
  const saved = page
    .locator("details.content-editor")
    .filter({ has: page.locator("summary", { hasText: title }) });
  await expect(saved).toContainText("Taslak");
  await page.goto("/duyurular");
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/duyurular");
  await saved.locator("summary").first().click();
  await saved.getByLabel("Duyuruyu yayımla").check();
  await saved
    .getByRole("button", { name: "Duyuruyu kaydet", exact: true })
    .click();
  await expect(saved).toContainText("Yayında");
  // Saving remounts the existing editor with the persisted content.
  await saved.locator("summary").first().click();
  const detailUrl = await saved
    .getByRole("link", { name: "Duyuruyu oku" })
    .getAttribute("href");
  await page.goto(detailUrl!);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator(".announcement-body p")).toHaveText([
    "Başlangıç",
    "Bitiş metni",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/admin/duyurular");
  await saved.locator("summary").first().click();
  await saved.getByText("Kaydı sil", { exact: true }).click();
  await saved.getByRole("button", { name: "Kalıcı olarak sil" }).click();
  await expect(saved).toHaveCount(0);
  await page.goto(detailUrl!);
  await expect(
    page.getByRole("heading", { name: "Duyuru bulunamadı" }),
  ).toBeVisible();
});
