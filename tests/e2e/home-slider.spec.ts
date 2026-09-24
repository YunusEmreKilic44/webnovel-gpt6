import { expect, test } from "@playwright/test";

test("ana sayfa sliderı oklar, noktalar ve klavye ile gezinir", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Öne çıkanlar" });
  const next = hero.getByRole("button", { name: "Sonraki slayt" });
  await expect(next).toBeEnabled();
  const slides = hero.locator(".slider-slide");
  const count = await slides.count();
  expect(count).toBeGreaterThan(1);
  const firstTitle = await hero.getByRole("heading", { level: 1 }).innerText();
  await next.click();
  await expect(hero.locator(".slider-count")).toHaveText(`2 / ${count}`);
  await expect(hero.getByRole("heading", { level: 1 })).not.toHaveText(
    firstTitle,
  );
  await expect(slides.first()).toHaveAttribute("inert", "");
  await hero.getByRole("button", { name: "Önceki slayt" }).click();
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText(firstTitle);
  await hero.getByRole("button", { name: "Önceki slayt" }).click();
  await expect(hero.locator(".slider-count")).toHaveText(`${count} / ${count}`);
  await next.click();
  await expect(hero.locator(".slider-count")).toHaveText(`1 / ${count}`);
  await hero.locator(".slider-dot").nth(1).click();
  await expect(hero.locator(".slider-dot").nth(1)).toHaveAttribute(
    "aria-current",
    "true",
  );
  await hero.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(hero.locator(".slider-count")).toHaveText(`1 / ${count}`);
});

test("otomatik geçiş fare üzerindeyken ve elle seçimden sonra devam eder", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Öne çıkanlar" });
  await expect(
    hero.getByRole("button", { name: "Otomatik geçişi durdur" }),
  ).toBeEnabled();
  const count = await hero.locator(".slider-slide").count();
  const counter = hero.locator(".slider-count");
  await hero.hover();
  await page.clock.fastForward(6100);
  await expect(counter).toHaveText(`2 / ${count}`);
  await hero.getByRole("button", { name: "Sonraki slayt" }).click();
  const selected = await counter.innerText();
  await page.clock.fastForward(6100);
  await expect(counter).not.toHaveText(selected);
  await hero.getByRole("button", { name: "Otomatik geçişi durdur" }).click();
  const stopped = await counter.innerText();
  await page.clock.fastForward(18000);
  await expect(counter).toHaveText(stopped);
  await hero.getByRole("button", { name: "Otomatik geçişi başlat" }).click();
  await page.clock.fastForward(6100);
  await expect(counter).not.toHaveText(stopped);
});

test("azaltılmış harekette otomatik geçiş elle başlatılabilir", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Öne çıkanlar" });
  await expect(
    hero.getByRole("button", { name: "Otomatik geçişi başlat" }),
  ).toBeEnabled();
  const count = await hero.locator(".slider-slide").count();
  await page.clock.fastForward(12000);
  await expect(hero.locator(".slider-count")).toHaveText(`1 / ${count}`);
  await hero.getByRole("button", { name: "Otomatik geçişi başlat" }).click();
  await page.clock.fastForward(6100);
  await expect(hero.locator(".slider-count")).toHaveText(`2 / ${count}`);
});
test("mobil slider yatay kaydırılır, dikey hareket slaytı değiştirmez", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Öne çıkanlar" });
  await expect(
    hero.getByRole("button", { name: "Sonraki slayt" }),
  ).toBeEnabled();
  const count = await hero.locator(".slider-slide").count();
  await hero.dispatchEvent("touchstart", {
    touches: [{ identifier: 0, clientX: 300, clientY: 200 }],
  });
  await hero.dispatchEvent("touchend", {
    changedTouches: [{ identifier: 0, clientX: 80, clientY: 205 }],
  });
  await expect(hero.locator(".slider-count")).toHaveText(`2 / ${count}`);
  await hero.dispatchEvent("touchstart", {
    touches: [{ identifier: 0, clientX: 200, clientY: 200 }],
  });
  await hero.dispatchEvent("touchend", {
    changedTouches: [{ identifier: 0, clientX: 210, clientY: 400 }],
  });
  await expect(hero.locator(".slider-count")).toHaveText(`2 / ${count}`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const controls = await hero.locator(".slider-controls").boundingBox();
  expect(controls?.x).toBeGreaterThanOrEqual(0);
  expect(controls!.x + controls!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/slider-mobile.png" });
});
