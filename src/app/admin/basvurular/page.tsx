import { Suspense } from "react";
import Link from "next/link";
import { BlockSkeleton } from "@/components/loading-skeletons";
import type { ApplicationSnapshot } from "@/db/schema";
import {
  adminFilters,
  getAdminApplications,
  type SearchParams,
} from "@/modules/admin/queries";
import {
  AdminFilter,
  AdminHeading,
  AdminPagination,
} from "@/components/admin-ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { reviewApplicationAction } from "@/modules/publishing/actions";
import { RichText } from "@/components/rich-text";
import { CheckCircle2 } from "@/components/icons";
import { date } from "@/lib/utils";
export const metadata = {
  title: "Başvurular",
  robots: { index: false, follow: false },
};
export default function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense
      fallback={<BlockSkeleton label="Başvurular yükleniyor" rows={8} />}
    >
      <Applications searchParams={searchParams} />
    </Suspense>
  );
}

async function Applications({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = adminFilters(await searchParams);
  const { rows, total, pending } = await getAdminApplications(filters);
  const queue = rows.map(({ book, ...application }) => ({
    application: {
      ...application,
      snapshot: application.snapshot as ApplicationSnapshot,
    },
    author: book.author.name,
  }));
  return (
    <>
      <AdminHeading
        title="Başvurular"
        description="Yayın ve premium başvurularını gönderildiği andaki sürümleriyle incele."
      />
      <span className="label-pill amber">{pending} bekleyen başvuru</span>
      <AdminFilter
        path="/admin/basvurular"
        filters={filters}
        placeholder="Kitap adına göre ara"
        options={[
          ["PENDING", "Bekleyen"],
          ["APPROVED", "Onaylanan"],
          ["REJECTED", "Reddedilen"],
          ["PUBLICATION", "Yayın başvuruları"],
          ["PREMIUM", "Premium başvuruları"],
        ]}
      />
      <div className="notice" style={{ marginBottom: 23 }}>
        Premium değerlendirmesi bu sürümde yalnız bölüm fiyatlandırma yetkisini
        açar. Gerçek tahsilat ve yazar ödemeleri henüz etkin değildir.
      </div>
      <div className="stack">
        {queue.length ? (
          queue.map(({ application: a, author }) => (
            <article className="application-card" key={a.id}>
              <header>
                <span className="label-pill">
                  {a.type === "PUBLICATION"
                    ? "Yayın başvurusu"
                    : "Premium başvurusu"}
                </span>
                <span className="muted" style={{ fontSize: 11 }}>
                  {date(a.createdAt)} ·{" "}
                  {
                    {
                      PENDING: "İnceleniyor",
                      APPROVED: "Onaylandı",
                      REJECTED: "Reddedildi",
                    }[a.status as "PENDING" | "APPROVED" | "REJECTED"]
                  }
                </span>
              </header>
              <h2>
                <Link href={`/admin/kitaplar/${a.bookId}`}>
                  {a.snapshot.title}
                </Link>
              </h2>
              <p>
                {author} · {a.snapshot.genres.join(" · ")}
              </p>
              <p style={{ marginTop: 10 }}>{a.snapshot.description}</p>
              {a.snapshot.tags.length > 0 && (
                <p className="snapshot-tags">
                  Etiketler: {a.snapshot.tags.join(" · ")}
                </p>
              )}
              {a.snapshot.chapters.map((chapter) => (
                <details key={chapter.id}>
                  <summary>
                    {chapter.title} · Başvuru sürümü {chapter.version}
                  </summary>
                  <RichText content={chapter.content} />
                </details>
              ))}
              {a.status === "PENDING" ? (
                <ActionForm
                  action={reviewApplicationAction}
                  className="form-stack"
                >
                  <input type="hidden" name="applicationId" value={a.id} />
                  <label className="field">
                    Karar gerekçesi
                    <textarea
                      name="note"
                      required
                      minLength={5}
                      maxLength={2000}
                      placeholder="İnceleme sonucunu yazara açıkla…"
                    />
                  </label>
                  <div className="button-row">
                    <SubmitButton name="decision" value="APPROVED">
                      <CheckCircle2 size={15} />
                      {a.type === "PUBLICATION"
                        ? "Onayla ve yayımla"
                        : "Onayla"}
                    </SubmitButton>
                    <SubmitButton
                      name="decision"
                      value="REJECTED"
                      className="button-danger"
                    >
                      Reddet
                    </SubmitButton>
                  </div>
                </ActionForm>
              ) : (
                <p style={{ marginTop: 15 }}>
                  {a.note || "Başvuru değerlendirildi."}
                </p>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <CheckCircle2 size={34} />
            <h2>Şimdilik her şey sakin.</h2>
            <p>Yazarların başvuruları burada görünecek.</p>
          </div>
        )}
      </div>
      <AdminPagination
        path="/admin/basvurular"
        filters={filters}
        total={total}
      />
    </>
  );
}
