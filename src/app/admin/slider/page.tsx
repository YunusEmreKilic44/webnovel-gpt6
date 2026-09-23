import { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin-ui";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { SlideForm, DeleteContentForm } from "@/components/site-content-forms";
import { getAdminSlides } from "@/modules/site-content/queries";

export const metadata = { title: "Slider yönetimi" };
export default function Page() {
  return (
    <Suspense fallback={<BlockSkeleton label="Slaytlar yükleniyor" />}>
      <Slides />
    </Suspense>
  );
}
async function Slides() {
  const rows = await getAdminSlides();
  return (
    <>
      <AdminHeading
        title="Ana sayfa sliderı"
        description="Görselleri, başlıkları ve bağlantıları düzenle. Yayındaki slaytlar sıra numarasına göre gösterilir. Yayında slayt yoksa haftanın hikâyesi görünür."
      />
      <p className="content-page-link">
        <Link className="text-link" href="/">
          Ana sayfayı görüntüle →
        </Link>
      </p>
      <div className="stack">
        <details className="panel content-editor" open={rows.length === 0}>
          <summary>Yeni slayt ekle</summary>
          <SlideForm />
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
            <SlideForm item={item} />
            <DeleteContentForm kind="slide" id={item.id} />
          </details>
        ))}
      </div>
    </>
  );
}
