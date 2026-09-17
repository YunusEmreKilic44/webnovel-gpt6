import type { JSONContent } from "@tiptap/react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/db";
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
  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    select: {
      id: true,
      publishedTitle: true,
      bookId: true,
      status: true,
      hidden: true,
      accessType: true,
      priceMinor: true,
      publishedWordCount: true,
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          hidden: true,
          author: { select: { name: true } },
        },
      },
    },
  });
  const entry = chapter
    ? {
        chapter: {
          ...chapter,
          title: chapter.publishedTitle,
          price: chapter.priceMinor,
          wordCount: chapter.publishedWordCount,
        },
        book: chapter.book,
        author: chapter.book.author.name,
      }
    : null;
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
    const body = await db.chapter.findFirst({
      where: {
        id: chapterId,
        accessType: "FREE",
        status: "PUBLISHED",
        hidden: false,
        book: { status: "PUBLISHED", hidden: false },
      },
      select: { publishedContent: true },
    });
    content = (body?.publishedContent as JSONContent | null) ?? null;
  }
  const storedTheme = cookieStore.get("reader-theme")?.value;
  const theme =
    storedTheme === "paper" || storedTheme === "sepia" ? storedTheme : "dark";
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
