import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { requireAdmin } from "@/modules/admin/access";
import { getAdminReport, getReportTarget } from "@/modules/reports/service";
import { resolveReportAction } from "@/modules/reports/actions";
import {
  reportActionLabels,
  reportReasons,
  reportStatusLabels,
  reportTargetLabels,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports";
import { AdminHeading, fullDate } from "@/components/admin-ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BlockSkeleton } from "@/components/loading-skeletons";

export const metadata = { title: "Şikâyet ayrıntısı" };

type Props = { params: Promise<{ reportId: string }> };

export default function ReportPage(props: Props) {
  return (
    <Suspense fallback={<BlockSkeleton label="Şikâyet yükleniyor" rows={8} />}>
      <ReportDetail {...props} />
    </Suspense>
  );
}

async function ReportDetail({ params }: Props) {
  await requireAdmin();
  const { reportId } = await params;
  const data = await getAdminReport(getDb(), reportId);
  if (!data) notFound();
  const { report, target, related } = data;
  const type = report.targetType as ReportTargetType;
  const openRelated = related.filter((r) => r.status === "OPEN").length;
  const moderation =
    type === "USER"
      ? { value: "BAN", label: "Kullanıcıyı banla" }
      : {
          value: "HIDE",
          label: {
            BOOK: "Kitabı gizle",
            CHAPTER: "Bölümü gizle",
            COMMENT: "Yorumu gizle",
          }[type],
        };
  return (
    <>
      <AdminHeading
        title={reportReasons[report.reason as ReportReason] ?? report.reason}
        description={`${reportTargetLabels[type] ?? type} şikâyeti · ${reportStatusLabels[report.status]}`}
        back={{ href: "/admin/raporlar", label: "Şikâyetler" }}
      />
      <div className="admin-detail-grid">
        <section className="panel">
          <h2>Şikâyet</h2>
          <dl className="report-facts">
            <div>
              <dt>Şikâyet eden</dt>
              <dd>
                <Link
                  className="text-link"
                  href={`/admin/kullanicilar/${report.reporter.id}`}
                >
                  {report.reporter.name}
                </Link>{" "}
                · {report.reporter.email}
              </dd>
            </div>
            <div>
              <dt>Tarih</dt>
              <dd>{fullDate(report.createdAt)}</dd>
            </div>
            <div>
              <dt>Açıklama</dt>
              <dd className="report-details">
                {report.details || "Açıklama yazılmamış."}
              </dd>
            </div>
            {report.status !== "OPEN" && (
              <div>
                <dt>Sonuç</dt>
                <dd>
                  {reportStatusLabels[report.status]} ·{" "}
                  {reportActionLabels[report.action]}
                  {report.handledBy && ` · ${report.handledBy.name}`}
                  {report.handledAt && ` · ${fullDate(report.handledAt)}`}
                  <span className="report-details">
                    {report.resolutionNote}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="panel">
          <h2>
            Şikâyet edilen{" "}
            {reportTargetLabels[type]?.toLocaleLowerCase("tr-TR")}
          </h2>
          <ReportTargetPreview target={target} />
        </section>
      </div>

      {report.status === "OPEN" && (
        <section className="panel">
          <h2>Karar</h2>
          <p>
            Karar, bu içerik hakkındaki tüm açık şikâyetleri kapatır
            {openRelated
              ? ` (bununla birlikte ${openRelated + 1} şikâyet)`
              : ""}
            . İşlemler ve gerekçen işlem geçmişine kaydedilir.
          </p>
          <ActionForm action={resolveReportAction} className="form-stack">
            <input type="hidden" name="id" value={report.id} />
            <fieldset className="report-decision">
              <legend>Sonuç</legend>
              <label className="check-field">
                <input
                  type="radio"
                  name="decision"
                  value="RESOLVED"
                  defaultChecked
                />
                Haklı: şikâyeti çözüldü olarak kapat
              </label>
              <label className="check-field">
                <input type="radio" name="decision" value="DISMISSED" />
                Haksız: şikâyeti reddet (içeriğe dokunulmaz)
              </label>
            </fieldset>
            <fieldset className="report-decision">
              <legend>Yapılacak işlem (yalnız “Haklı” seçildiğinde)</legend>
              <label className="check-field">
                <input type="radio" name="action" value="NONE" defaultChecked />
                İşlem yapma (ör. yazarla iletişime geçildi)
              </label>
              <label className="check-field">
                <input type="radio" name="action" value={moderation.value} />
                {moderation.label}
              </label>
            </fieldset>
            <label className="field">
              İşlem gerekçesi
              <textarea
                name="note"
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                placeholder="Kararının kısa gerekçesi…"
              />
            </label>
            <div>
              <SubmitButton>Kararı kaydet</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}

      {related.length > 0 && (
        <section className="panel">
          <h2>Aynı içerik hakkındaki diğer şikâyetler</h2>
          <ul className="admin-activity">
            {related.map((item) => (
              <li key={item.id}>
                <div>
                  <Link
                    className="text-link"
                    href={`/admin/raporlar/${item.id}`}
                  >
                    {reportReasons[item.reason as ReportReason] ?? item.reason}
                  </Link>
                  <span>
                    {item.reporter.name} · {reportStatusLabels[item.status]}
                  </span>
                </div>
                <time dateTime={item.createdAt.toISOString()}>
                  {fullDate(item.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ReportTargetPreview({
  target,
}: {
  target: Awaited<ReturnType<typeof getReportTarget>>;
}) {
  if (!target) return <p>Bu içerik artık bulunmuyor (silinmiş olabilir).</p>;
  if (target.type === "BOOK") {
    const { book } = target;
    return (
      <div className="report-target">
        <strong>{book.title}</strong>
        <p>
          Yazar:{" "}
          <Link
            className="text-link"
            href={`/admin/kullanicilar/${book.author.id}`}
          >
            {book.author.name}
          </Link>
          {book.hidden && " · Gizli"}
        </p>
        <p className="report-details">{book.description}</p>
        <div className="button-row">
          <Link
            className="button button-outline button-small"
            href={`/admin/kitaplar/${book.id}`}
          >
            Yönetimde aç
          </Link>
          {book.status === "PUBLISHED" && !book.hidden && (
            <Link className="text-link" href={`/kitap/${book.slug}`}>
              Sitede gör
            </Link>
          )}
        </div>
      </div>
    );
  }
  if (target.type === "CHAPTER") {
    const { chapter } = target;
    return (
      <div className="report-target">
        <strong>
          {chapter.book.title} · Bölüm {chapter.position}:{" "}
          {chapter.publishedTitle ?? chapter.title}
        </strong>
        <p>
          Yazar:{" "}
          <Link
            className="text-link"
            href={`/admin/kullanicilar/${chapter.book.author.id}`}
          >
            {chapter.book.author.name}
          </Link>
          {chapter.hidden && " · Gizli"}
        </p>
        <div className="button-row">
          <Link
            className="button button-outline button-small"
            href={`/admin/kitaplar/${chapter.book.id}/bolumler/${chapter.id}`}
          >
            Bölümü incele
          </Link>
        </div>
      </div>
    );
  }
  if (target.type === "COMMENT") {
    const { comment } = target;
    return (
      <div className="report-target">
        <p>
          <Link
            className="text-link"
            href={`/admin/kullanicilar/${comment.user.id}`}
          >
            {comment.user.name}
          </Link>{" "}
          · {comment.book.title} · {fullDate(comment.createdAt)}
          {comment.hidden && " · Gizli"}
          {comment.spoiler && " · Spoiler işaretli"}
        </p>
        <blockquote className="report-details">{comment.body}</blockquote>
      </div>
    );
  }
  if (target.type === "USER") {
    const { user } = target;
    return (
      <div className="report-target">
        <strong>{user.name}</strong>
        <p>
          {user.email} · {user.role === "admin" ? "Yönetici" : "Okur / Yazar"}
          {user.banned && " · Banlı"} · Kayıt: {fullDate(user.createdAt)}
        </p>
        <div className="button-row">
          <Link
            className="button button-outline button-small"
            href={`/admin/kullanicilar/${user.id}`}
          >
            Kullanıcıyı yönetimde aç
          </Link>
        </div>
      </div>
    );
  }
  return null;
}
