import { Suspense } from "react";
import Link from "next/link";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { getAnnouncementArchive } from "@/modules/site-content/queries";
import { announcementExcerpt } from "@/modules/site-content/announcement-content";

export const metadata = {
  title: "Duyurular",
  description: "Satır'dan tüm duyurular ve yenilikler.",
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <div className="announcements-page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> SATIR’DAN HABERLER
          </div>
          <h1>
            Duyurular<span className="accent-text">.</span>
          </h1>
          <p>Yenilikler, gelişmeler ve topluluğumuzdan haberler.</p>
        </div>
      </header>
      <Suspense fallback={<BlockSkeleton label="Duyurular yükleniyor" />}>
        <Archive searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Archive({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const { rows, page, pages, total } = await getAnnouncementArchive(
    typeof params.page === "string" ? Number(params.page) : 1,
  );
  if (!rows.length)
    return (
      <div className="panel empty-state">
        <h2>Henüz duyuru yok</h2>
        <p>Yeni duyurular yayımlandığında burada görünecek.</p>
      </div>
    );
  return (
    <>
      <div className="stack">
        {rows.map((item) => (
          <article className="announcement-card" key={item.id}>
            <time dateTime={item.createdAt.toISOString()}>
              {item.createdAt.toLocaleDateString("tr-TR", {
                dateStyle: "long",
                timeZone: "Europe/Istanbul",
              })}
            </time>
            <h2>
              <Link href={`/duyurular/${item.id}`}>{item.title}</Link>
            </h2>
            <p>{announcementExcerpt(item.body)}</p>
            <Link className="text-link" href={`/duyurular/${item.id}`}>
              Duyuruyu oku →
            </Link>
          </article>
        ))}
      </div>
      <nav className="admin-pagination" aria-label="Duyuru sayfaları">
        <span>
          {total} duyuru · Sayfa {page} / {pages}
        </span>
        <div className="button-row">
          {page > 1 && (
            <Link
              className="button button-outline"
              href={`/duyurular?page=${page - 1}`}
            >
              Önceki
            </Link>
          )}
          {page < pages && (
            <Link
              className="button button-outline"
              href={`/duyurular?page=${page + 1}`}
            >
              Sonraki
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
