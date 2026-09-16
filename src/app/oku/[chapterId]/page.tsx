import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { books, chapters, user } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { canReadPublic } from "@/modules/publishing/policies";
import { getPublicChapters } from "@/modules/catalog/queries";
import { Reader } from "@/components/reader";
export const metadata = {
  title: "Okuma zamanı",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function ReadChapter({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;
  const db = getDb();
  // First query contains no body. Authorization must precede fetching content.
  const [entry] = await db
    .select({
      chapter: {
        id: chapters.id,
        title: chapters.publishedTitle,
        bookId: chapters.bookId,
        status: chapters.status,
        hidden: chapters.hidden,
        accessType: chapters.accessType,
        price: chapters.priceMinor,
        wordCount: chapters.publishedWordCount,
      },
      book: {
        id: books.id,
        title: books.title,
        slug: books.slug,
        status: books.status,
        hidden: books.hidden,
      },
      author: user.name,
    })
    .from(chapters)
    .innerJoin(books, eq(books.id, chapters.bookId))
    .innerJoin(user, eq(user.id, books.authorId))
    .where(eq(chapters.id, chapterId));
  if (
    !entry ||
    entry.book.hidden ||
    entry.book.status !== "PUBLISHED" ||
    entry.chapter.hidden ||
    entry.chapter.status !== "PUBLISHED"
  )
    notFound();
  const [allChapters, actor, cookieStore] = await Promise.all([
    getPublicChapters(entry.book.id),
    getCurrentUser(),
    cookies(),
  ]);
  const index = allChapters.findIndex((c) => c.id === chapterId);
  const metadata = allChapters[index];
  if (!metadata) notFound();
  let content = null;
  if (canReadPublic(entry.book, entry.chapter)) {
    const [body] = await db
      .select({ content: chapters.publishedContent })
      .from(chapters)
      .innerJoin(books, eq(books.id, chapters.bookId))
      .where(
        and(
          eq(chapters.id, chapterId),
          eq(chapters.accessType, "FREE"),
          eq(chapters.status, "PUBLISHED"),
          eq(chapters.hidden, false),
          eq(books.status, "PUBLISHED"),
          eq(books.hidden, false),
        ),
      );
    content = body?.content ?? null;
  }
  const storedTheme = cookieStore.get("reader-theme")?.value;
  const theme =
    storedTheme === "dark" || storedTheme === "sepia" ? storedTheme : "paper";
  const font = Number(cookieStore.get("reader-font")?.value || 20);
  return (
    <Reader
      bookId={entry.book.id}
      bookTitle={entry.book.title}
      bookSlug={entry.book.slug}
      title={entry.chapter.title!}
      chapterId={chapterId}
      author={entry.author}
      content={content}
      position={metadata.position}
      volumeTitle={metadata.volumeTitle}
      wordCount={entry.chapter.wordCount}
      price={entry.chapter.price}
      previous={allChapters[index - 1]?.id}
      next={allChapters[index + 1]?.id}
      loggedIn={!!actor}
      initialTheme={theme}
      initialFontSize={
        Number.isFinite(font) ? Math.max(16, Math.min(28, font)) : 20
      }
    />
  );
}
