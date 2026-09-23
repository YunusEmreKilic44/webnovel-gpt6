import Link from "next/link";
import { Suspense } from "react";
import { BlockSkeleton } from "@/components/loading-skeletons";
import {
  AdminHeading,
  AdminEmpty,
  auditLabels,
  fullDate,
} from "@/components/admin-ui";
import { getAdminOverview } from "@/modules/admin/queries";
import { ArrowRight } from "@/components/icons";

export default function AdminPage() {
  return (
    <Suspense
      fallback={<BlockSkeleton label="Yönetim özeti yükleniyor" rows={8} />}
    >
      <Overview />
    </Suspense>
  );
}
async function Overview() {
  const stats = await getAdminOverview();
  const cards = [
    { title: "Kullanıcılar", value: stats.users, href: "/admin/kullanicilar" },
    { title: "Kitaplar", value: stats.books, href: "/admin/kitaplar" },
    {
      title: "Yayındaki kitap",
      value: stats.published,
      href: "/admin/kitaplar?filter=PUBLISHED",
    },
    {
      title: "Bekleyen başvuru",
      value: stats.pending,
      href: "/admin/basvurular?filter=PENDING",
    },
    {
      title: "Gizlenen yorum",
      value: stats.hiddenComments,
      href: "/admin/yorumlar?filter=hidden",
    },
    {
      title: "Toplam bölüm okunması",
      value: stats.reads,
      href: "/admin/kitaplar",
    },
  ];
  return (
    <>
      <AdminHeading
        title="Genel bakış"
        description="Platformdaki hareketleri takip et, bekleyen işlemlere buradan ulaş."
      />
      <div className="admin-stat-grid">
        {cards.map((card) => (
          <Link className="admin-stat-card" href={card.href} key={card.title}>
            <span>{card.title}</span>
            <strong>{card.value.toLocaleString("tr-TR")}</strong>
            <ArrowRight size={16} />
          </Link>
        ))}
      </div>
      <section className="panel admin-callout">
        <div>
          <h2>
            {stats.pending
              ? `${stats.pending} başvuru inceleme bekliyor.`
              : "Başvuru kuyruğu güncel."}
          </h2>
          <p>Yayın ve premium kararlarını gerekçeleriyle kaydet.</p>
        </div>
        <Link
          className="button button-dark"
          href="/admin/basvurular?filter=PENDING"
        >
          Başvurulara git
          <ArrowRight size={15} />
        </Link>
      </section>
      <section className="panel">
        <div className="analytics-section-heading">
          <h2>Son işlemler</h2>
          <Link className="text-link" href="/admin/islem-kaydi">
            Tümünü gör
            <ArrowRight size={14} />
          </Link>
        </div>
        {stats.recent.length ? (
          <ul className="admin-activity">
            {stats.recent.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{auditLabels[entry.action] ?? entry.action}</strong>
                  <span>{entry.actor.name}</span>
                </div>
                <time dateTime={entry.createdAt.toISOString()}>
                  {fullDate(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <AdminEmpty text="Henüz kaydedilmiş işlem yok." />
        )}
      </section>
    </>
  );
}
