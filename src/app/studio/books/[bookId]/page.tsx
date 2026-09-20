import { cache, Suspense } from "react";
import { BlockSkeleton, PageSkeleton } from "@/components/loading-skeletons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  addChapterAction,
  addVolumeAction,
  submitApplicationAction,
} from "@/modules/publishing/actions";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Crown,
  Plus,
} from "@/components/icons";
import { date } from "@/lib/utils";
async function StudioBook({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const book = await ownedBook(bookId);
  return (
    <>
      <Link className="breadcrumbs" href="/studio">
        <ArrowLeft size={13} />
        Yazar stüdyosu
      </Link>
      <div className="studio-heading">
        <div>
          <div className="eyebrow">
            <span /> HİKÂYENİN KONTROL ODASI
          </div>
          <h1>{book.title}</h1>
          <p>
            {book._count.volumes} cilt · {book._count.chapters} bölüm ·{" "}
            {book.genre}
          </p>
        </div>
        {book.status === "PUBLISHED" && (
          <Link
            className="button button-outline button-small"
            href={`/kitap/${book.slug}`}
          >
            Kitabı gör <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      <div className="split-layout">
        <Suspense
          fallback={
            <BlockSkeleton label="Ciltler ve bölümler yükleniyor" rows={8} />
          }
        >
          <StudioChapters bookId={bookId} />
        </Suspense>
        <Suspense
          fallback={<BlockSkeleton label="Başvurular yükleniyor" rows={5} />}
        >
          <StudioApplications bookId={bookId} />
        </Suspense>
      </div>
    </>
  );
}

const ownedBook = cache(async (bookId: string) => {
  const actor = await requireUser();
  const book = await getDb().book.findFirst({
    where: { id: bookId, authorId: actor.id },
    include: { _count: { select: { volumes: true, chapters: true } } },
  });
  if (!book) notFound();
  return book;
});

export default function Page(props: { params: Promise<{ bookId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudioBook {...props} />
    </Suspense>
  );
}

async function StudioChapters({ bookId }: { bookId: string }) {
  await ownedBook(bookId);
  const db = getDb();
  const [allVolumes, allChapters] = await Promise.all([
    db.volume.findMany({ where: { bookId }, orderBy: { position: "asc" } }),
    db.chapter.findMany({
      where: { bookId },
      select: {
        id: true,
        title: true,
        volumeId: true,
        position: true,
        status: true,
        wordCount: true,
      },
      orderBy: { position: "asc" },
    }),
  ]);
  return (
    <div className="stack">
      {allVolumes.map((volume) => (
        <section className="panel" key={volume.id}>
          <h2>
            Cilt {volume.position} · {volume.title}
          </h2>
          {allChapters
            .filter((c) => c.volumeId === volume.id)
            .map((chapter) => (
              <Link
                href={`/studio/books/${bookId}/chapters/${chapter.id}`}
                className="chapter-row"
                key={chapter.id}
              >
                <span className="chapter-position">{chapter.position}</span>
                <span>{chapter.title}</span>
                <small>{chapter.wordCount} kelime</small>
                <span
                  className={`label-pill ${chapter.status === "DRAFT" ? "gray" : ""}`}
                >
                  {chapter.status === "DRAFT" ? "Taslak" : "Yayında"}
                </span>
                <ChevronRight size={13} />
              </Link>
            ))}
          <details style={{ marginTop: 18 }}>
            <summary className="text-link" style={{ cursor: "pointer" }}>
              + Bu cilde bölüm ekle
            </summary>
            <ActionForm action={addChapterAction} className="inline-form">
              <input type="hidden" name="bookId" value={bookId} />
              <input type="hidden" name="volumeId" value={volume.id} />
              <label className="field" style={{ marginTop: 15 }}>
                Bölüm başlığı
                <input
                  name="title"
                  minLength={2}
                  maxLength={120}
                  required
                  placeholder="Yeni bir sayfa"
                />
              </label>
              <SubmitButton className="button-outline">
                <Plus size={14} />
                Ekle
              </SubmitButton>
            </ActionForm>
          </details>
        </section>
      ))}
      <section className="panel">
        <h3>Hikâyede yeni bir dönem</h3>
        <ActionForm action={addVolumeAction} className="inline-form">
          <input type="hidden" name="bookId" value={bookId} />
          <label className="field">
            Yeni cildin adı
            <input
              name="title"
              minLength={2}
              maxLength={120}
              required
              placeholder="İkinci Cilt"
            />
          </label>
          <SubmitButton className="button-outline">
            <Plus size={14} />
            Cilt ekle
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}

async function StudioApplications({ bookId }: { bookId: string }) {
  const book = await ownedBook(bookId);
  const history = await getDb().application.findMany({
    where: { bookId },
    select: { id: true, type: true, status: true, note: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const publicationPending = history.some(
    (a) => a.type === "PUBLICATION" && a.status === "PENDING",
  );
  const premiumPending = history.some(
    (a) => a.type === "PREMIUM" && a.status === "PENDING",
  );
  return (
    <aside className="stack">
      <section className="panel">
        <CheckCircle2
          size={23}
          className="muted"
          style={{ marginBottom: 17 }}
        />
        <h2>Yayın başvurusu</h2>
        <p>
          {book.status === "PUBLISHED"
            ? "Kitabın okuyucularla buluştu. Yeni bölümlerini editörden yayımlayabilirsin."
            : book.status === "APPROVED"
              ? "Başvurun onaylandı. İncelenen ilk bölümünü editörden yayımlayabilirsin."
              : publicationPending
                ? "Başvurun inceleniyor. İncelemeye gönderilen sürüm korunur; kararını burada göreceksin."
                : "Hazır olduğunda hikâyeni incelemeye gönder. En az 30 kelimelik bir örnek bölüm gerekli."}
        </p>
        {book.status === "DRAFT" && !publicationPending && (
          <ActionForm action={submitApplicationAction} className="form-stack">
            <input type="hidden" name="bookId" value={bookId} />
            <input type="hidden" name="type" value="PUBLICATION" />
            <label className="check-field" style={{ marginTop: 15 }}>
              <input name="rights" type="checkbox" required />
              Bu içeriğin yayın haklarına sahibim.
            </label>
            <SubmitButton>İncelemeye gönder</SubmitButton>
          </ActionForm>
        )}
      </section>
      <section className="panel">
        <Crown size={23} style={{ color: "#aa9160", marginBottom: 17 }} />
        <h2>Bir adım ötesi</h2>
        <p>
          {book.premiumStatus === "ACTIVE"
            ? "Premium yetkin aktif. Onaydan sonra ilk kez yayımlanan bölümler için editörde fiyat belirleyebilirsin."
            : premiumPending
              ? "Premium başvurun inceleniyor."
              : "Premium onayı ile yeni bölümlerini ücretli yapabilirsin. Önceden yayımladığın bölümler ücretsiz kalır."}
        </p>
        {book.status === "PUBLISHED" &&
          book.premiumStatus !== "ACTIVE" &&
          !premiumPending && (
            <ActionForm action={submitApplicationAction} className="form-stack">
              <input type="hidden" name="bookId" value={bookId} />
              <input type="hidden" name="type" value="PREMIUM" />
              <label className="check-field" style={{ marginTop: 15 }}>
                <input name="rights" type="checkbox" required />
                Yayın hakları ve premium kurallarını kabul ediyorum.
              </label>
              <SubmitButton className="button-outline">
                Premium başvurusu
              </SubmitButton>
            </ActionForm>
          )}
        {book.firstPremiumApprovedAt && (
          <p style={{ marginTop: 12 }}>
            İlk onay: {date(book.firstPremiumApprovedAt)}
          </p>
        )}
      </section>
      {history.length > 0 && (
        <section className="panel">
          <h3>Başvuru geçmişi</h3>
          {history.map((a) => (
            <div className="application-history" key={a.id}>
              <span
                className={`label-pill ${a.status === "PENDING" ? "amber" : "gray"}`}
              >
                {a.type === "PUBLICATION" ? "Yayın" : "Premium"} ·{" "}
                {
                  {
                    PENDING: "İnceleniyor",
                    APPROVED: "Onaylandı",
                    REJECTED: "Reddedildi",
                  }[a.status]
                }
              </span>
              <p>
                {date(a.createdAt)}
                {a.note ? ` · ${a.note}` : ""}
              </p>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}
