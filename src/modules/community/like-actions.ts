"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { DomainError } from "@/modules/publishing/policies";
import { setCommentLike } from "./likes";
import type { CommentLikeState } from "./like-state";

export async function commentLikeAction(
  bookId: string,
  commentId: string,
  previous: CommentLikeState,
  form: FormData,
): Promise<CommentLikeState> {
  const actor = await getCurrentUser();
  if (!actor)
    return {
      ...previous,
      ok: false,
      message: "Beğenmek için giriş yapmalısın.",
    };
  try {
    const liked = z.enum(["true", "false"]).parse(form.get("liked")) === "true";
    const result = await setCommentLike(getDb(), actor, {
      bookId,
      commentId,
      liked,
    });
    revalidatePath(`/kitap/${result.slug}`);
    return {
      ok: true,
      message: "",
      liked: result.liked,
      likeCount: result.likeCount,
    };
  } catch (error) {
    return {
      ...previous,
      ok: false,
      message:
        error instanceof DomainError
          ? error.message
          : "Beğeni kaydedilemedi. Tekrar dene.",
    };
  }
}
