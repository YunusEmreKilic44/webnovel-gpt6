import { Suspense } from "react";
import Link from "next/link";
import { BlockSkeleton } from "@/components/loading-skeletons";
import {
  AdminHeading,
  AdminFilter,
  AdminPagination,
  AdminTable,
  AdminEmpty,
  statusLabels,
} from "@/components/admin-ui";
import {
  adminFilters,
  getAdminBooks,
  type SearchParams,
} from "@/modules/admin/queries";

export const metadata = { title: "Kitap yönetimi" };
export default function BooksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<BlockSkeleton label="Kitaplar yükleniyor" rows={8} />}>
      <Books searchParams={searchParams} />
    </Suspense>
  );
}
async function Books({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = adminFilters(await searchParams);
  const { rows, total } = await getAdminBooks(filters);
  return (
    <>
      <AdminHeading
        title="Kitaplar"
        description="Kataloğu, kitap bilgilerini, bölümleri ve görünürlüğü yönet."
      />
      <AdminFilter
        path="/admin/kitaplar"
        filters={filters}
        placeholder="Kitap veya yazar adı"
        options={[
          ["PUBLISHED", "Yayında"],
          ["DRAFT", "Taslak"],
          ["APPROVED", "Onaylandı"],
          ["ARCHIVED", "Arşivlendi"],
          ["hidden", "Gizli"],
          ["featured", "Vitrinde"],
        ]}
      />
      {rows.length ? (
        <AdminTable label="Kitap listesi">
          <thead>
            <tr>
              <th scope="col">Kitap</th>
              <th scope="col">Yazar</th>
              <th scope="col">Durum</th>
              <th scope="col">Görünürlük</th>
              <th scope="col">Bölüm / Yorum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((book) => (
              <tr key={book.id}>
                <th scope="row">
                  <Link
                    className="text-link"
                    href={`/admin/kitaplar/${book.id}`}
                  >
                    {book.title}
                  </Link>
                  <small>
                    {book.genre}
                    {book.featured ? " · Vitrinde" : ""}
                  </small>
                </th>
                <td>
                  <Link href={`/admin/kullanicilar/${book.author.id}`}>
                    {book.author.name}
                  </Link>
                </td>
                <td>{statusLabels[book.status]}</td>
                <td>
                  <span
                    className={`label-pill ${book.hidden ? "amber" : "gray"}`}
                  >
                    {book.hidden ? "Gizli" : "Gizlenmemiş"}
                  </span>
                </td>
                <td>
                  {book._count.chapters} / {book._count.comments}
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      ) : (
        <AdminEmpty />
      )}
      <AdminPagination path="/admin/kitaplar" filters={filters} total={total} />
    </>
  );
}
