"use server";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { getCurrentUser } from "@/lib/session";
import type { ActionState } from "@/lib/action-state";
import { DomainError } from "./policies";
import * as service from "./service";

async function run(
  work: (
    actor: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  ) => Promise<Partial<ActionState>>,
): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (!actor)
    return {
      ok: false,
      message: "Devam etmek için giriş yapmalısın.",
      href: "/giris",
    };
  try {
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
    console.error("publishing.action.failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      ok: false,
      message: "İşlem tamamlanamadı. Alanları kontrol edip tekrar dene.",
    };
  }
}
const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const fileField = (form: FormData, key: string) => {
  const file = form.get(key);
  return file instanceof File ? file : null;
};
export async function createBookAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    const input = service.bookInput.parse({
      title: value(form, "title"),
      description: value(form, "description"),
      genre: value(form, "genre"),
      cover: value(form, "cover"),
    });
    const bookId = await service.createBook(
      getDb(),
      actor,
      input,
      fileField(form, "coverImage"),
    );
    return { message: "Yeni hikâyen hazır.", href: `/studio/books/${bookId}` };
  });
}
export async function updateBookDetailsAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    const input = service.bookDetailsInput.parse({
      bookId: value(form, "bookId"),
      title: value(form, "title"),
      subtitle: value(form, "subtitle"),
      description: value(form, "description"),
      genre: value(form, "genre"),
      storyStatus: value(form, "storyStatus"),
      cover: value(form, "cover"),
      removeCoverImage: form.get("removeCoverImage") === "on",
    });
    await service.updateBookDetails(
      getDb(),
      actor,
      input,
      fileField(form, "coverImage"),
    );
    return { message: "Kitap bilgileri kaydedildi." };
  });
}
export async function addVolumeAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.addVolume(
      getDb(),
      actor,
      value(form, "bookId"),
      value(form, "title"),
    );
    return { message: "Cilt eklendi." };
  });
}
export async function addChapterAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    const chapterId = await service.addChapter(
      getDb(),
      actor,
      value(form, "bookId"),
      value(form, "volumeId"),
      value(form, "title"),
    );
    return {
      href: `/studio/books/${value(form, "bookId")}/chapters/${chapterId}`,
    };
  });
}
export async function saveChapterAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    const version = await service.saveChapter(getDb(), actor, {
      chapterId: value(form, "chapterId"),
      title: value(form, "title"),
      rawContent: value(form, "content"),
      expectedVersion: Number(form.get("version")),
    });
    return { message: "Taslak kaydedildi.", version };
  });
}
export async function submitApplicationAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    if (form.get("rights") !== "on")
      throw new DomainError(
        "RIGHTS_REQUIRED",
        "İçeriğin yayın haklarına sahip olduğunu onaylamalısın.",
      );
    await service.submitApplication(
      getDb(),
      actor,
      value(form, "bookId"),
      z.enum(["PUBLICATION", "PREMIUM"]).parse(form.get("type")),
    );
    return { message: "Başvurun incelemeye gönderildi." };
  });
}
export async function reviewApplicationAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.reviewApplication(
      getDb(),
      actor,
      value(form, "applicationId"),
      z.enum(["APPROVED", "REJECTED"]).parse(form.get("decision")),
      value(form, "note"),
    );
    return { message: "Başvuru kararı kaydedildi." };
  });
}
export async function publishChapterAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.publishChapter(
      getDb(),
      actor,
      value(form, "chapterId"),
      Number(form.get("version")),
    );
    return { message: "Bölüm yayımlandı." };
  });
}
export async function setChapterPriceAction(_: ActionState, form: FormData) {
  return run(async (actor) => {
    await service.setChapterPrice(
      getDb(),
      actor,
      value(form, "chapterId"),
      Math.round(Number(form.get("price")) * 100),
    );
    return { message: "Bölüm fiyatı güncellendi." };
  });
}
