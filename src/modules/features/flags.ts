import "server-only";
import { cache } from "react";
import { getDb, type Database } from "@/db";
import type { Prisma } from "@/generated/prisma/client";

// Read side of the feature switches. Deliberately free of other module
// imports: publishing and coins check these, and the admin service (which
// writes them) imports publishing.

export const featureKeys = ["coinStore", "premiumApplications"] as const;
export type FeatureKey = (typeof featureKeys)[number];
export type FeatureFlags = Record<FeatureKey, boolean>;

export const featureDefinitions: Record<
  FeatureKey,
  { title: string; description: string; column: string }
> = {
  coinStore: {
    title: "Coin mağazası",
    description:
      "Okurlar iyzico ile coin paketi satın alabilir. Kapalıyken mağaza bağlantıları gizlenir ve yeni ödeme başlatılamaz; başlamış ödemeler yine sonuçlanır, mevcut bakiyeler korunur.",
    column: "coinStoreEnabled",
  },
  premiumApplications: {
    title: "Premium başvuruları",
    description:
      "Yazarlar, şartları sağlayan kitapları için premium başvurusu yapabilir. Kapalıyken başvuru formu gizlenir; zaten premium olan kitaplar etkilenmez.",
    column: "premiumApplicationsEnabled",
  },
};

/** Everything starts off until an admin turns it on. */
export const defaultFlags: FeatureFlags = {
  coinStore: false,
  premiumApplications: false,
};

export async function readFeatureFlags(
  db: Database | Prisma.TransactionClient,
): Promise<FeatureFlags> {
  const settings = await db.coinSettings.findUnique({
    where: { id: 1 },
    select: { coinStoreEnabled: true, premiumApplicationsEnabled: true },
  });
  return settings
    ? {
        coinStore: settings.coinStoreEnabled,
        premiumApplications: settings.premiumApplicationsEnabled,
      }
    : defaultFlags;
}

/** Per-request read for pages and layout slots. */
export const getFeatureFlags = cache(() => readFeatureFlags(getDb()));
