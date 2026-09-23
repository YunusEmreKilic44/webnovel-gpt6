"use client";
import { useActionState } from "react";
import { Heart, LoaderCircle } from "./icons";
import { commentLikeAction } from "@/modules/community/like-actions";

export function CommentLikeButton({
  bookId,
  commentId,
  liked,
  likeCount,
}: {
  bookId: string;
  commentId: string;
  liked: boolean;
  likeCount: number;
}) {
  const [state, action, pending] = useActionState(
    commentLikeAction.bind(null, bookId, commentId),
    { ok: true, message: "", liked, likeCount },
  );
  return (
    <form action={action} className="comment-like-form">
      <input type="hidden" name="liked" value={String(!state.liked)} />
      <button
        type="submit"
        className="comment-like-button"
        disabled={pending}
        aria-pressed={state.liked}
        aria-label={state.liked ? "Beğeniyi geri al" : "Yorumu beğen"}
      >
        {pending ? (
          <LoaderCircle size={15} className="spin" />
        ) : (
          <Heart size={15} fill={state.liked ? "currentColor" : "none"} />
        )}
        <span>{state.liked ? "Beğendin" : "Beğen"}</span>
        <span aria-label="Beğeni sayısı" aria-live="polite">
          {state.likeCount.toLocaleString("tr-TR")}
        </span>
      </button>
      {state.message && (
        <span role="status" className="form-message error">
          {state.message}
        </span>
      )}
    </form>
  );
}
