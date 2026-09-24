import "server-only";
import { z } from "zod";
import type { Database } from "@/db";
import type { Actor } from "@/db/schema";
import type { Prisma } from "@/generated/prisma/client";
import {
  initializeCheckout,
  retrieveCheckout,
  type CheckoutResult,
} from "@/lib/iyzico";
import { administrativeWrite, audit } from "@/modules/admin/service";
import { DomainError, requireVerified } from "@/modules/publishing/policies";
import { getPremiumRules } from "@/modules/premium/requirements";
import { readFeatureFlags } from "@/modules/features/flags";

// Coin economy rules:
// - A balance only changes together with a CoinTransaction row, in one
//   transaction. user.coin_balance >= 0 is enforced by the database.
// - An order is credited at most once (unique coin_transactions.order_id and a
//   PENDING → PAID compare-and-set), however many times iyzico calls back.
// - A premium chapter costs the current fixed price and is paid for at most
//   once per reader (unique chapter_unlocks(user_id, chapter_id)).

type Tx = Prisma.TransactionClient;
const DEFAULT_CHAPTER_PRICE = 5;

export async function getChapterPrice(db: Database | Tx) {
  const settings = await db.coinSettings.findUnique({ where: { id: 1 } });
  return settings?.chapterPriceCoins ?? DEFAULT_CHAPTER_PRICE;
}

export async function getActivePackages(db: Database) {
  return db.coinPackage.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { coins: "asc" }],
    select: { id: true, coins: true, priceMinor: true },
  });
}

async function hitRateLimit(tx: Tx, key: string, max: number) {
  const [limit] = await tx.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, count) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - interval '10 minutes' THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - interval '10 minutes' THEN now() ELSE rate_limits.window_start END
    RETURNING count
  `;
  if (limit.count > max)
    throw new DomainError(
      "RATE_LIMIT",
      "Çok sayıda ödeme denemesi yaptın. Birkaç dakika sonra tekrar dene.",
    );
}

/**
 * Creates a PENDING order for an active package and opens an iyzico checkout
 * form. Returns the hosted payment page URL to send the buyer to.
 */
export async function createCoinOrder(
  db: Database,
  actor: Actor & { email: string },
  packageId: string,
  context: { ip: string; callbackUrl: string },
) {
  requireVerified(actor);
  z.string().min(1).max(64).parse(packageId);
  const order = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: actor.id },
      select: { banned: true },
    });
    if (!user || user.banned)
      throw new DomainError("FORBIDDEN", "Hesabın bu işlem için uygun değil.");
    if (!(await readFeatureFlags(tx)).coinStore)
      throw new DomainError(
        "COIN_STORE_CLOSED",
        "Coin mağazası şu an kapalı. Yakında açılacak.",
      );
    await hitRateLimit(tx, `${actor.id}:coin-order`, 10);
    const pack = await tx.coinPackage.findFirst({
      where: { id: packageId, active: true },
    });
    if (!pack)
      throw new DomainError(
        "PACKAGE_UNAVAILABLE",
        "Bu coin paketi artık satışta değil.",
      );
    return tx.coinOrder.create({
      data: {
        id: crypto.randomUUID(),
        userId: actor.id,
        packageId: pack.id,
        coins: pack.coins,
        priceMinor: pack.priceMinor,
      },
    });
  });
  try {
    const checkout = await initializeCheckout({
      orderId: order.id,
      priceMinor: order.priceMinor,
      itemId: order.packageId ?? order.id,
      itemName: `${order.coins} Coin`,
      callbackUrl: context.callbackUrl,
      buyer: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        ip: context.ip,
      },
    });
    await db.coinOrder.update({
      where: { id: order.id },
      data: { providerToken: checkout.token, updatedAt: new Date() },
    });
    return { orderId: order.id, paymentPageUrl: checkout.paymentPageUrl };
  } catch (error) {
    await db.coinOrder.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        failureReason: "Ödeme formu açılamadı",
        updatedAt: new Date(),
      },
    });
    if (error instanceof DomainError) throw error;
    console.error("coins.checkout.init_failed", {
      orderId: order.id,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new DomainError(
      "PAYMENT_INIT_FAILED",
      "Ödeme sayfası açılamadı. Biraz sonra tekrar dene.",
    );
  }
}

const toMinor = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100)
    : NaN;

/** Why a checkout result cannot credit this order, or null when it can. */
export function checkoutMismatch(
  order: { id: string; priceMinor: number; currency: string },
  result: CheckoutResult,
) {
  if (result.status !== "success") return "iyzico isteği başarısız";
  if (result.paymentStatus !== "SUCCESS") return "ödeme tamamlanmadı";
  if (result.basketId !== order.id) return "sipariş numarası uyuşmuyor";
  if (result.currency !== order.currency) return "para birimi uyuşmuyor";
  if (toMinor(result.price) !== order.priceMinor) return "tutar uyuşmuyor";
  if (!(toMinor(result.paidPrice) >= order.priceMinor))
    return "tahsil edilen tutar eksik";
  // 1 = approved; 0 = held for review, -1 = rejected by iyzico fraud checks.
  if (result.fraudStatus !== undefined && result.fraudStatus !== 1)
    return "ödeme dolandırıcılık incelemesinde";
  return null;
}

/**
 * Settles an order from iyzico's callback token. Safe to call repeatedly:
 * only the first successful call credits coins.
 */
export async function completeCoinOrder(db: Database, token: string) {
  z.string().min(1).max(200).parse(token);
  const order = await db.coinOrder.findUnique({
    where: { providerToken: token },
  });
  if (!order) throw new DomainError("NOT_FOUND", "Sipariş bulunamadı.");
  // Already settled by an earlier callback: report it, change nothing.
  if (order.status !== "PENDING")
    return order.status === "PAID" ? ("PAID" as const) : ("FAILED" as const);
  const result = await retrieveCheckout(token, order.id);
  const mismatch = checkoutMismatch(order, result);
  if (mismatch) {
    const underReview =
      result.status === "success" &&
      result.paymentStatus === "SUCCESS" &&
      result.fraudStatus === 0;
    const declined =
      result.status === "failure" ||
      result.paymentStatus === "FAILURE" ||
      result.fraudStatus === -1;
    const paidButWrong = result.paymentStatus === "SUCCESS" && !underReview;
    // Anything else (3-D Secure still running, fraud review) stays PENDING and
    // is settled by a later callback.
    if (declined || paidButWrong) {
      await db.coinOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: {
          status: "FAILED",
          failureReason: (result.errorMessage || mismatch).slice(0, 300),
          providerPaymentId: result.paymentId ?? null,
          updatedAt: new Date(),
        },
      });
      if (paidButWrong)
        // Money was taken but did not match the order: needs a manual refund.
        console.error("coins.order.paid_mismatch", {
          orderId: order.id,
          paymentId: result.paymentId,
          mismatch,
        });
      return "FAILED" as const;
    }
    return "PENDING" as const;
  }
  return db.$transaction(async (tx) => {
    const claimed = await tx.coinOrder.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        providerPaymentId: result.paymentId ?? null,
        updatedAt: new Date(),
      },
    });
    // Another callback got here first and already credited the coins.
    if (claimed.count === 0) return "PAID" as const;
    const user = await tx.user.update({
      where: { id: order.userId },
      data: { coinBalance: { increment: order.coins } },
      select: { coinBalance: true },
    });
    await tx.coinTransaction.create({
      data: {
        id: crypto.randomUUID(),
        userId: order.userId,
        amount: order.coins,
        balanceAfter: user.coinBalance,
        kind: "TOP_UP",
        orderId: order.id,
        note: `${order.coins} coin yüklendi`,
      },
    });
    return "PAID" as const;
  });
}

/**
 * Spends the fixed price to unlock a premium chapter for good. Unlocking a
 * chapter the reader already owns is a no-op and never charges twice.
 */
export async function unlockChapter(
  db: Database,
  actor: Actor,
  chapterId: string,
) {
  requireVerified(actor);
  z.string().min(1).max(128).parse(chapterId);
  return db.$transaction(async (tx) => {
    const chapter = await tx.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        status: true,
        hidden: true,
        accessType: true,
        publishedTitle: true,
        book: {
          select: {
            authorId: true,
            status: true,
            hidden: true,
            premiumStatus: true,
          },
        },
      },
    });
    if (
      !chapter ||
      chapter.status !== "PUBLISHED" ||
      chapter.hidden ||
      chapter.book.status !== "PUBLISHED" ||
      chapter.book.hidden
    )
      throw new DomainError("NOT_FOUND", "Bölüm bulunamadı.");
    if (chapter.accessType !== "PAID" || chapter.book.authorId === actor.id)
      return { charged: 0, alreadyOwned: true };
    if (chapter.book.premiumStatus !== "ACTIVE")
      throw new DomainError(
        "SALES_CLOSED",
        "Bu kitabın premium bölümleri şu an açılamıyor.",
      );
    const price = await getChapterPrice(tx);
    // Claim the unlock first; the unique key makes concurrent attempts no-ops.
    const inserted = await tx.$executeRaw`
      INSERT INTO chapter_unlocks (id, user_id, chapter_id, coins_spent)
      VALUES (${crypto.randomUUID()}, ${actor.id}, ${chapter.id}, ${price})
      ON CONFLICT (user_id, chapter_id) DO NOTHING
    `;
    if (inserted === 0) return { charged: 0, alreadyOwned: true };
    const [debited] = await tx.$queryRaw<{ coinBalance: number }[]>`
      UPDATE "user" SET coin_balance = coin_balance - ${price}
      WHERE id = ${actor.id} AND NOT banned AND coin_balance >= ${price}
      RETURNING coin_balance AS "coinBalance"
    `;
    if (!debited)
      // Throwing rolls the unlock back as well.
      throw new DomainError(
        "INSUFFICIENT_COINS",
        `Bu bölüm için ${price} coin gerekiyor. Önce coin yüklemelisin.`,
      );
    await tx.coinTransaction.create({
      data: {
        id: crypto.randomUUID(),
        userId: actor.id,
        amount: -price,
        balanceAfter: debited.coinBalance,
        kind: "UNLOCK",
        chapterId: chapter.id,
        note: chapter.publishedTitle ?? "",
      },
    });
    return { charged: price, alreadyOwned: false };
  });
}

/** Whether this viewer may read a published, visible chapter's text. */
export async function canReadChapter(
  db: Database,
  viewerId: string | null,
  chapter: { id: string; accessType: string; authorId: string },
) {
  if (chapter.accessType === "FREE") return true;
  if (!viewerId) return false;
  if (viewerId === chapter.authorId) return true;
  const unlock = await db.chapterUnlock.findUnique({
    where: { userId_chapterId: { userId: viewerId, chapterId: chapter.id } },
    select: { id: true },
  });
  return Boolean(unlock);
}

export async function getWallet(db: Database, userId: string) {
  const [user, transactions, orders] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true },
    }),
    db.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        amount: true,
        balanceAfter: true,
        kind: true,
        note: true,
        createdAt: true,
        chapter: {
          select: { id: true, book: { select: { title: true } } },
        },
      },
    }),
    db.coinOrder.findMany({
      where: { userId, status: { not: "PAID" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        coins: true,
        priceMinor: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);
  return { balance: user?.coinBalance ?? 0, transactions, orders };
}

// ---- Administration -------------------------------------------------------

export const settingsInput = z.object({
  chapterPriceCoins: z.coerce
    .number()
    .int()
    .min(1, "Bölüm fiyatı en az 1 coin olmalı.")
    .max(1000),
});
export async function updateCoinSettings(
  db: Database,
  actor: Actor,
  raw: z.input<typeof settingsInput>,
) {
  const input = settingsInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    const before = await getChapterPrice(tx);
    await tx.coinSettings.upsert({
      where: { id: 1 },
      create: { id: 1, chapterPriceCoins: input.chapterPriceCoins },
      update: {
        chapterPriceCoins: input.chapterPriceCoins,
        updatedAt: new Date(),
      },
    });
    await audit(
      tx,
      actor,
      "ADMIN_COIN_PRICE_UPDATED",
      "coin-settings",
      `Premium bölüm fiyatı: ${before} → ${input.chapterPriceCoins} coin`,
      {
        before: { chapterPriceCoins: before },
        after: { chapterPriceCoins: input.chapterPriceCoins },
      },
    );
  });
}

export const premiumRulesInput = z.object({
  minChapters: z.coerce
    .number()
    .int()
    .min(0, "Bölüm şartı negatif olamaz.")
    .max(1000),
  minReads: z.coerce
    .number()
    .int()
    .min(0, "Okunma şartı negatif olamaz.")
    .max(10_000_000),
});
/** Minimum published chapters and reads a book needs to apply for premium. */
export async function updatePremiumRules(
  db: Database,
  actor: Actor,
  raw: z.input<typeof premiumRulesInput>,
) {
  const input = premiumRulesInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    const before = await getPremiumRules(tx);
    const data = {
      premiumMinChapters: input.minChapters,
      premiumMinReads: input.minReads,
    };
    await tx.coinSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: { ...data, updatedAt: new Date() },
    });
    await audit(
      tx,
      actor,
      "ADMIN_PREMIUM_RULES_UPDATED",
      "coin-settings",
      `Premium şartı: ${input.minChapters} bölüm, ${input.minReads} okunma`,
      { before, after: input },
    );
  });
}

export const packageInput = z.object({
  id: z.string().max(64).default(""),
  coins: z.coerce
    .number()
    .int()
    .min(1, "Paket en az 1 coin içermeli.")
    .max(100_000),
  priceMinor: z.coerce
    .number()
    .int()
    .min(100, "Paket fiyatı en az 1,00 TL olmalı.")
    .max(10_000_000),
  active: z.boolean(),
  position: z.coerce.number().int().min(0).max(9999),
});
export async function saveCoinPackage(
  db: Database,
  actor: Actor,
  raw: z.input<typeof packageInput>,
) {
  const { id, ...data } = packageInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    const before = id
      ? await tx.coinPackage.findUnique({ where: { id } })
      : null;
    if (id && !before)
      throw new DomainError("NOT_FOUND", "Coin paketi bulunamadı.");
    if (!id && (await tx.coinPackage.count()) >= 20)
      throw new DomainError("LIMIT", "En fazla 20 coin paketi olabilir.");
    // Existing orders keep the coins/price copied at checkout time.
    const saved = id
      ? await tx.coinPackage.update({
          where: { id },
          data: { ...data, updatedAt: new Date() },
        })
      : await tx.coinPackage.create({
          data: { ...data, id: crypto.randomUUID() },
        });
    await audit(
      tx,
      actor,
      "ADMIN_COIN_PACKAGE_SAVED",
      saved.id,
      `Coin paketi: ${data.coins} coin`,
      {
        before: before
          ? {
              coins: before.coins,
              priceMinor: before.priceMinor,
              active: before.active,
              position: before.position,
            }
          : {},
        after: data,
      },
    );
    return saved.id;
  });
}

export async function getAdminCoinOverview(db: Database) {
  const [price, packages, orders, totals, premiumRules] = await Promise.all([
    getChapterPrice(db),
    db.coinPackage.findMany({
      orderBy: [{ position: "asc" }, { coins: "asc" }],
    }),
    db.coinOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        coins: true,
        priceMinor: true,
        status: true,
        failureReason: true,
        providerPaymentId: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.coinOrder.aggregate({
      where: { status: "PAID" },
      _sum: { priceMinor: true, coins: true },
      _count: true,
    }),
    getPremiumRules(db),
  ]);
  const unlocks = await db.chapterUnlock.aggregate({
    _sum: { coinsSpent: true },
    _count: true,
  });
  return { price, packages, orders, totals, unlocks, premiumRules };
}
