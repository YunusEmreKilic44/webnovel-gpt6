import { Suspense } from "react";
import {
  BlockSkeleton,
  BookGridSkeleton,
} from "@/components/loading-skeletons";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getLibrary } from "@/modules/catalog/queries";
import { getDb } from "@/db";
import { BookCard } from "@/components/book-card";
import { ArrowRight, Library } from "@/components/icons";
export const metadata = { title: "Kütüphanem", robots: { index: false } };
export default function MyLibrary() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> SANA AİT BİR KÖŞE
          </div>
          <h1>
            Kütüphanem<span className="accent-text">.</span>
          </h1>
          <p>Biriktirdiğin dünyalar, dönüp geldiğin hikâyeler.</p>
        </div>
      </div>
      <Suspense
        fallback={
          <BlockSkeleton label="Okuma ilerlemesi yükleniyor" rows={2} />
        }
      >
        <ReadingProgress />
      </Suspense>
      <Suspense fallback={<BookGridSkeleton />}>
        <SavedBooks />
      </Suspense>
    </>
  );
}

async function ReadingProgress() {
  const actor = await requireUser();
  const progress = await getDb().readingProgress.findMany({
    where: {
      userId: actor.id,
      book: { status: "PUBLISHED", hidden: false },
      chapter: { status: "PUBLISHED", hidden: false },
    },
    select: { chapterId: true, book: { select: { title: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <>
      {progress.length > 0 && (
        <section className="stack" style={{ marginBottom: 30 }}>
          {progress.map((p) => (
            <Link
              className="panel button-row"
              href={`/oku/${p.chapterId}`}
              key={p.chapterId}
            >
              <span>{p.book.title} · Okumaya devam et</span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
async function SavedBooks() {
  const actor = await requireUser();
  const saved = await getLibrary(actor.id);
  return (
    <>
      {saved.length ? (
        <div className="book-grid">
          {saved.map((book) => (
            <BookCard book={book} key={book.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Library size={35} />
          <h2>Rafların yeni hikâyeleri bekliyor.</h2>
          <p>
            Sevdiğin bir kitabın sayfasında “Kütüphaneme ekle” düğmesine dokun.
            Hepsini burada bulacaksın.
          </p>
          <Link href="/kesfet" className="button button-dark">
            Bir hikâye bul <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </>
  );
}
