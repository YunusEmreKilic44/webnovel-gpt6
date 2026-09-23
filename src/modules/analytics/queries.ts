import "server-only";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";

export async function getPublicReadCount(bookId: string) {
  return getDb().chapterRead.count({
    where: {
      chapter: { bookId, book: { status: "PUBLISHED", hidden: false } },
    },
  });
}

export type AuthorBookStats = {
  id: string;
  title: string;
  slug: string;
  status: string;
  hidden: boolean;
  chapterCount: number;
  publishedCount: number;
  readCount: number;
  recentReadCount: number;
  libraryCount: number;
  commentCount: number;
  ratingCount: number;
  averageRating: number;
};

// Never shared-cache author statistics; scope every query to the current session.
export async function getAuthorBookStats(bookId?: string) {
  const actor = await requireUser();
  return getDb().$queryRaw<AuthorBookStats[]>`
    SELECT b.id, b.title, b.slug, b.status, b.hidden,
      ch.total AS "chapterCount", ch.published AS "publishedCount",
      rd.total AS "readCount", rd.recent AS "recentReadCount",
      (SELECT count(*)::int FROM library_entries l WHERE l.book_id = b.id) AS "libraryCount",
      (SELECT count(*)::int FROM comments c WHERE c.book_id = b.id AND NOT c.hidden) AS "commentCount",
      rt.total AS "ratingCount", rt.average AS "averageRating"
    FROM books b
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE c.status = 'PUBLISHED' AND NOT c.hidden)::int AS published
      FROM chapters c WHERE c.book_id = b.id
    ) ch ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE r.created_at >= now() - interval '7 days')::int AS recent
      FROM chapter_reads r JOIN chapters c ON c.id = r.chapter_id WHERE c.book_id = b.id
    ) rd ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS total, coalesce(round(avg(r.score), 1)::float, 0) AS average
      FROM ratings r WHERE r.book_id = b.id
    ) rt ON true
    WHERE b.author_id = ${actor.id} AND (${bookId ?? null}::text IS NULL OR b.id = ${bookId ?? null})
    ORDER BY b.updated_at DESC, b.id
  `;
}

export async function getAuthorChapterStats(bookId: string) {
  const actor = await requireUser();
  return getDb().chapter.findMany({
    where: { bookId, book: { authorId: actor.id } },
    select: {
      id: true,
      title: true,
      position: true,
      status: true,
      hidden: true,
      firstPublishedAt: true,
      volume: { select: { title: true, position: true } },
      _count: { select: { reads: true } },
    },
    orderBy: [{ volume: { position: "asc" } }, { position: "asc" }],
  });
}
