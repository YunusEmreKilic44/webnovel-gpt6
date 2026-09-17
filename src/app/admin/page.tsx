import { notFound } from "next/navigation";
import { getDb } from "@/db";
import type { ApplicationSnapshot } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { reviewApplicationAction } from "@/modules/publishing/actions";
import { RichText } from "@/components/rich-text";
import { CheckCircle2, ShieldCheck } from "@/components/icons";
import { date } from "@/lib/utils";
export const metadata = {
  title: "Başvurular",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  const actor = await requireUser();
  if (actor.role !== "admin" || !actor.emailVerified) notFound();
  const rows = await getDb().application.findMany({
    include: {
      book: { select: { author: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const queue = rows.map(({ book, ...application }) => ({
    application: {
      ...application,
      snapshot: application.snapshot as ApplicationSnapshot,
    },
    author: book.author.name,
  }));
  return (
    <>
      <div className="studio-heading">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={13} /> YÖNETİM ALANI
          </div>
          <h1>Yeni dünyalar kapıda.</h1>
          <p>
            Yayın ve premium başvurularını, gönderildiği andaki sürümleriyle
            incele.
          </p>
        </div>
        <span className="label-pill amber">
          {queue.filter((q) => q.application.status === "PENDING").length}{" "}
          bekleyen başvuru
        </span>
      </div>
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
              <h2>{a.snapshot.title}</h2>
              <p>
                {author} · {a.snapshot.genre}
              </p>
              <p style={{ marginTop: 10 }}>{a.snapshot.description}</p>
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
    </>
  );
}
