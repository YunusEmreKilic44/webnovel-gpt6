import "server-only";
import { z } from "zod";
import type { Database } from "@/db";
import type { Actor } from "@/db/schema";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError, requireVerified } from "@/modules/publishing/policies";

type Tx = Prisma.TransactionClient;
const idInput = z.string().min(1).max(128);

async function hitRateLimit(tx: Tx, key: string, max: number) {
  const [limit] = await tx.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, count) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - interval '1 minute' THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - interval '1 minute' THEN now() ELSE rate_limits.window_start END
    RETURNING count
  `;
  if (limit.count > max)
    throw new DomainError(
      "RATE_LIMIT",
      "Biraz hızlı ilerliyorsun. Bir dakika sonra tekrar dene.",
    );
}

/** The profile owner must exist and not be banned. */
async function requireProfile(tx: Tx, userId: string) {
  const user = await tx.user.findFirst({
    where: { id: userId, banned: false },
    select: { id: true },
  });
  if (!user) throw new DomainError("NOT_FOUND", "Kullanıcı bulunamadı.");
}

// ---- Follows ---------------------------------------------------------------

/** Follows or unfollows an author. Idempotent in both directions. */
export async function setFollow(
  db: Database,
  actor: Actor,
  authorId: string,
  follow: boolean,
) {
  idInput.parse(authorId);
  if (authorId === actor.id)
    throw new DomainError("SELF_FOLLOW", "Kendini takip edemezsin.");
  await db.$transaction(async (tx) => {
    await hitRateLimit(tx, `${actor.id}:follow`, 30);
    if (!follow) {
      await tx.authorFollow.deleteMany({
        where: { followerId: actor.id, authorId },
      });
      return;
    }
    await requireProfile(tx, authorId);
    await tx.authorFollow.createMany({
      data: [{ followerId: actor.id, authorId }],
      skipDuplicates: true,
    });
  });
}

export async function getFollowState(
  db: Database,
  authorId: string,
  viewerId: string | null,
) {
  const [followers, mine] = await Promise.all([
    db.authorFollow.count({ where: { authorId, follower: { banned: false } } }),
    viewerId
      ? db.authorFollow.findUnique({
          where: { followerId_authorId: { followerId: viewerId, authorId } },
          select: { authorId: true },
        })
      : null,
  ]);
  return { followers, following: Boolean(mine) };
}

// ---- Profile comments --------------------------------------------------------

export const profileCommentInput = z.object({
  profileUserId: idInput,
  body: z
    .string()
    .trim()
    .min(2, "Yorum en az 2 karakter olmalı.")
    .max(1000, "Yorum en fazla 1000 karakter olabilir."),
});

export async function addProfileComment(
  db: Database,
  actor: Actor,
  raw: z.input<typeof profileCommentInput>,
) {
  requireVerified(actor);
  const input = profileCommentInput.parse(raw);
  return db.$transaction(async (tx) => {
    const author = await tx.user.findUnique({
      where: { id: actor.id },
      select: { banned: true },
    });
    if (!author || author.banned)
      throw new DomainError("FORBIDDEN", "Hesabın bu işlem için uygun değil.");
    await hitRateLimit(tx, `${actor.id}:profile-comment`, 5);
    await requireProfile(tx, input.profileUserId);
    const comment = await tx.profileComment.create({
      data: {
        id: crypto.randomUUID(),
        profileUserId: input.profileUserId,
        authorId: actor.id,
        body: input.body,
      },
      select: { id: true },
    });
    return comment.id;
  });
}

/**
 * The comment's writer or the profile owner can remove it. Removal hides the
 * comment (like moderation) so reports and history keep their subject.
 */
export async function removeProfileComment(
  db: Database,
  actor: Actor,
  commentId: string,
) {
  idInput.parse(commentId);
  const removed = await db.profileComment.updateMany({
    where: {
      id: commentId,
      hidden: false,
      OR: [{ authorId: actor.id }, { profileUserId: actor.id }],
    },
    data: { hidden: true },
  });
  if (!removed.count)
    throw new DomainError(
      "NOT_FOUND",
      "Yorum bulunamadı veya silme yetkin yok.",
    );
  const comment = await db.profileComment.findUniqueOrThrow({
    where: { id: commentId },
    select: { profileUserId: true },
  });
  return comment.profileUserId;
}

export async function getProfileComments(db: Database, profileUserId: string) {
  return db.profileComment.findMany({
    where: { profileUserId, hidden: false, author: { banned: false } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
    },
  });
}
