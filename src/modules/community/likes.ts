import "server-only";
import { z } from "zod";
import type { Database } from "@/db";
import type { Actor } from "@/db/schema";
import { DomainError, requireVerified } from "@/modules/publishing/policies";

const inputSchema = z.object({
  bookId: z.string().min(1).max(128),
  commentId: z.string().min(1).max(128),
  liked: z.boolean(),
});

export async function setCommentLike(
  db: Database,
  actor: Actor,
  raw: z.input<typeof inputSchema>,
) {
  const input = inputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    // A ban waits for in-flight interactions and denies all subsequent ones.
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${actor.id} FOR SHARE`;
    const user = await tx.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        name: true,
        role: true,
        emailVerified: true,
        banned: true,
      },
    });
    if (!user || user.banned)
      throw new DomainError("FORBIDDEN", "Bu hesapla işlem yapılamıyor.");
    requireVerified(user);
    await tx.$queryRaw`SELECT id FROM books WHERE id = ${input.bookId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM comments WHERE id = ${input.commentId} FOR UPDATE`;
    const comment = await tx.comment.findFirst({
      where: {
        id: input.commentId,
        bookId: input.bookId,
        hidden: false,
        book: { status: "PUBLISHED", hidden: false },
      },
      select: { book: { select: { slug: true } } },
    });
    if (!comment)
      throw new DomainError(
        "NOT_FOUND",
        "Yorum bulunamadı veya artık görünür değil.",
      );
    const [limit] = await tx.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits (key, count) VALUES (${actor.id + ":comment-like"}, 1)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits.window_start < now() - interval '1 minute' THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE WHEN rate_limits.window_start < now() - interval '1 minute' THEN now() ELSE rate_limits.window_start END
      RETURNING count
    `;
    if (limit.count > 60)
      throw new DomainError(
        "RATE_LIMIT",
        "Biraz hızlı ilerliyorsun. Bir dakika sonra tekrar dene.",
      );
    const key = { commentId: input.commentId, userId: actor.id };
    if (input.liked)
      await tx.commentLike.upsert({
        where: { commentId_userId: key },
        create: key,
        update: {},
      });
    else await tx.commentLike.deleteMany({ where: key });
    return {
      liked: input.liked,
      likeCount: await tx.commentLike.count({
        where: { commentId: input.commentId },
      }),
      slug: comment.book.slug,
    };
  });
}
