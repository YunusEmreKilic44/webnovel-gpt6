"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import type { ActionState } from "@/lib/action-state";
import { DomainError } from "@/modules/publishing/policies";
import { addProfileComment, removeProfileComment, setFollow } from "./service";

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
  console.error("social.action.failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return { ok: false, message: fallback };
}
const value = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function followAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return signIn;
  const authorId = value(form, "authorId");
  const follow = value(form, "follow") === "true";
  try {
    await setFollow(getDb(), actor, authorId, follow);
    revalidatePath(`/yazar/${authorId}`);
    return {
      ok: true,
      message: follow
        ? "Takip ediyorsun. Yeni kitapları yayımlandığında haber vereceğiz."
        : "Takibi bıraktın.",
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    return failure(error, "İşlem tamamlanamadı. Tekrar dene.");
  }
}

export async function addProfileCommentAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return signIn;
  const profileUserId = value(form, "profileUserId");
  try {
    await addProfileComment(getDb(), actor, {
      profileUserId,
      body: value(form, "body"),
    });
    revalidatePath(`/yazar/${profileUserId}`);
    return {
      ok: true,
      message: "Yorumun paylaşıldı.",
      nonce: crypto.randomUUID(),
    };
  } catch (error) {
    return failure(error, "Yorum paylaşılamadı. Tekrar dene.");
  }
}

export async function removeProfileCommentAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor) return signIn;
  try {
    await removeProfileComment(getDb(), actor, value(form, "commentId"));
    revalidatePath(`/yazar/${value(form, "profileUserId")}`);
    return { ok: true, message: "Yorum silindi.", nonce: crypto.randomUUID() };
  } catch (error) {
    return failure(error, "Yorum silinemedi.");
  }
}
