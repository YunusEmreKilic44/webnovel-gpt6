import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  books,
  chapters,
  comments,
  libraryEntries,
  ratings,
  user,
  volumes,
} from "@/db/schema";

const bookColumns = {
  id: books.id,
  slug: books.slug,
  title: books.title,
  subtitle: books.subtitle,
  description: books.description,
  genre: books.genre,
  cover: books.cover,
  status: books.status,
  storyStatus: books.storyStatus,
  premiumStatus: books.premiumStatus,
  authorId: books.authorId,
  author: user.name,
  featured: books.featured,
  updatedAt: books.updatedAt,
  chapterCount: sql<number>`(select count(*)::int from chapters c where c.book_id = ${books.id} and c.status = 'PUBLISHED' and c.hidden = false)`,
  volumeCount: sql<number>`(select count(distinct c.volume_id)::int from chapters c where c.book_id = ${books.id} and c.status = 'PUBLISHED' and c.hidden = false)`,
  averageRating: sql<number>`coalesce((select round(avg(r.score), 1)::float from ratings r where r.book_id = ${books.id}), 0)`,
  ratingCount: sql<number>`(select count(*)::int from ratings r where r.book_id = ${books.id})`,
};
export async function getCatalog(
  filters: {
    q?: string;
    genre?: string;
    completed?: boolean;
    sort?: string;
  } = {},
) {
  const escaped = filters.q
    ?.trim()
    .replace(/[\\%_]/g, "\\$&")
    .slice(0, 100);
  return getDb()
    .select(bookColumns)
    .from(books)
    .innerJoin(user, eq(user.id, books.authorId))
    .where(
      and(
        eq(books.status, "PUBLISHED"),
        eq(books.hidden, false),
        filters.genre && filters.genre !== "Tümü"
          ? eq(books.genre, filters.genre)
          : undefined,
        escaped
          ? or(
              ilike(books.title, `%${escaped}%`),
              ilike(user.name, `%${escaped}%`),
            )
          : undefined,
        filters.completed ? eq(books.storyStatus, "COMPLETED") : undefined,
      ),
    )
    .orderBy(
      filters.sort === "rating"
        ? desc(bookColumns.averageRating)
        : desc(books.featured),
      desc(books.updatedAt),
      books.id,
    )
    .limit(60);
}
export type CatalogBook = Awaited<ReturnType<typeof getCatalog>>[number];
export async function getPublicBook(slug: string) {
  const [book] = await getDb()
    .select(bookColumns)
    .from(books)
    .innerJoin(user, eq(user.id, books.authorId))
    .where(
      and(
        eq(books.slug, slug),
        eq(books.status, "PUBLISHED"),
        eq(books.hidden, false),
      ),
    );
  return book;
}
export async function getPublicChapters(bookId: string) {
  return getDb()
    .select({
      id: chapters.id,
      title: chapters.publishedTitle,
      position: chapters.position,
      volumeId: volumes.id,
      volumeTitle: volumes.title,
      volumePosition: volumes.position,
      accessType: chapters.accessType,
      priceMinor: chapters.priceMinor,
      wordCount: chapters.publishedWordCount,
      publishedAt: chapters.firstPublishedAt,
    })
    .from(chapters)
    .innerJoin(volumes, eq(volumes.id, chapters.volumeId))
    .where(
      and(
        eq(chapters.bookId, bookId),
        eq(chapters.status, "PUBLISHED"),
        eq(chapters.hidden, false),
      ),
    )
    .orderBy(volumes.position, chapters.position);
}
export async function getBookComments(bookId: string) {
  return getDb()
    .select({
      id: comments.id,
      body: comments.body,
      spoiler: comments.spoiler,
      createdAt: comments.createdAt,
      name: user.name,
    })
    .from(comments)
    .innerJoin(user, eq(user.id, comments.userId))
    .where(and(eq(comments.bookId, bookId), eq(comments.hidden, false)))
    .orderBy(desc(comments.createdAt))
    .limit(30);
}
export async function getMyBookState(userId: string, bookId: string) {
  const [saved, rating] = await Promise.all([
    getDb()
      .select({ id: libraryEntries.id })
      .from(libraryEntries)
      .where(
        and(
          eq(libraryEntries.userId, userId),
          eq(libraryEntries.bookId, bookId),
        ),
      ),
    getDb()
      .select({ score: ratings.score })
      .from(ratings)
      .where(and(eq(ratings.userId, userId), eq(ratings.bookId, bookId))),
  ]);
  return { saved: saved.length > 0, score: rating[0]?.score ?? 0 };
}
export async function getLibrary(userId: string) {
  return getDb()
    .select(bookColumns)
    .from(libraryEntries)
    .innerJoin(books, eq(books.id, libraryEntries.bookId))
    .innerJoin(user, eq(user.id, books.authorId))
    .where(
      and(
        eq(libraryEntries.userId, userId),
        eq(books.status, "PUBLISHED"),
        eq(books.hidden, false),
      ),
    )
    .orderBy(desc(libraryEntries.createdAt));
}
