import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  AdminHeading,
  AdminTable,
  AdminEmpty,
  AdminPagination,
  ReasonField,
  VisibilityForm,
  statusLabels,
} from "@/components/admin-ui";
import {
  adminFilters,
  getAdminBook,
  getAdminChapters,
  type SearchParams,
} from "@/modules/admin/queries";
import {
  updateBookAction,
  chapterVisibilityAction,
} from "@/modules/admin/actions";
import { GenreField } from "@/components/genre-field";
import { TagField } from "@/components/tag-field";
import { BookCover } from "@/components/book-cover";

export const metadata = { title: "Kitap ayrıntıları" };
type Props = {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<SearchParams>;
};
export default function BookPage(props: Props) {
  return (
    <Suspense fallback={<BlockSkeleton label="Kitap yükleniyor" rows={8} />}>
      <BookDetail {...props} />
    </Suspense>
  );
}
async function BookDetail({ params, searchParams }: Props) {
  const { bookId } = await params;
  const filters = adminFilters(await searchParams);
  const [book, chapters] = await Promise.all([
    getAdminBook(bookId),
    getAdminChapters(bookId, filters),
  ]);
  if (!book) notFound();
  return (
    <>
      <AdminHeading
        title={book.title}
        description={`${statusLabels[book.status]} · ${statusLabels[book.premiumStatus]}`}
        back={{ href: "/admin/kitaplar", label: "Kitaplar" }}
      />
      <div className="button-row admin-book-links">
        <Link
          className="text-link"
          href={`/admin/kullanicilar/${book.author.id}`}
        >
          Yazar: {book.author.name}
        </Link>
        {book.status === "PUBLISHED" && !book.hidden && (
          <Link
            className="button button-outline button-small"
            href={`/kitap/${book.slug}`}
          >
            Kitabı sitede gör
          </Link>
        )}
      </div>
      <div className="admin-stat-grid">
        {[
          ["Okunma", book.reads.toLocaleString("tr-TR")],
          ["Kütüphaneye eklenme", book._count.libraryEntries],
          [
            "Puan",
            book.rating._count
              ? `${book.rating._avg.score?.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} / 5 (${book.rating._count})`
              : "Henüz yok",
          ],
        ].map(([label, value]) => (
          <div className="admin-stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <h2>Kitap bilgileri ve görünürlük</h2>
        <p>
          Gizlenen kitap ve bölümleri okurlar açamaz. Vitrine yalnız görünür ve
          yayındaki kitaplar eklenebilir.
        </p>
        <ActionForm
          action={updateBookAction}
          className="form-stack"
          key={`${book.title}:${book.genres.join("|")}:${book.storyStatus}:${book.hidden}:${book.featured}:${book.description}:${book.coverUrl}`}
        >
          <input type="hidden" name="id" value={book.id} />
          <div className="admin-book-cover">
            <BookCover
              title={book.title}
              author={book.author.name}
              cover={book.cover}
              coverUrl={book.coverUrl}
              sizes="120px"
            />
            <div>
              <strong>Kapak</strong>
              <p>
                {book.coverUrl
                  ? "Yazarın yüklediği görsel. Uygunsuzsa kaldırabilirsin; kitap hazır illüstrasyona döner."
                  : "Hazır illüstrasyon kullanılıyor."}
              </p>
              {book.coverUrl && (
                <label className="check-field">
                  <input type="checkbox" name="removeCoverImage" />
                  Yüklenen kapağı kaldır
                </label>
              )}
            </div>
          </div>
          <label className="field">
            Kitap adı
            <input
              name="title"
              required
              minLength={3}
              maxLength={100}
              defaultValue={book.title}
            />
          </label>
          <label className="field">
            Açıklama
            <textarea
              name="description"
              required
              minLength={30}
              maxLength={3000}
              defaultValue={book.description}
              rows={5}
            />
          </label>
          <GenreField defaultValue={book.genres} />
          <TagField key={book.tags.join("|")} defaultValue={book.tags} />
          <div className="admin-detail-grid">
            <label className="field">
              Hikâye durumu
              <select name="storyStatus" defaultValue={book.storyStatus}>
                <option value="ONGOING">Devam ediyor</option>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="HIATUS">Arada</option>
              </select>
            </label>
          </div>
          <div className="button-row">
            <label className="check-field">
              <input
                type="checkbox"
                name="hidden"
                defaultChecked={book.hidden}
              />
              Kitabı gizle
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={book.featured}
                disabled={book.status !== "PUBLISHED"}
              />
              Vitrinde göster
            </label>
          </div>
          <ReasonField />
          <SubmitButton>Kitabı güncelle</SubmitButton>
        </ActionForm>
      </section>
      <section className="panel">
        <h2>Bölümler</h2>
        <p>
          {book._count.chapters} bölüm · Taslakları görünür yapmak onları
          yayımlamaz.
        </p>
        {chapters.length ? (
          <AdminTable label="Bölüm yönetimi">
            <thead>
              <tr>
                <th scope="col">Bölüm</th>
                <th scope="col">Durum</th>
                <th scope="col">Okunma</th>
                <th scope="col">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((chapter) => (
                <tr key={chapter.id}>
                  <th scope="row">
                    <Link
                      className="text-link"
                      href={`/admin/kitaplar/${book.id}/bolumler/${chapter.id}`}
                    >
                      {chapter.position}. {chapter.title}
                    </Link>
                    <small>
                      Cilt {chapter.volume.position} · {chapter.volume.title}
                    </small>
                  </th>
                  <td>
                    {statusLabels[chapter.status]}
                    <small>
                      {chapter.hidden ? "Gizli" : "Gizlenmemiş"} ·{" "}
                      {chapter.accessType === "PAID" ? "Premium" : "Ücretsiz"}
                    </small>
                  </td>
                  <td>{chapter._count.reads.toLocaleString("tr-TR")}</td>
                  <td>
                    <VisibilityForm
                      id={chapter.id}
                      hidden={chapter.hidden}
                      action={chapterVisibilityAction}
                      noun="Bölümü"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        ) : (
          <AdminEmpty text="Bu sayfada bölüm yok." />
        )}
        <AdminPagination
          path={`/admin/kitaplar/${book.id}`}
          filters={filters}
          total={book._count.chapters}
        />
      </section>
    </>
  );
}
