import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { books } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { BookCover } from "@/components/book-cover";
import { ChevronRight, Feather, Plus } from "@/components/icons";
const labels = {
  DRAFT: "Taslak",
  APPROVED: "Yayın onaylandı",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşivlendi",
};
export default async function Studio() {
  const actor = await requireUser();
  const myBooks = await getDb()
    .select({
      book: books,
      count: sql<number>`(select count(*)::int from chapters c where c.book_id = ${books.id})`,
    })
    .from(books)
    .where(eq(books.authorId, actor.id))
    .orderBy(desc(books.updatedAt));
  return (
    <>
      <div className="studio-heading">
        <div>
          <div className="eyebrow">
            <span /> KELİMELERİN BURADA HAYAT BULUR
          </div>
          <h1>
            Yazar stüdyosu<span className="accent-text">.</span>
          </h1>
          <p>Merhaba {actor.name}. Bugün hangi dünyaya bir kapı açıyoruz?</p>
        </div>
        <Link href="/studio/yeni" className="button button-dark">
          <Plus size={16} />
          Yeni kitap
        </Link>
      </div>
      {!actor.emailVerified && (
        <div className="notice" style={{ marginBottom: 20 }}>
          Yazmaya başlamak için e-posta adresini doğrulamalısın.
        </div>
      )}
      {myBooks.length ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Hikâyelerin</span>
              <strong>{myBooks.length}</strong>
            </div>
            <div className="stat-card">
              <span>Yayımlanan kitap</span>
              <strong>
                {myBooks.filter((b) => b.book.status === "PUBLISHED").length}
              </strong>
            </div>
            <div className="stat-card">
              <span>Yazılan bölüm</span>
              <strong>{myBooks.reduce((n, b) => n + b.count, 0)}</strong>
            </div>
          </div>
          <div className="stack">
            {myBooks.map(({ book, count }) => (
              <Link
                href={`/studio/books/${book.id}`}
                className="studio-book"
                key={book.id}
              >
                <BookCover
                  title={book.title}
                  author={actor.name}
                  cover={book.cover}
                />
                <div className="studio-book-info">
                  <span className="label-pill">{labels[book.status]}</span>
                  <h2>{book.title}</h2>
                  <p>
                    {book.genre} · {count} bölüm
                    {book.premiumStatus === "ACTIVE" ? " · Premium" : ""}
                  </p>
                </div>
                <ChevronRight size={19} />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Feather size={38} strokeWidth={1.4} />
          <h2>Büyük dünyalar, küçük bir satırla başlar.</h2>
          <p>
            Kitabını oluştur, ciltlerini planla ve ilk bölümünü yaz. Hazır
            olduğunda yayın başvurunu buradan gönderebilirsin.
          </p>
          <Link href="/studio/yeni" className="button button-dark">
            <Plus size={16} />
            İlk kitabımı oluştur
          </Link>
        </div>
      )}
    </>
  );
}
