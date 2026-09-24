import { Suspense } from "react";
import Link from "next/link";
import { BlockSkeleton } from "@/components/loading-skeletons";
import {
  AdminHeading,
  AdminFilter,
  AdminPagination,
  AdminEmpty,
  auditLabels,
  statusLabels,
  fullDate,
} from "@/components/admin-ui";
import {
  adminFilters,
  getAdminAudit,
  type SearchParams,
} from "@/modules/admin/queries";

export const metadata = { title: "İşlem geçmişi" };
export default function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense
      fallback={<BlockSkeleton label="İşlem geçmişi yükleniyor" rows={8} />}
    >
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}
async function Audit({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = adminFilters(await searchParams);
  const { rows, total } = await getAdminAudit(filters);
  return (
    <>
      <AdminHeading
        title="İşlem geçmişi"
        description="Kim, ne zaman, hangi değişikliği yaptı? Yönetim ve yayın işlemlerinin kayıtları."
      />
      <AdminFilter
        path="/admin/islem-kaydi"
        filters={filters}
        placeholder="İşlemi yapan, kayıt kimliği veya gerekçe"
        options={Object.entries(auditLabels)}
      />
      <div className="stack">
        {rows.length ? (
          rows.map((entry) => (
            <article className="panel admin-audit" key={entry.id}>
              <div className="analytics-section-heading">
                <h2>{auditLabels[entry.action] ?? entry.action}</h2>
                <time dateTime={entry.createdAt.toISOString()}>
                  {fullDate(entry.createdAt)}
                </time>
              </div>
              <p>
                <Link
                  className="text-link"
                  href={`/admin/kullanicilar/${entry.actor.id}`}
                >
                  {entry.actor.name}
                </Link>{" "}
                · Kayıt:{" "}
                <span className="admin-record-id">{entry.targetId}</span>
              </p>
              <AuditDetail detail={entry.detail} />
            </article>
          ))
        ) : (
          <AdminEmpty />
        )}
      </div>
      <AdminPagination
        path="/admin/islem-kaydi"
        filters={filters}
        total={total}
      />
    </>
  );
}
function AuditDetail({ detail }: { detail: string }) {
  let data: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(detail);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      data = parsed as Record<string, unknown>;
  } catch {
    // Older publishing records store plain-text notes instead of JSON.
  }
  if (!data) return <p>{detail || "Ek açıklama yok."}</p>;
  const labels: Record<string, string> = {
    banned: "Banlı",
    name: "Ad",
    role: "Rol",
    title: "Başlık",
    body: "Metin",
    published: "Yayında",
    position: "Sıra",
    linkPath: "Bağlantı",
    linkLabel: "Düğme yazısı",
    imagePreset: "Hazır görsel",
    imageAlt: "Görsel açıklaması",
    imageChanged: "Görsel değişti",
    description: "Açıklama",
    genre: "Tür",
    genres: "Kategoriler",
    tags: "Etiketler",
    storyStatus: "Hikâye durumu",
    hidden: "Gizli",
    featured: "Vitrinde",
  };
  const display = (value: unknown): string =>
    typeof value === "boolean"
      ? value
        ? "Evet"
        : "Hayır"
      : typeof value === "string"
        ? (statusLabels[value] ?? value)
        : value === undefined
          ? "—"
          : String(value);
  const before =
    data.before && typeof data.before === "object"
      ? (data.before as Record<string, unknown>)
      : null;
  const after =
    data.after && typeof data.after === "object"
      ? (data.after as Record<string, unknown>)
      : null;
  return (
    <div className="admin-audit-detail">
      {typeof data.reason === "string" && <p>{data.reason}</p>}
      {typeof data.count === "number" && <p>Kapatılan oturum: {data.count}</p>}
      {typeof data.before === "boolean" && typeof data.after === "boolean" && (
        <p>
          {data.before ? "Gizli" : "Görünür"} →{" "}
          {data.after ? "Gizli" : "Görünür"}
        </p>
      )}
      {before && after && (
        <details>
          <summary className="text-link">Değişiklik ayrıntıları</summary>
          <dl>
            {Object.keys(after)
              .filter((key) => before[key] !== after[key])
              .map((key) => (
                <div key={key}>
                  <dt>{labels[key] ?? key}</dt>
                  <dd>
                    <span>{display(before[key])}</span>
                    <span aria-label="Yeni değer">→ {display(after[key])}</span>
                  </dd>
                </div>
              ))}
          </dl>
        </details>
      )}
    </div>
  );
}
