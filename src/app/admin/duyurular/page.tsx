import { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin-ui";
import { BlockSkeleton } from "@/components/loading-skeletons";
import {
  AnnouncementForm,
  DeleteContentForm,
} from "@/components/site-content-forms";
import { getAdminAnnouncements } from "@/modules/site-content/queries";

export const metadata = { title: "Duyuru yönetimi" };
export default function Page() {
  return (
    <Suspense fallback={<BlockSkeleton label="Duyurular yükleniyor" />}>
      <Announcements />
    </Suspense>
  );
}
async function Announcements() {
  const rows = await getAdminAnnouncements();
  return (
    <>
      <AdminHeading
        title="Duyurular"
        description="Duyuruları metin ve görsellerle hazırla, sırala ve yayımla. Taslaklar yalnızca burada; yayımlanan duyurular duyuru arşivinde görünür. Ana sayfada ilk üç duyuru özetlenir."
      />
      <p className="content-page-link">
        <Link className="text-link" href="/duyurular">
          Tüm duyuruları görüntüle →
        </Link>
      </p>
      <div className="stack">
        <details className="panel content-editor" open={rows.length === 0}>
          <summary>Yeni duyuru ekle</summary>
          <AnnouncementForm />
        </details>
        {rows.map((item) => (
          <details
            className="panel content-editor"
            key={`${item.id}:${item.updatedAt.getTime()}`}
          >
            <summary>
              <span>{item.title}</span>
              <span className="label-pill gray">
                {item.published ? "Yayında" : "Taslak"} · Sıra {item.position}
              </span>
            </summary>
            <AnnouncementForm item={item} />
            {item.published && (
              <Link className="text-link" href={`/duyurular/${item.id}`}>
                Duyuruyu oku →
              </Link>
            )}
            <DeleteContentForm kind="announcement" id={item.id} />
          </details>
        ))}
      </div>
    </>
  );
}
