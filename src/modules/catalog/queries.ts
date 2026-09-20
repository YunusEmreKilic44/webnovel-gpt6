import "server-only";
import { cache } from "react";
import { getDb } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import type { Book } from "@/db/schema";

export type CatalogBook = Pick<
  Book,
  | "id"
  | "slug"
  | "title"
  | "subtitle"
  | "description"
  | "genre"
  | "cover"
  | "status"
  | "storyStatus"
  | "premiumStatus"
  | "authorId"
  | "featured"
  | "updatedAt"
> & {
  author: string;
  chapterCount: number;
  volumeCount: number;
  averageRating: number;
  ratingCount: number;
};
const catalogColumns = Prisma.sql`
  b.id, b.slug, b.title, b.subtitle, b.description, b.genre, b.cover, b.status,
  b.story_status AS "storyStatus", b.premium_status AS "premiumStatus",
  b.author_id AS "authorId", b.featured, b.updated_at AS "updatedAt", u.name AS author,
  (SELECT count(*)::int FROM chapters c WHERE c.book_id = b.id AND c.status = 'PUBLISHED' AND NOT c.hidden) AS "chapterCount",
  (SELECT count(DISTINCT c.volume_id)::int FROM chapters c WHERE c.book_id = b.id AND c.status = 'PUBLISHED' AND NOT c.hidden) AS "volumeCount",
  coalesce((SELECT round(avg(r.score), 1)::float FROM ratings r WHERE r.book_id = b.id), 0) AS "averageRating",
  (SELECT count(*)::int FROM ratings r WHERE r.book_id = b.id) AS "ratingCount"
`;
export async function getCatalog(
  filters: {
    q?: string;
    genre?: string;
    completed?: boolean;
    sort?: string;
    limit?: number;
  } = {},
) {
  const limit = Math.max(1, Math.min(60, Math.trunc(filters.limit || 60)));
  const query = filters.q
    ?.trim()
    .slice(0, 100)
    .replace(/[\\%_]/g, "\\$&");
  return getDb().$queryRaw<CatalogBook[]>(Prisma.sql`
    SELECT ${catalogColumns} FROM books b JOIN "user" u ON u.id = b.author_id
    WHERE b.status = 'PUBLISHED' AND NOT b.hidden
    ${filters.genre && filters.genre !== "Tümü" ? Prisma.sql`AND b.genre = ${filters.genre}` : Prisma.empty}
    ${query ? Prisma.sql`AND (b.title ILIKE ${"%" + query + "%"} OR u.name ILIKE ${"%" + query + "%"})` : Prisma.empty}
    ${filters.completed ? Prisma.sql`AND b.story_status = 'COMPLETED'` : Prisma.empty}
    ORDER BY ${filters.sort === "rating" ? Prisma.sql`"averageRating" DESC,` : filters.sort === "recent" ? Prisma.empty : Prisma.sql`b.featured DESC,`}
    b.updated_at DESC, b.id LIMIT ${limit}
  `);
}
export const getPublicBook = cache(async (slug: string) => {
  const rows = await getDb().$queryRaw<CatalogBook[]>(Prisma.sql`
    SELECT ${catalogColumns} FROM books b JOIN "user" u ON u.id = b.author_id
    WHERE b.slug = ${slug} AND b.status = 'PUBLISHED' AND NOT b.hidden
  `);
  return rows[0];
});
export const getFirstPublicChapter = cache(async (bookId: string) =>
  getDb().chapter.findFirst({
    where: { bookId, status: "PUBLISHED", hidden: false },
    select: { id: true },
    orderBy: [{ volume: { position: "asc" } }, { position: "asc" }],
  }),
);
export const getPublicChapters = cache(async (bookId: string) => {
  const rows = await getDb().chapter.findMany({
    where: { bookId, status: "PUBLISHED", hidden: false },
    select: {
      id: true,
      publishedTitle: true,
      position: true,
      volumeId: true,
      accessType: true,
      priceMinor: true,
      publishedWordCount: true,
      firstPublishedAt: true,
      volume: { select: { title: true, position: true } },
    },
    orderBy: [{ volume: { position: "asc" } }, { position: "asc" }],
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.publishedTitle,
    position: c.position,
    volumeId: c.volumeId,
    volumeTitle: c.volume.title,
    volumePosition: c.volume.position,
    accessType: c.accessType,
    priceMinor: c.priceMinor,
    wordCount: c.publishedWordCount,
    publishedAt: c.firstPublishedAt,
  }));
});
export async function getBookComments(bookId: string) {
  const rows = await getDb().comment.findMany({
    where: { bookId, hidden: false },
    select: {
      id: true,
      body: true,
      spoiler: true,
      createdAt: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows.map(({ user, ...comment }) => ({ ...comment, name: user.name }));
}
export async function getMyBookState(userId: string, bookId: string) {
  const [saved, rating] = await Promise.all([
    getDb().libraryEntry.findUnique({
      where: { userId_bookId: { userId, bookId } },
      select: { id: true },
    }),
    getDb().rating.findUnique({
      where: { userId_bookId: { userId, bookId } },
      select: { score: true },
    }),
  ]);
  return { saved: !!saved, score: rating?.score ?? 0 };
}
export async function getLibrary(userId: string) {
  return getDb().$queryRaw<CatalogBook[]>(Prisma.sql`
    SELECT ${catalogColumns} FROM library_entries l JOIN books b ON b.id = l.book_id
    JOIN "user" u ON u.id = b.author_id
    WHERE l.user_id = ${userId} AND b.status = 'PUBLISHED' AND NOT b.hidden
    ORDER BY l.created_at DESC
  `);
}
