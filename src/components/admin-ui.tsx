import Link from "next/link";
import Form from "next/form";
import { ArrowLeft, ChevronLeft, ChevronRight } from "./icons";
import { ActionForm, SubmitButton } from "./action-form";
import type { FormAction } from "@/lib/action-state";
import { PAGE_SIZE, type Filters } from "@/modules/admin/queries";

export const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  APPROVED: "Onaylandı",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşivlendi",
  ONGOING: "Devam ediyor",
  COMPLETED: "Tamamlandı",
  HIATUS: "Arada",
  NONE: "Standart",
  ACTIVE: "Premium aktif",
  SUSPENDED: "Premium askıda",
  REVOKED: "Premium iptal",
  PENDING: "Bekliyor",
  REJECTED: "Reddedildi",
  reader: "Okur / Yazar",
  admin: "Yönetici",
};
export const auditLabels: Record<string, string> = {
  ADMIN_ANNOUNCEMENT_SAVED: "Duyuru kaydedildi",
  ADMIN_ANNOUNCEMENT_DELETED: "Duyuru silindi",
  ADMIN_SLIDE_SAVED: "Slayt kaydedildi",
  ADMIN_SLIDE_DELETED: "Slayt silindi",
  ADMIN_USER_BANNED: "Kullanıcı banlandı",
  ADMIN_USER_UNBANNED: "Kullanıcının banı kaldırıldı",
  ADMIN_USER_UPDATED: "Kullanıcı güncellendi",
  ADMIN_SESSIONS_REVOKED: "Oturumlar kapatıldı",
  ADMIN_BOOK_UPDATED: "Kitap güncellendi",
  ADMIN_CHAPTER_VISIBILITY: "Bölüm görünürlüğü değişti",
  ADMIN_COMMENT_VISIBILITY: "Yorum görünürlüğü değişti",
  "book.created": "Kitap oluşturuldu",
  "chapter.published": "Bölüm yayımlandı",
  "chapter.price_changed": "Bölüm fiyatı değişti",
  "application.publication.submitted": "Yayın başvurusu gönderildi",
  "application.premium.submitted": "Premium başvurusu gönderildi",
  "application.approved": "Başvuru onaylandı",
  "application.rejected": "Başvuru reddedildi",
};
export const fullDate = (value: Date) =>
  value.toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  });

export function AdminHeading({
  title,
  description,
  back,
}: {
  title: string;
  description: string;
  back?: { href: string; label: string };
}) {
  return (
    <header className="admin-heading">
      {back && (
        <Link className="breadcrumbs" href={back.href}>
          <ArrowLeft size={14} />
          {back.label}
        </Link>
      )}
      <div className="eyebrow">
        <span /> YÖNETİM ALANI
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
export function AdminFilter({
  path,
  filters,
  placeholder,
  options,
}: {
  path: string;
  filters: Filters;
  placeholder: string;
  options: [string, string][];
}) {
  return (
    <Form
      action={path}
      className="admin-filters"
      key={`${filters.q}:${filters.filter}`}
    >
      <label className="field">
        Ara
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder={placeholder}
          maxLength={100}
        />
      </label>
      <label className="field">
        Filtre
        <select name="filter" defaultValue={filters.filter}>
          <option value="">Tümü</option>
          {options.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-outline" type="submit">
        Uygula
      </button>
      {(filters.q || filters.filter) && (
        <Link className="text-link" href={path}>
          Temizle
        </Link>
      )}
    </Form>
  );
}
export function AdminPagination({
  path,
  filters,
  total,
}: {
  path: string;
  filters: Filters;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (page: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.filter) params.set("filter", filters.filter);
    params.set("page", String(page));
    return `${path}?${params}`;
  };
  return (
    <nav className="admin-pagination" aria-label="Sayfalama">
      <span>
        {total.toLocaleString("tr-TR")} kayıt · Sayfa {filters.page} / {pages}
      </span>
      <div className="button-row">
        {filters.page > 1 && (
          <Link
            className="button button-outline button-small"
            href={href(filters.page - 1)}
          >
            <ChevronLeft size={14} />
            Önceki
          </Link>
        )}
        {filters.page < pages && (
          <Link
            className="button button-outline button-small"
            href={href(filters.page + 1)}
          >
            Sonraki
            <ChevronRight size={14} />
          </Link>
        )}
        {filters.page > pages && (
          <Link className="text-link" href={href(1)}>
            İlk sayfaya dön
          </Link>
        )}
      </div>
    </nav>
  );
}
export function AdminTable({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className="admin-table-scroll"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="analytics-table admin-table">
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}
export function AdminEmpty({
  text = "Bu filtrelerle eşleşen kayıt bulunamadı.",
}: {
  text?: string;
}) {
  return <div className="admin-empty">{text}</div>;
}
export function ReasonField() {
  return (
    <label className="field">
      İşlem gerekçesi
      <textarea
        name="reason"
        required
        minLength={5}
        maxLength={1000}
        placeholder="Bu değişikliğin nedenini yaz…"
        rows={2}
      />
    </label>
  );
}
export function VisibilityForm({
  id,
  hidden,
  action,
  noun,
}: {
  id: string;
  hidden: boolean;
  action: FormAction;
  noun: string;
}) {
  return (
    <details className="admin-moderation">
      <summary className="text-link">
        {hidden ? `${noun} göster` : `${noun} gizle`}
      </summary>
      <ActionForm action={action} className="form-stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="hidden" value={String(!hidden)} />
        <ReasonField />
        <SubmitButton
          className={
            hidden
              ? "button-outline button-small"
              : "button-danger button-small"
          }
        >
          {hidden ? "Görünür yap" : "Gizle"}
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
