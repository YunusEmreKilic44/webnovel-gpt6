import { expect, test } from "@playwright/test";

test("keşif, arama ve mobil okuma", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kül ve Yıldız", level: 1, exact: true }),
  ).toBeVisible();
  await page.locator(".book-card").last().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator(".book-card-image img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Hikâye veya yazar ara" })
    .fill("Gece Ekspresi");
  await page
    .getByRole("textbox", { name: "Hikâye veya yazar ara" })
    .press("Enter");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.locator(".book-card").click();
  await expect(
    page.getByRole("heading", { name: "Gece Ekspresi", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/book-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/book-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole("link", { name: "Okumaya başla" }).click();
  await expect(page.getByRole("heading", { name: "Son sefer" })).toBeVisible();
  await expect(page.locator(".prose-content")).toContainText(
    "İstasyonun tabelası",
  );
  await page.getByRole("button", { name: "Okuma ayarları" }).click();
  await page.getByRole("button", { name: "Koyu tema" }).click();
  await expect(page.locator(".reader")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator(".reader")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/reader-mobile.png",
    fullPage: true,
  });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Gezinme menüsü" })
      .getByRole("link", { name: "Yazar stüdyosu", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Gezinme menüsü" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menüyü aç" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("kayıt, kütüphane, yorum, yayın ve premium onayı", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const suffix = Date.now();
  await page.goto("/kayit");
  await page.getByLabel("Görünen adın").fill("Deneme Yazarı");
  await page
    .getByLabel("E-posta adresin")
    .fill(`writer-${suffix}@example.test`);
  await page
    .getByLabel("Şifren", { exact: true })
    .fill("Guvenli-test-parolasi-2026!");
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.goto("/kitap/kul-ve-yildiz");
  await page.getByRole("button", { name: "Kütüphaneme ekle" }).click();
  await expect(
    page.getByRole("button", { name: "Kütüphanemde" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "5 yıldız" }).check();
  await page.getByRole("button", { name: "Puan ver", exact: true }).click();
  await expect(page.getByText("Puanın kaydedildi.")).toBeVisible();
  await page
    .getByLabel("Sen ne düşünüyorsun?")
    .fill(`Harika bir başlangıç. <script>örnek-${suffix}</script>`);
  await page.getByRole("button", { name: "Yorumu paylaş" }).click();
  await expect(
    page.locator(".comment p").filter({ hasText: `örnek-${suffix}` }),
  ).toBeVisible();
  await page.goto("/kutuphanem");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.goto("/studio/yeni");
  await page.getByLabel("Kitabın adı").fill(`Yolculuk ${suffix}`);
  await page
    .getByLabel("Arka kapak yazısı")
    .fill(
      "Kaybolmuş bir şehirde kendi geçmişini arayan genç bir gezginin hikâyesi. Her sokak yeni bir sır saklıyor.",
    );
  await page.getByRole("button", { name: "Kitabımı oluştur" }).click();
  await expect(page).toHaveURL(/\/studio\/books\//);
  const bookUrl = page.url();
  await page.getByRole("link", { name: /İlk Bölüm/ }).click();
  await expect(
    page.getByRole("button", { name: "Bölümü yayımla" }),
  ).toBeDisabled();
  const body = page.getByRole("textbox", { name: "Bölüm metni" });
  await body.fill(
    "Genç gezgin sabahın ilk ışıklarıyla yola çıktı. Şehrin dar sokaklarında yürürken eski bir defter buldu ve sayfalarını dikkatle açtı. İçinde yazan sözcükler ona yıllar önce kaybettiği bir dostunu hatırlattı. Bu yolculuk artık yalnızca bir şehri değil kendi geçmişini de keşfetmek için devam edecekti.",
  );
  await expect(page.getByRole("status")).toContainText("Taslak kaydedildi.");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Bölüm metni" }),
  ).toContainText("Genç gezgin");
  await page.goto(bookUrl);
  await page.getByLabel("Bu içeriğin yayın haklarına sahibim.").check();
  await page.getByRole("button", { name: "İncelemeye gönder" }).click();
  await expect(
    page.getByText("Yayın · İnceleniyor", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/author-studio.png",
    fullPage: true,
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Bu sayfanın hikâyesi bulunamadı." }),
  ).toBeVisible();
  const adminContext = await browser.newContext({
    baseURL: "http://localhost:3100",
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/giris");
  await adminPage.getByLabel("E-posta adresin").fill("admin@e2e.example.test");
  await adminPage
    .getByLabel("Şifren", { exact: true })
    .fill("E2E-test-only-password!2026");
  await adminPage
    .getByRole("button", { name: "Giriş yap", exact: true })
    .click();
  await expect(adminPage).toHaveURL("http://localhost:3100/");
  await adminPage.goto("/admin");
  const application = adminPage.locator(".application-card").filter({
    has: adminPage.getByRole("heading", {
      name: `Yolculuk ${suffix}`,
      exact: true,
    }),
  });
  await application
    .getByLabel("Karar gerekçesi")
    .fill("Başvuru metni incelendi, yayın için uygun.");
  await application
    .getByRole("button", { name: "Onayla ve yayımla", exact: true })
    .click();
  await expect(application.getByText(/Onaylandı/)).toBeVisible();
  await page.goto(bookUrl);
  const firstChapterLink = page.getByRole("link", { name: /İlk Bölüm/ });
  const firstChapterUrl = (await firstChapterLink.getAttribute("href"))!;
  const publicBookUrl = (await page
    .getByRole("link", { name: "Kitabı gör" })
    .getAttribute("href"))!;
  await page.goto("/kesfet?sort=recent");
  await expect(
    page.locator(`a[href="${publicBookUrl}"]`).first(),
  ).toBeVisible();
  await page.goto(bookUrl);
  await page.getByRole("link", { name: /İlk Bölüm/ }).click();
  await expect(
    page.getByText("Yayında · Taslağı düzenliyorsun", { exact: true }),
  ).toBeVisible();
  await page.goto(bookUrl);
  await page
    .getByLabel("Yayın hakları ve premium kurallarını kabul ediyorum.")
    .check();
  await page
    .getByRole("button", { name: "Premium başvurusu", exact: true })
    .click();
  await expect(
    page.getByText("Premium · İnceleniyor", { exact: true }),
  ).toBeVisible();
  await adminPage.reload();
  const premium = application.filter({ hasText: "Premium başvurusu" });
  await premium
    .getByLabel("Karar gerekçesi")
    .fill("Premium başvurusu uygun bulundu.");
  await premium.getByRole("button", { name: "Onayla" }).click();
  await expect(premium.getByText(/Onaylandı/)).toBeVisible();
  await page.goto(firstChapterUrl);
  await expect(page.getByLabel("Fiyat (₺)")).toBeDisabled();
  await page.goto(bookUrl);
  await page.getByText("+ Bu cilde bölüm ekle", { exact: true }).click();
  await page
    .getByLabel("Bölüm başlığı", { exact: true })
    .fill("Yeni premium bölüm");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(page.getByLabel("Bölüm başlığı", { exact: true })).toHaveValue(
    "Yeni premium bölüm",
  );
  await page
    .getByRole("textbox", { name: "Bölüm metni" })
    .fill(
      `GIZLI_PREMIUM_METIN_${suffix} Genç gezgin uzun yolda ilerlemeye devam etti. Dağlar ve vadiler arasında yeni bir şehre ulaştı ve burada eski dostunu buldu. Şehrin bütün kapıları açılmıştı ama en büyük sır hala meydanın altında saklanıyordu. Bu sır yalnızca gerçek hikâyeyi bilenlere kendisini gösterecekti.`,
    );
  await expect(page.getByRole("status")).toContainText("Taslak kaydedildi.");
  await page.getByRole("button", { name: "Bölümü yayımla" }).click();
  await expect(page.getByLabel("Fiyat (₺)")).toBeEnabled();
  await page.getByLabel("Fiyat (₺)").fill("5");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("Bölüm fiyatı güncellendi.")).toBeVisible();
  const readerUrl = await page
    .getByRole("link", { name: "Okuyucu görünümü" })
    .getAttribute("href");
  const response = await page.request.get(readerUrl!);
  const html = await response.text();
  expect(html).not.toContain(`GIZLI_PREMIUM_METIN_${suffix}`);
  expect(html).toContain("Hikâyenin bu bölümü premium.");
  await adminContext.close();
});

test("ücretli metin HTML, RSC ve liste sorgularında sızmaz", async ({
  page,
  request,
}) => {
  const marker = "SECRET_PAID_BODY_SHOULD_NOT_LEAK_2026";
  for (const url of [
    "/oku/locked-chapter",
    "/kitap/erisim-siniri",
    "/kesfet?q=Erişim",
  ]) {
    const response = await request.get(url);
    expect(response.ok()).toBe(true);
    expect(await response.text()).not.toContain(marker);
  }
  const rsc = await request.get("/oku/locked-chapter", {
    headers: { RSC: "1" },
  });
  expect(await rsc.text()).not.toContain(marker);
  expect(rsc.headers()["cache-control"]).toContain("no-store");
  await page.goto("/oku/locked-chapter");
  await expect(
    page.getByRole("heading", { name: "Hikâyenin bu bölümü premium." }),
  ).toBeVisible();
  await expect(page.locator(".prose-content")).toHaveCount(0);
});
