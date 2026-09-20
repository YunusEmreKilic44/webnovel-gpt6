import { expect, test } from "@playwright/test";

test("profil ve ayarlar oturum gerektirir", async ({ page }) => {
  for (const path of ["/profil", "/ayarlar", "/hesap"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/giris$/);
  }
});

test("profil menüsü, hesap bilgileri, okuma tercihleri ve şifre değişikliği", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const email = `profile-${Date.now()}@example.test`;
  const password = "Account-test-password!2026";
  const newPassword = "Updated-test-password!2026";
  await page.goto("/kayit");
  await page.getByLabel("Görünen adın").fill("Profil Okuru");
  await page.getByLabel("E-posta adresin").fill(email);
  await page.getByLabel("Şifren", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  const trigger = page.getByRole("button", { name: "Hesabım", exact: true });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Hesap menüsü" });
  await expect(menu).toBeVisible();
  await page.screenshot({
    path: "test-results/profile-menu-desktop.png",
    fullPage: true,
  });
  await expect(menu.getByRole("menuitem", { name: "Profilim" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Ayarlar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("heading", { name: "Son güncellemeler" }).click();
  await expect(menu).toHaveCount(0);
  await trigger.click();
  await menu.getByRole("menuitem", { name: "Profilim" }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.locator(".profile-identity h2")).toHaveText("Profil Okuru");
  await expect(page.locator(".profile-stats strong")).toHaveText([
    "0",
    "0",
    "0",
  ]);
  await page.screenshot({
    path: "test-results/profile-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Profili düzenle" }).click();
  await page.getByLabel("Görünen adın").fill("Yeni Okur");
  await page.getByRole("button", { name: "Profili kaydet" }).click();
  await expect(
    page.getByText("Profilin güncellendi.", { exact: true }),
  ).toBeVisible();
  await expect(trigger).toHaveText("Y");
  await page.getByRole("radio", { name: "Sepya", exact: true }).check();
  await page.getByLabel("Yazı boyutu", { exact: true }).selectOption("24");
  await page.getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect(page.getByText("Okuma tercihlerin kaydedildi.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Görünen adın")).toHaveValue("Yeni Okur");
  await expect(
    page.getByRole("radio", { name: "Sepya", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Yazı boyutu", { exact: true })).toHaveValue(
    "24",
  );
  await page.screenshot({
    path: "test-results/settings-desktop.png",
    fullPage: true,
  });
  await page.goto("/oku/kul-ve-yildiz-1");
  await expect(page.locator(".reader")).toHaveAttribute("data-theme", "sepia");
  await page.goto("/ayarlar");

  const otherDevice = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  try {
    const login = await otherDevice.request.post("/api/auth/sign-in/email", {
      headers: { Origin: "http://localhost:3100" },
      data: { email, password },
    });
    expect(login.ok()).toBe(true);
    await page
      .getByLabel("Mevcut şifren", { exact: true })
      .fill("incorrect-password");
    await page.getByLabel("Yeni şifren", { exact: true }).fill(newPassword);
    await page
      .getByLabel("Yeni şifreni tekrar yaz", { exact: true })
      .fill(newPassword);
    await page.getByRole("button", { name: "Şifreyi güncelle" }).click();
    await expect(page.getByText("Mevcut şifren hatalı.")).toBeVisible();
    await page.getByLabel("Mevcut şifren", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Şifreyi güncelle" }).click();
    await expect(
      page.getByText("Şifren güncellendi.", { exact: true }),
    ).toBeVisible();
    const otherPage = await otherDevice.newPage();
    await otherPage.goto("/ayarlar");
    await expect(otherPage).toHaveURL(/\/giris$/);
  } finally {
    await otherDevice.close();
  }

  await page.goto("/profil");
  await expect(page.locator(".profile-identity h2")).toHaveText("Yeni Okur");
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: "Yönetim paneli" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/profile-menu-mobile.png",
    fullPage: true,
  });
  await menu.getByRole("menuitem", { name: "Çıkış yap" }).click();
  await expect(
    page.getByRole("link", { name: "Giriş yap", exact: true }),
  ).toBeVisible();
  await page.goto("/giris");
  await page.getByLabel("E-posta adresin").fill(email);
  await page.getByLabel("Şifren", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(trigger).toBeVisible();
});
