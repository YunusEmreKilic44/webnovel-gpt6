import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight } from "@/components/icons";
import { PageSkeleton } from "@/components/loading-skeletons";
import { PublicChapterList } from "@/components/public-chapter-list";
import {
  CHAPTER_PAGE_SIZE,
  getPublicBook,
  getPublicChapters,
} from "@/modules/catalog/queries";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sayfa?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const book = await getPublicBook((await params).slug);
  return { title: book ? `${book.title} — Tüm bölümler` : "Kitap bulunamadı" };
}

async function ChaptersPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const book = await getPublicBook(slug);
  if (!book) notFound();

  const rawPage = query.sayfa ?? "1";
  if (typeof rawPage !== "string" || !/^[1-9]\d*$/.test(rawPage)) notFound();
  const page = Number(rawPage);
  const totalPages = Math.max(
    1,
    Math.ceil(book.chapterCount / CHAPTER_PAGE_SIZE),
  );
  if (!Number.isSafeInteger(page) || page > totalPages) notFound();

  const offset = (page - 1) * CHAPTER_PAGE_SIZE;
  const chapters = await getPublicChapters(book.id, CHAPTER_PAGE_SIZE, offset);
  const basePath = `/kitap/${book.slug}/bolumler`;
  const pageLink = (value: number) =>
    value === 1 ? basePath : `${basePath}?sayfa=${value}`;

  return (
    <div className="book-chapters-page">
      <nav className="breadcrumbs" aria-label="Sayfa yolu">
        <Link href={`/kitap/${book.slug}`}>{book.title}</Link>
        <ChevronRight size={12} />
        <span>Tüm bölümler</span>
      </nav>
      <div className="page-heading">
        <div>
          <h1>{book.title}</h1>
          <p>
            Tüm bölümler · {book.chapterCount.toLocaleString("tr-TR")} bölüm
          </p>
        </div>
        <Link href={`/kitap/${book.slug}`} className="button button-outline">
          <ArrowLeft size={15} /> Kitaba dön
        </Link>
      </div>
      {chapters.length > 0 && (
        <p className="catalog-count">
          {offset + 1}–{offset + chapters.length} arası bölümler gösteriliyor.
        </p>
      )}
      <PublicChapterList chapters={chapters} />
      {totalPages > 1 && (
        <nav className="chapter-pagination" aria-label="Bölüm sayfaları">
          {page > 1 && (
            <Link
              href={pageLink(page - 1)}
              className="button button-outline"
              rel="prev"
            >
              <ArrowLeft size={15} /> Önceki sayfa
            </Link>
          )}
          <span aria-current="page">
            Sayfa {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageLink(page + 1)}
              className="button button-outline"
              rel="next"
            >
              Sonraki sayfa <ArrowRight size={15} />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChaptersPage {...props} />
    </Suspense>
  );
}
