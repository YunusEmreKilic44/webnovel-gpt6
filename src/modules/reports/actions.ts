"use server";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import type { ActionState } from "@/lib/action-state";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { DomainError } from "@/modules/publishing/policies";
import { createReport, resolveReport } from "./service";

function failure(error: unknown, fallback: string): ActionState {
  if (error instanceof DomainError)
    return { ok: false, message: error.message };
  if (error instanceof z.ZodError)
    return {
      ok: false,
      message: error.issues[0]?.message ?? "Alanları kontrol et.",
    };
  console.error("reports.action.failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return { ok: false, message: fallback };
}
const value = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function createReportAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor)
    return { ok: false, message: "Şikâyet etmek için giriş yapmalısın." };
  try {
    await createReport(getDb(), actor, {
      targetType: value(form, "targetType") as never,
      targetId: value(form, "targetId"),
      reason: value(form, "reason") as never,
      details: value(form, "details"),
    });
    revalidatePath("/admin/raporlar");
    return {
      ok: true,
      message: "Şikâyetin alındı. Ekibimiz inceleyecek; teşekkür ederiz.",
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    return failure(error, "Şikâyet gönderilemedi. Tekrar dene.");
  }
}

export async function resolveReportAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, message: "Önce giriş yapmalısın." };
  try {
    const closed = await resolveReport(getDb(), actor, {
      id: value(form, "id"),
      decision: value(form, "decision") as never,
      action: (value(form, "action") || "NONE") as never,
      note: value(form, "note"),
    });
    // Hiding content or banning changes public pages and the catalog.
    updateTag(CATALOG_TAG);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Şikâyet sonuçlandı (${closed} açık şikâyet kapatıldı).`,
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    return failure(error, "İşlem tamamlanamadı. Tekrar dene.");
  }
}
