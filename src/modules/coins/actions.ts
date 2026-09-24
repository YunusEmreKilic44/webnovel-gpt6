"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import type { ActionState } from "@/lib/action-state";
import { DomainError } from "@/modules/publishing/policies";
import * as service from "./service";

const signIn = {
  ok: false,
  message: "Devam etmek için giriş yapmalısın.",
  href: "/giris",
} satisfies ActionState;

function failure(error: unknown, fallback: string): ActionState {
  if (error instanceof DomainError)
    return { ok: false, message: error.message };
  if (error instanceof z.ZodError)
    return {
      ok: false,
      message: error.issues[0]?.message ?? "Alanları kontrol et.",
    };
  console.error("coins.action.failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return { ok: false, message: fallback };
}

function appOrigin() {
  return (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

export async function buyCoinsAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return signIn;
  let paymentPageUrl: string;
  try {
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      "127.0.0.1";
    ({ paymentPageUrl } = await service.createCoinOrder(
      getDb(),
      actor,
      String(form.get("packageId") ?? ""),
      { ip, callbackUrl: `${appOrigin()}/api/payments/iyzico/callback` },
    ));
  } catch (error) {
    return failure(error, "Ödeme başlatılamadı. Tekrar dene.");
  }
  // Only iyzico-issued URLs are followed.
  if (!isIyzicoPaymentPage(paymentPageUrl))
    return { ok: false, message: "Ödeme sayfası adresi geçersiz." };
  redirect(paymentPageUrl);
}

function isIyzicoPaymentPage(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "iyzipay.com" || url.hostname.endsWith(".iyzipay.com"))
    );
  } catch {
    return false;
  }
}

export async function unlockChapterAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return signIn;
  try {
    const chapterId = String(form.get("chapterId") ?? "");
    const result = await service.unlockChapter(getDb(), actor, chapterId);
    revalidatePath(`/oku/${chapterId}`);
    revalidatePath("/cuzdan");
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: result.alreadyOwned
        ? "Bu bölüm zaten açık."
        : `Bölüm açıldı. ${result.charged} coin harcandı.`,
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    return failure(error, "Bölüm açılamadı. Tekrar dene.");
  }
}

export async function updateCoinSettingsAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return signIn;
  try {
    await service.updateCoinSettings(getDb(), actor, {
      chapterPriceCoins: String(form.get("chapterPriceCoins") ?? ""),
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: "Premium bölüm fiyatı güncellendi.",
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    return failure(error, "Fiyat kaydedilemedi.");
  }
}

export async function updatePremiumRulesAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return signIn;
  try {
    await service.updatePremiumRules(getDb(), actor, {
      minChapters: String(form.get("minChapters") ?? ""),
      minReads: String(form.get("minReads") ?? ""),
    });
    revalidatePath("/admin/coin");
    return {
      ok: true,
      message: "Premium başvuru şartları güncellendi.",
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    return failure(error, "Şartlar kaydedilemedi.");
  }
}

export async function saveCoinPackageAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return signIn;
  try {
    const price = Number(String(form.get("price") ?? "").replace(",", "."));
    await service.saveCoinPackage(getDb(), actor, {
      id: String(form.get("id") ?? ""),
      coins: String(form.get("coins") ?? ""),
      priceMinor: Number.isFinite(price) ? Math.round(price * 100) : NaN,
      active: form.get("active") === "on",
      position: String(form.get("position") ?? "0"),
    });
    revalidatePath("/admin/coin");
    revalidatePath("/cuzdan");
    return {
      ok: true,
      message: "Coin paketi kaydedildi.",
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    return failure(error, "Paket kaydedilemedi.");
  }
}
