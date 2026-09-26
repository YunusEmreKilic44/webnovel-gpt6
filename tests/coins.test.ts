import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import {
  iyzicoAuthorization,
  initializeCheckout,
  retrieveCheckout,
} from "@/lib/iyzico";
import {
  canReadChapter,
  completeCoinOrder,
  createCoinOrder,
  getChapterPrice,
  saveCoinPackage,
  unlockChapter,
  updateCoinSettings,
} from "@/modules/coins/service";

vi.mock("server-only", () => ({}));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: vi.fn(),
}));
vi.mock("@/lib/iyzico", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/iyzico")>()),
  initializeCheckout: vi.fn(),
  retrieveCheckout: vi.fn(),
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const reader = {
  id: "reader",
  name: "Okur Kişi",
  email: "reader@example.test",
  role: "reader",
  emailVerified: true,
};
const author = {
  ...reader,
  id: "author",
  name: "Yazar Kişi",
  email: "author@example.test",
};
const admin = {
  ...reader,
  id: "admin",
  name: "Yönetici Kişi",
  email: "admin@example.test",
  role: "admin",
};
const content = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Metin" }] }],
};
const context = {
  ip: "127.0.0.1",
  callbackUrl: "https://satir.test/api/payments/iyzico/callback",
};

let tokenCounter = 0;
/** Opens an order through the (mocked) iyzico form and returns its token. */
async function openOrder(packageId = "coins-50") {
  const token = `token-${++tokenCounter}`;
  vi.mocked(initializeCheckout).mockResolvedValueOnce({
    token,
    paymentPageUrl: `https://sandbox-cpp.iyzipay.com?token=${token}`,
  });
  const { orderId } = await createCoinOrder(db, reader, packageId, context);
  return { token, orderId };
}
function paid(orderId: string, priceMinor: number) {
  return {
    status: "success" as const,
    paymentStatus: "SUCCESS",
    paymentId: `pay-${orderId}`,
    basketId: orderId,
    currency: "TRY",
    price: priceMinor / 100,
    paidPrice: priceMinor / 100,
    fraudStatus: 1,
  };
}
const balance = async (id = reader.id) =>
  (await db.user.findUniqueOrThrow({ where: { id } })).coinBalance;

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  // Store behaviour is tested here; the closed switch in features.test.ts.
  await db.coinSettings.update({
    where: { id: 1 },
    data: { coinStoreEnabled: true },
  });
  for (const user of [reader, author, admin])
    await db.user.create({ data: user });
  await db.book.create({
    data: {
      id: "book",
      authorId: author.id,
      slug: "premium-kitap",
      title: "Premium kitap",
      description: "Premium bölümleri olan yeterince uzun bir açıklama.",
      genres: ["Fantastik"],
      status: "PUBLISHED",
      premiumStatus: "ACTIVE",
      firstPremiumApprovedAt: new Date("2026-01-01T00:00:00Z"),
    },
  });
  await db.volume.create({
    data: { id: "volume", bookId: "book", title: "Cilt", position: 1 },
  });
  await db.chapter.createMany({
    data: ["free", "premium-1", "premium-2", "premium-3"].map((id, i) => ({
      id,
      bookId: "book",
      volumeId: "volume",
      title: id,
      publishedTitle: id,
      position: i + 1,
      content,
      publishedContent: content,
      status: "PUBLISHED",
      accessType: id === "free" ? "FREE" : "PAID",
      firstPublishedAt: new Date("2026-02-01T00:00:00Z"),
    })),
  });
});
beforeEach(() => {
  vi.mocked(initializeCheckout).mockReset();
  vi.mocked(retrieveCheckout).mockReset();
});
afterAll(close);

describe("Coin yükleme (iyzico)", () => {
  it("varsayılan fiyat ve paketlerle başlar", async () => {
    expect(await getChapterPrice(db)).toBe(5);
    expect(
      await db.coinPackage.findMany({
        orderBy: { position: "asc" },
        select: { coins: true, priceMinor: true },
      }),
    ).toEqual([
      { coins: 50, priceMinor: 2499 },
      { coins: 150, priceMinor: 6499 },
      { coins: 400, priceMinor: 15999 },
    ]);
  });

  it("paketin coin ve fiyatını siparişe kopyalar, iyzico'ya doğru tutarı yollar", async () => {
    const { orderId, token } = await openOrder("coins-150");
    expect(
      await db.coinOrder.findUniqueOrThrow({ where: { id: orderId } }),
    ).toMatchObject({
      userId: reader.id,
      coins: 150,
      priceMinor: 6499,
      status: "PENDING",
      providerToken: token,
    });
    expect(vi.mocked(initializeCheckout).mock.calls[0][0]).toMatchObject({
      orderId,
      priceMinor: 6499,
      callbackUrl: context.callbackUrl,
    });
  });

  it("ödeme doğrulanınca coinleri bir kez yükler; tekrarlanan callback iki kez yüklemez", async () => {
    const before = await balance();
    const { token, orderId } = await openOrder("coins-50");
    vi.mocked(retrieveCheckout).mockResolvedValue(paid(orderId, 2499));
    expect(await completeCoinOrder(db, token)).toBe("PAID");
    expect(await completeCoinOrder(db, token)).toBe("PAID");
    await Promise.all([
      completeCoinOrder(db, token),
      completeCoinOrder(db, token),
    ]);
    expect(await balance()).toBe(before + 50);
    expect(
      await db.coinTransaction.findMany({ where: { orderId } }),
    ).toMatchObject([{ kind: "TOP_UP", amount: 50 }]);
    expect(
      await db.coinOrder.findUniqueOrThrow({ where: { id: orderId } }),
    ).toMatchObject({ status: "PAID", providerPaymentId: `pay-${orderId}` });
  });

  it("tutarı, siparişi veya durumu uyuşmayan ödemeyi yüklemez", async () => {
    const before = await balance();
    const wrongAmount = await openOrder();
    vi.mocked(retrieveCheckout).mockResolvedValueOnce({
      ...paid(wrongAmount.orderId, 2499),
      price: 1,
      paidPrice: 1,
    });
    expect(await completeCoinOrder(db, wrongAmount.token)).toBe("FAILED");

    const otherBasket = await openOrder();
    vi.mocked(retrieveCheckout).mockResolvedValueOnce(
      paid("baska-siparis", 2499),
    );
    expect(await completeCoinOrder(db, otherBasket.token)).toBe("FAILED");

    const declined = await openOrder();
    vi.mocked(retrieveCheckout).mockResolvedValueOnce({
      status: "failure",
      errorMessage: "Kart reddedildi",
    });
    expect(await completeCoinOrder(db, declined.token)).toBe("FAILED");

    const threeDs = await openOrder();
    vi.mocked(retrieveCheckout).mockResolvedValueOnce({
      ...paid(threeDs.orderId, 2499),
      paymentStatus: "INIT_THREEDS",
    });
    expect(await completeCoinOrder(db, threeDs.token)).toBe("PENDING");

    expect(await balance()).toBe(before);
    expect(
      (
        await db.coinOrder.findUniqueOrThrow({
          where: { id: declined.orderId },
        })
      ).failureReason,
    ).toBe("Kart reddedildi");
    await expect(completeCoinOrder(db, "bilinmeyen")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("satıştan kaldırılan paket satın alınamaz; iyzico açılamazsa sipariş başarısız olur", async () => {
    await saveCoinPackage(db, admin, {
      id: "coins-400",
      coins: 400,
      priceMinor: 15999,
      active: false,
      position: 3,
    });
    await expect(
      createCoinOrder(db, reader, "coins-400", context),
    ).rejects.toMatchObject({ code: "PACKAGE_UNAVAILABLE" });
    vi.mocked(initializeCheckout).mockRejectedValueOnce(new Error("down"));
    await expect(
      createCoinOrder(db, reader, "coins-50", context),
    ).rejects.toMatchObject({ code: "PAYMENT_INIT_FAILED" });
    expect(
      await db.coinOrder.findFirstOrThrow({ orderBy: { createdAt: "desc" } }),
    ).toMatchObject({ status: "FAILED" });
  });
});

describe("Premium bölüm açma", () => {
  it("bakiye yetmezse açmaz ve hiçbir şey yazmaz", async () => {
    await db.user.update({
      where: { id: reader.id },
      data: { coinBalance: 3 },
    });
    await expect(unlockChapter(db, reader, "premium-1")).rejects.toMatchObject({
      code: "INSUFFICIENT_COINS",
    });
    expect(await db.chapterUnlock.count()).toBe(0);
    expect(await balance()).toBe(3);
  });

  it("sabit fiyatı bir kez keser, bölümü kalıcı açar; ikinci deneme ücretsizdir", async () => {
    await db.user.update({
      where: { id: reader.id },
      data: { coinBalance: 12 },
    });
    expect(await unlockChapter(db, reader, "premium-1")).toEqual({
      charged: 5,
      alreadyOwned: false,
    });
    expect(await unlockChapter(db, reader, "premium-1")).toEqual({
      charged: 0,
      alreadyOwned: true,
    });
    expect(await balance()).toBe(7);
    expect(
      await db.coinTransaction.findFirstOrThrow({
        where: { kind: "UNLOCK", chapterId: "premium-1" },
      }),
    ).toMatchObject({ amount: -5, balanceAfter: 7 });
    expect(
      await canReadChapter(db, reader.id, {
        id: "premium-1",
        accessType: "PAID",
        authorId: author.id,
      }),
    ).toBe(true);
  });

  it("eşzamanlı açma isteklerinde yalnız bir kez ücret alır", async () => {
    const before = await balance();
    const results = await Promise.all([
      unlockChapter(db, reader, "premium-2"),
      unlockChapter(db, reader, "premium-2"),
    ]);
    expect(results.filter((r) => !r.alreadyOwned)).toHaveLength(1);
    expect(await balance()).toBe(before - 5);
  });

  it("fiyat değişikliği yalnız sonraki açılışları etkiler; yazar fiyat belirleyemez", async () => {
    await expect(
      updateCoinSettings(db, reader, { chapterPriceCoins: 1 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await updateCoinSettings(db, admin, { chapterPriceCoins: 2 });
    await db.user.update({
      where: { id: reader.id },
      data: { coinBalance: 2 },
    });
    expect(await unlockChapter(db, reader, "premium-3")).toMatchObject({
      charged: 2,
    });
    expect(
      await db.chapterUnlock.findMany({
        where: { userId: reader.id },
        orderBy: { chapterId: "asc" },
        select: { chapterId: true, coinsSpent: true },
      }),
    ).toEqual([
      { chapterId: "premium-1", coinsSpent: 5 },
      { chapterId: "premium-2", coinsSpent: 5 },
      { chapterId: "premium-3", coinsSpent: 2 },
    ]);
    await updateCoinSettings(db, admin, { chapterPriceCoins: 5 });
  });

  it("ücretsiz bölüm ve yazarın kendi bölümü ücret almaz; herkese kapalı premium okunamaz", async () => {
    expect(await unlockChapter(db, reader, "free")).toMatchObject({
      charged: 0,
    });
    expect(await unlockChapter(db, author, "premium-1")).toMatchObject({
      charged: 0,
    });
    expect(
      await canReadChapter(db, author.id, {
        id: "premium-1",
        accessType: "PAID",
        authorId: author.id,
      }),
    ).toBe(true);
    for (const viewer of [null, admin.id])
      expect(
        await canReadChapter(db, viewer, {
          id: "premium-1",
          accessType: "PAID",
          authorId: author.id,
        }),
      ).toBe(false);
  });

  it("premium yetkisi askıdaysa yeni bölüm açılamaz; açılmış bölümler okunur", async () => {
    await db.book.update({
      where: { id: "book" },
      data: { premiumStatus: "SUSPENDED" },
    });
    await db.user.update({
      where: { id: admin.id },
      data: { coinBalance: 100 },
    });
    await expect(unlockChapter(db, admin, "premium-1")).rejects.toMatchObject({
      code: "SALES_CLOSED",
    });
    expect(
      await canReadChapter(db, reader.id, {
        id: "premium-1",
        accessType: "PAID",
        authorId: author.id,
      }),
    ).toBe(true);
    await db.book.update({
      where: { id: "book" },
      data: { premiumStatus: "ACTIVE" },
    });
  });

  it("veritabanı bakiyenin eksiye düşmesine izin vermez", async () => {
    await expect(
      db.user.update({
        where: { id: reader.id },
        data: { coinBalance: -1 },
      }),
    ).rejects.toThrow();
  });
});

describe("iyzico imzası", () => {
  it("IYZWSv2 başlığını randomKey + yol + gövde üzerinden HMAC-SHA256 ile üretir", () => {
    const header = iyzicoAuthorization(
      "api-key",
      "secret-key",
      "/payment/test",
      '{"a":1}',
      "123abc",
    );
    const signature = createHmac("sha256", "secret-key")
      .update('123abc/payment/test{"a":1}')
      .digest("hex");
    expect(header).toBe(
      `IYZWSv2 ${Buffer.from(
        `apiKey:api-key&randomKey:123abc&signature:${signature}`,
      ).toString("base64")}`,
    );
  });
});
