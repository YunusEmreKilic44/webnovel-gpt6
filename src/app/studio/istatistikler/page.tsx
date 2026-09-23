import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen } from "@/components/icons";
import { PageSkeleton } from "@/components/loading-skeletons";
import {
  getAuthorBookStats,
  getAuthorChapterStats,
} from "@/modules/analytics/queries";
import { date } from "@/lib/utils";

export const metadata = { title: "Yazar paneli · İstatistikler" };
const number = (value: number) => value.toLocaleString("tr-TR");
const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  APPROVED: "Yayın onaylandı",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşivlendi",
};
type Props = { searchParams: Promise<{ bookId?: string | string[] }> };

export default function AuthorDashboard(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard {...props} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Props) {
  const [books, params] = await Promise.all([
    getAuthorBookStats(),
    searchParams,
  ]);
  if (Array.isArray(params.bookId)) notFound();
  const selectedBook = params.bookId
    ? books.find((book) => book.id === params.bookId)
    : undefined;
  if (params.bookId && !selectedBook) notFound();
  const shownBooks = selectedBook ? [selectedBook] : books;
  const totals = shownBooks.reduce(
    (sum, book) => ({
      reads: sum.reads + book.readCount,
      recent: sum.recent + book.recentReadCount,
      library: sum.library + book.libraryCount,
      comments: sum.comments + book.commentCount,
      ratings: sum.ratings + book.ratingCount,
      published: sum.published + book.publishedCount,
    }),
    { reads: 0, recent: 0, library: 0, comments: 0, ratings: 0, published: 0 },
  );
  return (
    <>
      <Link href="/studio" className="breadcrumbs">
        <ArrowLeft size={13} />
        Yazar stüdyosu
      </Link>
      <div className="studio-heading">
        <div>
          <div className="eyebrow">
            <span /> HİKÂYELERİNİN OKURLARDAKİ KARŞILIĞI
          </div>
          <h1>
            Yazar paneli<span className="accent-text">.</span>
          </h1>
          <p>Kitaplarının ve bölümlerinin istatistiklerini takip et.</p>
        </div>
        <Link href="/studio" className="button button-outline">
          <BookOpen size={16} />
          Kitaplarımı yönet
        </Link>
      </div>
      {!books.length ? (
        <div className="empty-state">
          <BookOpen size={38} />
          <h2>Hikâyenin ilk okurunu bekliyoruz.</h2>
          <p>
            İlk kitabını oluşturduğunda istatistiklerini burada görebilirsin.
          </p>
          <Link href="/studio/yeni" className="button button-dark">
            İlk kitabımı oluştur
          </Link>
        </div>
      ) : (
        <>
          <Form action="/studio/istatistikler" className="analytics-filter">
            <label className="field" htmlFor="analytics-book">
              Kitap
              <select
                id="analytics-book"
                name="bookId"
                defaultValue={selectedBook?.id ?? ""}
                key={selectedBook?.id ?? "all"}
              >
                <option value="">Tüm kitaplarım</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button button-outline">
              İstatistikleri göster
            </button>
          </Form>
          <div className="stat-grid analytics-stat-grid">
            {[
              ["Toplam okunma", totals.reads],
              ["Son 7 gün okunma", totals.recent],
              ["Kütüphaneye eklenme", totals.library],
              ["Görünür yorum", totals.comments],
              ["Değerlendirme", totals.ratings],
              ["Yayımlanan bölüm", totals.published],
            ].map(([label, value]) => (
              <div className="stat-card" key={label}>
                <span>{label}</span>
                <strong>{number(Number(value))}</strong>
              </div>
            ))}
          </div>
          <p className="analytics-note">
            Okunma, bölümlerin toplam açılma sayısıdır; tekil okur veya kitabın
            bitirilme sayısı değildir. Aynı hesap ya da misafir tarayıcı için
            bir bölüm UTC gününde bir kez sayılır. Kendi hesabınla yaptığın
            okumalar ve kilitli bölümler sayılmaz. Sayaçlar bu özellik devreye
            alındıktan sonraki okumaları kapsar.
          </p>
          <section className="panel analytics-panel">
            <h2>
              {selectedBook ? selectedBook.title : "Kitap istatistikleri"}
            </h2>
            <div
              className="analytics-table-scroll"
              role="region"
              aria-label="Kitap istatistikleri tablosu"
              tabIndex={0}
            >
              <table className="analytics-table">
                <caption className="sr-only">
                  Kitapların okunma ve etkileşim istatistikleri
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Kitap</th>
                    <th scope="col">Okunma</th>
                    <th scope="col">Son 7 gün</th>
                    <th scope="col">Kütüphane</th>
                    <th scope="col">Yorum</th>
                    <th scope="col">Puan</th>
                    <th scope="col">Bölüm</th>
                  </tr>
                </thead>
                <tbody>
                  {shownBooks.map((book) => (
                    <tr key={book.id}>
                      <th scope="row">
                        <Link
                          className="text-link"
                          href={`/studio/istatistikler?bookId=${encodeURIComponent(book.id)}`}
                        >
                          {book.title}
                          <ArrowUpRight size={14} />
                        </Link>
                        <small>
                          {book.hidden
                            ? "Gizli"
                            : (statusLabels[book.status] ?? book.status)}
                        </small>
                      </th>
                      <td>{number(book.readCount)}</td>
                      <td>{number(book.recentReadCount)}</td>
                      <td>{number(book.libraryCount)}</td>
                      <td>{number(book.commentCount)}</td>
                      <td>
                        {book.ratingCount
                          ? `${number(book.averageRating)} / 5`
                          : "Henüz yok"}
                        <small>{number(book.ratingCount)} değerlendirme</small>
                      </td>
                      <td>
                        {number(book.publishedCount)} /{" "}
                        {number(book.chapterCount)}
                        <small>yayında / toplam</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {selectedBook ? (
            <Suspense fallback={<p>Bölüm istatistikleri yükleniyor…</p>}>
              <ChapterStatistics bookId={selectedBook.id} />
            </Suspense>
          ) : (
            <p className="analytics-note">
              Bölüm bazında okunmaları görmek için bir kitabın adına tıkla.
            </p>
          )}
        </>
      )}
    </>
  );
}

async function ChapterStatistics({ bookId }: { bookId: string }) {
  const chapters = await getAuthorChapterStats(bookId);
  return (
    <section className="panel analytics-panel">
      <div className="analytics-section-heading">
        <h2>Bölüm istatistikleri</h2>
        <Link className="text-link" href={`/studio/books/${bookId}`}>
          Bölümleri yönet
          <ArrowUpRight size={14} />
        </Link>
      </div>
      {!chapters.length ? (
        <p>Bu kitapta henüz bölüm yok.</p>
      ) : (
        <div
          className="analytics-table-scroll"
          role="region"
          aria-label="Bölüm istatistikleri tablosu"
          tabIndex={0}
        >
          <table className="analytics-table">
            <caption className="sr-only">
              Her bölümün toplam okunması ve yayın durumu
            </caption>
            <thead>
              <tr>
                <th scope="col">Bölüm</th>
                <th scope="col">Durum</th>
                <th scope="col">İlk yayın</th>
                <th scope="col">Okunma</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((chapter) => (
                <tr key={chapter.id}>
                  <th scope="row">
                    <Link
                      className="text-link"
                      href={`/studio/books/${bookId}/chapters/${chapter.id}`}
                    >
                      {chapter.position}. {chapter.title}
                    </Link>
                    <small>
                      Cilt {chapter.volume.position} · {chapter.volume.title}
                    </small>
                  </th>
                  <td>
                    <span className="label-pill gray">
                      {chapter.hidden
                        ? "Gizli"
                        : (statusLabels[chapter.status] ?? chapter.status)}
                    </span>
                  </td>
                  <td>
                    {chapter.firstPublishedAt
                      ? date(chapter.firstPublishedAt)
                      : "Henüz yayımlanmadı"}
                  </td>
                  <td>{number(chapter._count.reads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
