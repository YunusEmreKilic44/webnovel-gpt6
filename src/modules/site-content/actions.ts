"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import type { Actor } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { DomainError, requireReviewer } from "@/modules/publishing/policies";
import {
  saveAnnouncement,
  saveSlide,
  deleteSiteContent,
  imagePresets,
} from "./service";

async function run(
  work: (actor: Actor) => Promise<unknown>,
): Promise<ActionState> {
  try {
    const actor = await getCurrentUser();
    if (!actor) return { ok: false, message: "Önce giriş yapmalısın." };
    requireReviewer(actor);
    await work(actor);
    revalidatePath("/");
    revalidatePath("/admin/duyurular");
    revalidatePath("/admin/slider");
    revalidatePath("/admin/islem-kaydi");
    return {
      ok: true,
      message: "Değişiklik kaydedildi.",
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, message: error.message };
    if (error instanceof z.ZodError)
      return {
        ok: false,
        message: error.issues[0]?.message ?? "Alanları kontrol et.",
      };
    console.error("site-content.save.failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, message: "İşlem tamamlanamadı. Tekrar dene." };
  }
}
const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const common = (form: FormData) => ({
  id: value(form, "id"),
  title: value(form, "title"),
  linkPath: value(form, "linkPath"),
  linkLabel: value(form, "linkLabel"),
  position: value(form, "position"),
  published: form.get("published") === "on",
});
export async function saveAnnouncementAction(_: ActionState, form: FormData) {
  return run((actor) =>
    saveAnnouncement(getDb(), actor, {
      ...common(form),
      body: value(form, "body"),
    }),
  );
}
export async function saveSlideAction(_: ActionState, form: FormData) {
  const file = form.get("image");
  return run((actor) =>
    saveSlide(
      getDb(),
      actor,
      {
        ...common(form),
        description: value(form, "description"),
        imageAlt: value(form, "imageAlt"),
        imagePreset: z.enum(imagePresets).parse(value(form, "imagePreset")),
        usePreset: form.get("usePreset") === "on",
      },
      file instanceof File ? file : null,
    ),
  );
}
export async function deleteContentAction(_: ActionState, form: FormData) {
  return run((actor) =>
    deleteSiteContent(
      getDb(),
      actor,
      z.enum(["announcement", "slide"]).parse(value(form, "kind")),
      value(form, "id"),
    ),
  );
}
