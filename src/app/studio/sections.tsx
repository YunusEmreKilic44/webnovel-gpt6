import Link from "next/link";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { BookCover } from "@/components/book-cover";
import { ChevronRight, Feather, Plus } from "@/components/icons";
const labels: Record<string, string> = {
  DRAFT: "Taslak",
  APPROVED: "Yayın onaylandı",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşivlendi",
};

export async function StudioGreeting() {
  const actor = await requireUser();
  return <p>Merhaba {actor.name}. Bugün hangi dünyaya bir kapı açıyoruz?</p>;
}

export async function StudioBooks() {
  const actor = await requireUser();
  const rows = await getDb().book.findMany({
    where: { authorId: actor.id },
    select: {
      id: true,
      title: true,
      cover: true,
      genre: true,
      status: true,
      premiumStatus: true,
      _count: { select: { chapters: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const myBooks = rows.map(({ _count, ...book }) => ({
    book,
    count: _count.chapters,
  }));
  return (
    <>
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
