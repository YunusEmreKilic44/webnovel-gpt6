import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { requireAdmin } from "@/modules/admin/access";
import {
  getAdminReports,
  reportStatuses,
  type ReportStatus,
} from "@/modules/reports/service";
import {
  reportReasons,
  reportStatusLabels,
  reportTargetLabels,
  reportTargetTypes,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports";
import {
  AdminEmpty,
  AdminHeading,
  AdminTable,
  fullDate,
} from "@/components/admin-ui";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { ChevronLeft, ChevronRight } from "@/components/icons";

export const metadata = { title: "Şikâyetler" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type ListFilters = {
  status: ReportStatus;
  type?: ReportTargetType;
  page: number;
};

function listHref(filters: ListFilters, change: Partial<ListFilters> = {}) {
  const next = { ...filters, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.status !== "OPEN") params.set("durum", next.status);
  if (next.type) params.set("tur", next.type);
  if (next.page > 1) params.set("sayfa", String(next.page));
  const query = params.toString();
  return query ? `/admin/raporlar?${query}` : "/admin/raporlar";
}

export default function ReportsPage(props: Props) {
  return (
    <Suspense
      fallback={<BlockSkeleton label="Şikâyetler yükleniyor" rows={8} />}
    >
      <Reports {...props} />
    </Suspense>
  );
}

async function Reports({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const text = (key: string) =>
    typeof params[key] === "string" ? params[key] : "";
  const filters: ListFilters = {
    status: (reportStatuses as readonly string[]).includes(text("durum"))
      ? (text("durum") as ReportStatus)
      : "OPEN",
    type: (reportTargetTypes as readonly string[]).includes(text("tur"))
      ? (text("tur") as ReportTargetType)
      : undefined,
    page: Math.max(1, Math.min(1000, Number(text("sayfa")) || 1)),
  };
  const { rows, total, pageSize } = await getAdminReports(getDb(), filters);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <AdminHeading
        title="Şikâyetler"
        description="Okurların kitap, bölüm, yorum ve kullanıcılar hakkındaki şikâyetleri. Açık şikâyetler en eskiden başlayarak listelenir."
      />
      <div className="report-admin-filters">
        <nav className="segmented" aria-label="Şikâyet durumu">
          {reportStatuses.map((status) => (
            <Link
              key={status}
              href={listHref(filters, { status })}
              aria-current={filters.status === status ? "page" : undefined}
            >
              {reportStatusLabels[status]}
            </Link>
          ))}
        </nav>
        <nav className="report-type-filter" aria-label="Şikâyet türü">
          <Link
            href={listHref(filters, { type: undefined })}
            aria-current={!filters.type ? "page" : undefined}
          >
            Tümü
          </Link>
          {reportTargetTypes.map((type) => (
            <Link
              key={type}
              href={listHref(filters, { type })}
              aria-current={filters.type === type ? "page" : undefined}
            >
              {reportTargetLabels[type]}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <AdminEmpty
          text={
            filters.status === "OPEN"
              ? "İncelenmeyi bekleyen şikâyet yok."
              : "Bu filtrelerle eşleşen şikâyet yok."
          }
        />
      ) : (
        <AdminTable label="Şikâyet listesi">
          <thead>
            <tr>
              <th scope="col">Sebep</th>
              <th scope="col">Hedef</th>
              <th scope="col">Şikâyet eden</th>
              <th scope="col">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => (
              <tr key={report.id}>
                <th scope="row">
                  <Link
                    className="text-link"
                    href={`/admin/raporlar/${report.id}`}
                  >
                    {reportReasons[report.reason as ReportReason] ??
                      report.reason}
                  </Link>
                  {report.details && (
                    <small className="report-snippet">{report.details}</small>
                  )}
                </th>
                <td>
                  <span className="label-pill gray">
                    {reportTargetLabels[
                      report.targetType as ReportTargetType
                    ] ?? report.targetType}
                  </span>
                  {report.status !== "OPEN" && (
                    <small>
                      {reportStatusLabels[report.status as ReportStatus]}
                      {report.handledBy ? ` · ${report.handledBy.name}` : ""}
                    </small>
                  )}
                </td>
                <td>
                  <Link
                    className="text-link"
                    href={`/admin/kullanicilar/${report.reporter.id}`}
                  >
                    {report.reporter.name}
                  </Link>
                </td>
                <td>
                  <time dateTime={report.createdAt.toISOString()}>
                    {fullDate(report.createdAt)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
      <nav className="admin-pagination" aria-label="Sayfalama">
        <span>
          {total.toLocaleString("tr-TR")} şikâyet · Sayfa {filters.page} /{" "}
          {pages}
        </span>
        <div className="button-row">
          {filters.page > 1 && (
            <Link
              className="button button-outline button-small"
              href={listHref(filters, { page: filters.page - 1 })}
            >
              <ChevronLeft size={14} /> Önceki
            </Link>
          )}
          {filters.page < pages && (
            <Link
              className="button button-outline button-small"
              href={listHref(filters, { page: filters.page + 1 })}
            >
              Sonraki <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
