"use server";
import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import type { Actor } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { DomainError, requireReviewer } from "@/modules/publishing/policies";
import * as service from "./service";

async function run(
  work: (actor: Actor) => Promise<Partial<ActionState>>,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor)
    return { ok: false, message: "Önce giriş yapmalısın.", href: "/giris" };
  try {
    requireReviewer(actor);
    const result = await work(actor);
    updateTag(CATALOG_TAG);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: "Değişiklikler kaydedildi.",
      nonce: crypto.randomUUID(),
      ...result,
    };
  } catch (error) {
    if (error instanceof DomainError)
      return { ok: false, message: error.message };
    if (error instanceof z.ZodError)
      return {
        ok: false,
        message: error.issues[0]?.message || "Alanları kontrol et.",
      };
    console.error("admin.action.failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, message: "İşlem tamamlanamadı. Tekrar dene." };
  }
}
const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const base = (form: FormData) => ({
  id: value(form, "id"),
  reason: value(form, "reason"),
});

export async function updateUserAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.updateUser(
      getDb(),
      actor,
      service.userInput.parse({
        ...base(form),
        name: value(form, "name"),
        role: value(form, "role"),
      }),
    );
    return {};
  });
}
export async function revokeSessionsAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.revokeUserSessions(getDb(), actor, base(form));
    return {
      message: "Kullanıcının oturumları kapatıldı.",
      ...(actor.id === value(form, "id") ? { href: "/giris" } : {}),
    };
  });
}
export async function banUserAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    const banned =
      z.enum(["true", "false"]).parse(form.get("banned")) === "true";
    await service.setUserBan(getDb(), actor, { ...base(form), banned });
    return {
      message: banned
        ? "Kullanıcı banlandı ve oturumları kapatıldı."
        : "Ban kaldırıldı. Kullanıcı yeniden giriş yapabilir.",
    };
  });
}
export async function updateBookAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.updateBook(
      getDb(),
      actor,
      service.bookUpdateInput.parse({
        ...base(form),
        title: value(form, "title"),
        description: value(form, "description"),
        genres: form.getAll("genres"),
        tags: form.getAll("tags"),
        storyStatus: value(form, "storyStatus"),
        hidden: form.get("hidden") === "on",
        featured: form.get("featured") === "on",
        removeCoverImage: form.get("removeCoverImage") === "on",
      }),
    );
    return {};
  });
}
export async function chapterVisibilityAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.setChapterVisibility(getDb(), actor, {
      ...base(form),
      hidden: z.enum(["true", "false"]).parse(form.get("hidden")) === "true",
    });
    return {};
  });
}
export async function commentVisibilityAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.setCommentVisibility(getDb(), actor, {
      ...base(form),
      hidden: z.enum(["true", "false"]).parse(form.get("hidden")) === "true",
    });
    return {};
  });
}
