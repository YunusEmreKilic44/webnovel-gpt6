import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getDb } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import type { Book } from "@/db/schema";
import { tagKey } from "@/lib/tags";

// Every published-catalog read shares this tag, so a single revalidateTag call
// after a publish, a rating or a comment refreshes all of them at once.
export const CATALOG_TAG = "catalog";
const CATALOG_REVALIDATE = 60;

// unstable_cache reads Next.js' incremental cache, which only exists inside the
// server runtime. Vitest suites and scripts import these queries directly, so
// outside the runtime they run the plain query instead of throwing.
const insideNextServer = Boolean(process.env.NEXT_RUNTIME);

function catalogCache<Args extends unknown[], Result>(
  key: string,
  query: (...args: Args) => Promise<Result>,
) {
  const cached = unstable_cache(query, [key], {
    tags: [CATALOG_TAG],
    revalidate: CATALOG_REVALIDATE,
  });
  return (...args: Args) =>
    insideNextServer ? cached(...args) : query(...args);
}

export type CatalogBook = Pick<
  Book,
  | "id"
  | "slug"
  | "title"
  | "subtitle"
  | "description"
  | "genres"
  | "cover"
  | "coverUrl"
  | "status"
  | "storyStatus"
  | "premiumStatus"
  | "authorId"
  | "featured"
  | "updatedAt"
> & {
  tags: string[];
  author: string;
  authorSlug: string;
  authorAvatarUrl: string | null;
  chapterCount: number;
  volumeCount: number;
  averageRating: number;
  ratingCount: number;
};

// unstable_cache round-trips its result through JSON, which would hand back a
// string on a cache hit and a Date on a miss. Timestamps are stored as numbers
// so both paths return the same shape.
type StoredBook = Omit<CatalogBook, "updatedAt"> & { updatedAt: number };
const storeBook = ({ updatedAt, ...book }: CatalogBook): StoredBook => ({
  ...book,
  updatedAt: updatedAt.getTime(),
});
const readBook = ({ updatedAt, ...book }: StoredBook): CatalogBook => ({
  ...book,
  updatedAt: new Date(updatedAt),
});

const catalogColumns = Prisma.sql`
  b.id, b.slug, b.title, b.subtitle, b.description, b.genres, b.cover,
  ARRAY(SELECT t.name FROM book_tags bt JOIN tags t ON t.key = bt.tag_key
        WHERE bt.book_id = b.id ORDER BY t.key) AS tags,
  b.cover_url AS "coverUrl", b.status,
  b.story_status AS "storyStatus", b.premium_status AS "premiumStatus",
  b.author_id AS "authorId", b.featured, b.updated_at AS "updatedAt", u.name AS author,
  u.avatar_url AS "authorAvatarUrl",
  u.slug AS "authorSlug",
  ch.chapter_count AS "chapterCount", ch.volume_count AS "volumeCount",
  rt.average_rating AS "averageRating", rt.rating_count AS "ratingCount"
`;
// One lateral pass over chapters and one over ratings, instead of a separate
// correlated subquery per counted column.
const catalogAggregates = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS chapter_count,
           count(DISTINCT c.volume_id)::int AS volume_count
    FROM chapters c
    WHERE c.book_id = b.id AND c.status = 'PUBLISHED' AND NOT c.hidden
  ) ch ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(round(avg(r.score), 1)::float, 0) AS average_rating,
           count(*)::int AS rating_count
    FROM ratings r
    WHERE r.book_id = b.id
  ) rt ON true
`;

type CatalogFilters = {
  q?: string;
  genre?: string;
  tag?: string;
  completed?: boolean;
  sort?: string;
  limit?: number;
};

async function queryCatalog(filters: CatalogFilters): Promise<StoredBook[]> {
  const limit = Math.max(1, Math.min(60, Math.trunc(filters.limit || 60)));
  const query = filters.q
    ?.trim()
    .slice(0, 100)
    .replace(/[\\%_]/g, "\\$&");
  const tagQuery = tagKey(filters.q?.trim().slice(0, 100) ?? "").replace(
    /[\\%_]/g,
    "\\$&",
  );
  const exactTag = filters.tag ? tagKey(filters.tag) : "";
  const rows = await getDb().$queryRaw<CatalogBook[]>(Prisma.sql`
    SELECT ${catalogColumns}
    FROM books b JOIN "user" u ON u.id = b.author_id ${catalogAggregates}
    WHERE b.status = 'PUBLISHED' AND NOT b.hidden
    ${filters.genre && filters.genre !== "Tümü" ? Prisma.sql`AND b.genres @> ARRAY[${filters.genre}]::text[]` : Prisma.empty}
    ${
      query
        ? Prisma.sql`AND (b.title ILIKE ${"%" + query + "%"} OR u.name ILIKE ${"%" + query + "%"}
      ${tagQuery ? Prisma.sql`OR EXISTS (SELECT 1 FROM book_tags bt WHERE bt.book_id = b.id AND bt.tag_key LIKE ${"%" + tagQuery + "%"})` : Prisma.empty})`
        : Prisma.empty
    }
    ${filters.tag ? Prisma.sql`AND EXISTS (SELECT 1 FROM book_tags bt WHERE bt.book_id = b.id AND bt.tag_key = ${exactTag})` : Prisma.empty}
    ${filters.completed ? Prisma.sql`AND b.story_status = 'COMPLETED'` : Prisma.empty}
    ORDER BY ${filters.sort === "rating" ? Prisma.sql`"averageRating" DESC,` : filters.sort === "recent" ? Prisma.empty : Prisma.sql`b.featured DESC,`}
    b.updated_at DESC, b.id LIMIT ${limit}
  `);
  return rows.map(storeBook);
}
const cachedCatalog = catalogCache("catalog-list-v5-author-slug", queryCatalog);

export async function getCatalog(filters: CatalogFilters = {}) {
  // Free-text and user-defined tag filters stay uncached: arbitrary terms grow the key space
  // without bound, and each term is typically requested once.
  const rows =
    filters.q?.trim() || filters.tag
      ? await queryCatalog(filters)
      : await cachedCatalog(filters);
  return rows.map(readBook);
}

// Published-book count per genre for the discovery filters.
async function queryGenreCounts() {
  const rows = await getDb().$queryRaw<{ genre: string; count: number }[]>`
    WITH visible_books AS (
      SELECT id, genres FROM books WHERE status = 'PUBLISHED' AND NOT hidden
    )
    SELECT genre, count(DISTINCT id)::int AS count
    FROM visible_books CROSS JOIN LATERAL unnest(genres) AS genre
    GROUP BY genre
    UNION ALL
    SELECT 'Tümü' AS genre, count(*)::int AS count FROM visible_books
  `;
  return Object.fromEntries(
    rows.map((row) => [row.genre, row.count]),
  ) as Record<string, number>;
}
export const getGenreCounts = catalogCache("genre-counts-v3", queryGenreCounts);

/** Draft, hidden and orphaned tags never appear in public discovery. */
async function queryPopularTags() {
  return getDb().$queryRaw<{ name: string; key: string; count: number }[]>`
    SELECT t.name, t.key, count(*)::int AS count
    FROM tags t JOIN book_tags bt ON bt.tag_key = t.key
    JOIN books b ON b.id = bt.book_id
    WHERE b.status = 'PUBLISHED' AND NOT b.hidden
    GROUP BY t.key, t.name ORDER BY count(*) DESC, t.key LIMIT 30
  `;
}
export const getPopularTags = catalogCache("popular-tags", queryPopularTags);

async function queryPublicBook(slug: string) {
  const rows = await getDb().$queryRaw<CatalogBook[]>(Prisma.sql`
    SELECT ${catalogColumns}
    FROM books b JOIN "user" u ON u.id = b.author_id ${catalogAggregates}
    WHERE b.slug = ${slug} AND b.status = 'PUBLISHED' AND NOT b.hidden
  `);
  return rows[0] ? storeBook(rows[0]) : null;
}
const cachedPublicBook = catalogCache(
  "public-book-v5-author-slug",
  queryPublicBook,
);

export const getPublicBook = cache(async (slug: string) => {
  const row = await cachedPublicBook(slug);
  return row ? readBook(row) : undefined;
});

// The home hero needs the first readable chapter of the book it is already
// showing. Resolving it in one statement keeps the page from waiting on a
// second round trip after the catalog query returns.
async function queryFeaturedChapterId() {
  const rows = await getDb().$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT c.id FROM chapters c JOIN volumes v ON v.id = c.volume_id
    WHERE c.book_id = (
      SELECT b.id FROM books b
      WHERE b.status = 'PUBLISHED' AND NOT b.hidden
      ORDER BY b.featured DESC, b.updated_at DESC, b.id LIMIT 1
    ) AND c.status = 'PUBLISHED' AND NOT c.hidden
    ORDER BY v.position ASC, c.position ASC LIMIT 1
  `);
  return rows[0]?.id ?? null;
}
export const getFeaturedChapterId = cache(
  catalogCache("featured-chapter", queryFeaturedChapterId),
);

export const CHAPTER_PREVIEW_SIZE = 10;
export const CHAPTER_PAGE_SIZE = 50;

async function queryPublicChapters(bookId: string, take?: number, skip = 0) {
  const rows = await getDb().chapter.findMany({
    where: {
      bookId,
      status: "PUBLISHED",
      hidden: false,
      book: { status: "PUBLISHED", hidden: false },
    },
    take,
    skip,
    select: {
      id: true,
      publishedTitle: true,
      position: true,
      volumeId: true,
      accessType: true,
      publishedWordCount: true,
      firstPublishedAt: true,
      volume: { select: { title: true, position: true } },
    },
    orderBy: [
      { volume: { position: "asc" } },
      { position: "asc" },
      { id: "asc" },
    ],
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.publishedTitle,
    position: c.position,
    volumeId: c.volumeId,
    volumeTitle: c.volume.title,
    volumePosition: c.volume.position,
    accessType: c.accessType,
    wordCount: c.publishedWordCount,
    publishedAt: c.firstPublishedAt?.getTime() ?? null,
  }));
}
const cachedPublicChapters = catalogCache(
  "public-chapters",
  queryPublicChapters,
);

export const getPublicChapters = cache(
  async (bookId: string, take?: number, skip = 0) => {
    const rows = await cachedPublicChapters(bookId, take, skip);
    return rows.map(({ publishedAt, ...chapter }) => ({
      ...chapter,
      publishedAt: publishedAt === null ? null : new Date(publishedAt),
    }));
  },
);

export const getBookComments = cache(async (bookId: string) => {
  const rows = await getDb().comment.findMany({
    where: { bookId, hidden: false },
    select: {
      id: true,
      body: true,
      spoiler: true,
      createdAt: true,
      user: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      _count: { select: { likes: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows.map(({ user, ...comment }) => ({
    ...comment,
    userId: user.id,
    userSlug: user.slug,
    name: user.name,
    avatarUrl: user.avatarUrl,
  }));
});
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
    SELECT ${catalogColumns}
    FROM library_entries l JOIN books b ON b.id = l.book_id
    JOIN "user" u ON u.id = b.author_id ${catalogAggregates}
    WHERE l.user_id = ${userId} AND b.status = 'PUBLISHED' AND NOT b.hidden
    ORDER BY l.created_at DESC
  `);
}

/**
 * Public author page: the account (never banned ones) with its published,
 * visible books and totals computed from what readers can see.
 */
export const getAuthorProfile = cache(async (slug: string) => {
  const db = getDb();
  const user = await db.user.findFirst({
    where: { slug, banned: false },
    select: {
      id: true,
      slug: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
  if (!user) return null;
  const userId = user.id;
  const [books, reads] = await Promise.all([
    db.$queryRaw<CatalogBook[]>(Prisma.sql`
      SELECT ${catalogColumns}
      FROM books b JOIN "user" u ON u.id = b.author_id ${catalogAggregates}
      WHERE b.author_id = ${userId} AND b.status = 'PUBLISHED' AND NOT b.hidden
      ORDER BY b.updated_at DESC, b.id
      LIMIT 60
    `),
    db.chapterRead.count({
      where: {
        chapter: {
          status: "PUBLISHED",
          hidden: false,
          book: { authorId: userId, status: "PUBLISHED", hidden: false },
        },
      },
    }),
  ]);
  const rated = books.filter((book) => book.ratingCount > 0);
  return {
    user,
    books,
    stats: {
      books: books.length,
      chapters: books.reduce((sum, book) => sum + book.chapterCount, 0),
      reads,
      rating: rated.length
        ? rated.reduce((sum, book) => sum + book.averageRating, 0) /
          rated.length
        : 0,
    },
  };
});
