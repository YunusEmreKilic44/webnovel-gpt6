"use server";

import { revalidatePath, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { getCurrentUser } from "@/lib/session";
import type { ActionState } from "@/lib/action-state";
import { DomainError } from "@/modules/publishing/policies";
import { updateAvatar } from "./service";

export async function updateProfile(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      message: "Devam etmek için giriş yapmalısın.",
      href: "/giris",
    };
  const result = z.string().trim().min(2).max(60).safeParse(form.get("name"));
  if (!result.success)
    return { ok: false, message: "Görünen adın 2–60 karakter olmalı." };
  try {
    await getDb().user.update({
      where: { id: user.id },
      data: { name: result.data, updatedAt: new Date() },
    });
    // The display name is denormalised into every catalog row as the author.
    updateTag(CATALOG_TAG);
    revalidatePath("/", "layout");
    return { ok: true, message: "Profilin güncellendi." };
  } catch {
    return { ok: false, message: "Profilin güncellenemedi. Tekrar dene." };
  }
}

export async function updateAvatarAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      message: "Devam etmek için giriş yapmalısın.",
      href: "/giris",
    };
  const file = form.get("avatar");
  const remove = form.get("intent") === "remove";
  try {
    await updateAvatar(
      getDb(),
      user,
      !remove && file instanceof File ? file : null,
      remove,
    );
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: remove
        ? "Profil resmin kaldırıldı."
        : "Profil resmin güncellendi.",
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, message: error.message };
    console.error("account.avatar.failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, message: "Profil resmin kaydedilemedi. Tekrar dene." };
  }
}

export async function updateReadingPreferences(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!(await getCurrentUser()))
    return {
      ok: false,
      message: "Devam etmek için giriş yapmalısın.",
      href: "/giris",
    };
  const result = z
    .object({
      theme: z.enum(["dark", "paper", "sepia"]),
      font: z.coerce.number().int().min(16).max(28),
    })
    .safeParse({ theme: form.get("theme"), font: form.get("font") });
  if (!result.success)
    return { ok: false, message: "Geçerli bir görünüm ve yazı boyutu seç." };
  const store = await cookies();
  const options = { path: "/", maxAge: 31536000, sameSite: "lax" as const };
  store.set("reader-theme", result.data.theme, options);
  store.set("reader-font", String(result.data.font), options);
  revalidatePath("/ayarlar");
  return { ok: true, message: "Okuma tercihlerin kaydedildi." };
}
