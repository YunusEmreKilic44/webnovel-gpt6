import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLibrary } from "@/modules/catalog/queries";
import { getDb } from "@/db";
import { books, readingProgress } from "@/db/schema";
import { BookCard } from "@/components/book-card";
import { ArrowRight, Library } from "@/components/icons";
export const metadata = { title: "Kütüphanem", robots: { index: false } };
export default async function MyLibrary() {
  const actor = await requireUser();
  const [saved, progress] = await Promise.all([
    getLibrary(actor.id),
    getDb()
      .select({ title: books.title, chapterId: readingProgress.chapterId })
      .from(readingProgress)
      .innerJoin(books, eq(books.id, readingProgress.bookId))
      .where(
        and(
          eq(readingProgress.userId, actor.id),
          eq(books.status, "PUBLISHED"),
          eq(books.hidden, false),
        ),
      ),
  ]);
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
      {progress.length > 0 && (
        <section className="stack" style={{ marginBottom: 30 }}>
          {progress.map((p) => (
            <Link
              className="panel button-row"
              href={`/oku/${p.chapterId}`}
              key={p.chapterId}
            >
              <span>{p.title} · Okumaya devam et</span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
      )}
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
