import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrateLocal } from "./support/migrate";
import { createLocalDatabase } from "./support/database";
import { getDb } from "@/db";
import { readFeatureFlags } from "@/modules/features/flags";
import { setFeatureFlag } from "@/modules/features/service";
import { createCoinOrder } from "@/modules/coins/service";
import { initializeCheckout } from "@/lib/iyzico";

vi.mock("server-only", () => ({}));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: vi.fn(),
}));
vi.mock("@/lib/iyzico", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/iyzico")>()),
  initializeCheckout: vi.fn(),
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const user = (id: string, extra: object = {}) => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role: "reader",
  emailVerified: true,
  ...extra,
});
const reader = user("reader");
const admin = user("admin", { role: "admin" });
const context = { ip: "127.0.0.1", callbackUrl: "https://satir.test/cb" };

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  await migrateLocal(client);
  for (const actor of [reader, admin]) await db.user.create({ data: actor });
});
afterAll(close);

describe("Özellik anahtarları", () => {
  it("coin mağazası ve premium başvuruları varsayılan olarak kapalıdır", async () => {
    expect(await readFeatureFlags(db)).toEqual({
      coinStore: false,
      premiumApplications: false,
    });
  });

  it("mağaza kapalıyken sipariş oluşturulmaz ve iyzico çağrılmaz", async () => {
    await expect(
      createCoinOrder(db, reader, "coins-50", context),
    ).rejects.toMatchObject({ code: "COIN_STORE_CLOSED" });
    expect(initializeCheckout).not.toHaveBeenCalled();
    expect(await db.coinOrder.count()).toBe(0);
  });

  it("yalnız yönetici açıp kapatabilir; her değişiklik kaydedilir", async () => {
    await expect(
      setFeatureFlag(db, reader, { key: "coinStore", enabled: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setFeatureFlag(db, admin, { key: "coinStore", enabled: true });
    expect(await readFeatureFlags(db)).toMatchObject({
      coinStore: true,
      premiumApplications: false,
    });
    vi.mocked(initializeCheckout).mockResolvedValueOnce({
      token: "t",
      paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=t",
    });
    await createCoinOrder(db, reader, "coins-50", context);
    expect(await db.coinOrder.count()).toBe(1);

    await setFeatureFlag(db, admin, { key: "coinStore", enabled: false });
    expect((await readFeatureFlags(db)).coinStore).toBe(false);
    expect(
      await db.auditLog.count({ where: { action: "ADMIN_FEATURE_TOGGLED" } }),
    ).toBe(2);
  });
});
