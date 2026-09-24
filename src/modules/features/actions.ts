"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import type { ActionState } from "@/lib/action-state";
import { DomainError } from "@/modules/publishing/policies";
import { featureDefinitions, type FeatureKey } from "./flags";
import { setFeatureFlag } from "./service";

export async function setFeatureFlagAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Önce giriş yapmalısın." };
  const key = String(form.get("key") ?? "") as FeatureKey;
  const enabled = form.get("enabled") === "true";
  try {
    await setFeatureFlag(getDb(), actor, { key, enabled });
    // Navigation, menus and studio panels all depend on these switches.
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `${featureDefinitions[key].title} ${enabled ? "açıldı" : "kapatıldı"}.`,
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, message: error.message };
    return { ok: false, message: "Ayar kaydedilemedi. Tekrar dene." };
  }
}
