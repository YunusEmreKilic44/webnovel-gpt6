import { PageSkeleton } from "@/components/loading-skeletons";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import type { JSONContent } from "@tiptap/react";
import { requireUser } from "@/lib/session";
import { ChapterEditor } from "@/components/chapter-editor";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  publishChapterAction,
  setChapterPriceAction,
} from "@/modules/publishing/actions";
import { ArrowLeft, ArrowUpRight } from "@/components/icons";
async function EditChapter({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const [actor, { bookId, chapterId }] = await Promise.all([
    requireUser(),
    params,
  ]);
  const db = getDb();
  const chapter = await db.chapter.findFirst({
    where: { id: chapterId, bookId, book: { authorId: actor.id } },
    select: {
      id: true,
      title: true,
      content: true,
      version: true,
      status: true,
      firstPublishedAt: true,
      priceMinor: true,
      book: {
        select: {
          title: true,
          status: true,
          premiumStatus: true,
          firstPremiumApprovedAt: true,
        },
      },
    },
  });
  if (!chapter) notFound();
  const book = chapter.book;
  const eligible =
    book.premiumStatus === "ACTIVE" &&
    chapter.firstPublishedAt &&
    book.firstPremiumApprovedAt &&
    chapter.firstPublishedAt > book.firstPremiumApprovedAt;
  return (
    <div className="chapter-editor-shell">
      <Link href={`/studio/books/${bookId}`} className="breadcrumbs">
        <ArrowLeft size={13} />
        {book.title}
      </Link>
      <div className="studio-heading">
        <div>
          <div className="eyebrow">
            <span /> KELİMELERİN KENDİ YOLUNU BULSUN
          </div>
          <h1>Bir sonraki satır.</h1>
        </div>
        <span className="label-pill">
          {chapter.status === "PUBLISHED"
            ? "Yayında · Taslağı düzenliyorsun"
            : "Taslak"}
        </span>
      </div>
      <ChapterEditor
        chapter={{
          id: chapter.id,
          title: chapter.title,
          content: chapter.content as JSONContent,
          version: chapter.version,
        }}
      />
      <div className="editor-secondary">
        <section className="panel">
          <h3>Okuyucularla buluştur</h3>
          <p>
            {book.status === "DRAFT"
              ? "Önce kitabının yayın başvurusunu göndermelisin. Başvurudan sonra onaylanan sürümü ilk yayın için kullanabilirsin."
              : book.status === "APPROVED"
                ? "İlk yayında incelemeye gönderdiğin onaylı sürüm açılır. Daha sonraki taslak değişiklikleri ayrı korunur."
                : "Kaydettiğin sürümü yayımla. Mevcut bir bölümün ilk yayın tarihi düzenlemeyle değişmez."}
          </p>
          <ActionForm
            id={`publish-chapter-${chapter.id}`}
            action={publishChapterAction}
          >
            <input type="hidden" name="chapterId" value={chapterId} />
            <SubmitButton
              disabled={!["APPROVED", "PUBLISHED"].includes(book.status)}
            >
              {chapter.status === "PUBLISHED"
                ? "Yayındaki sürümü güncelle"
                : "Bölümü yayımla"}
            </SubmitButton>
          </ActionForm>
          {chapter.status === "PUBLISHED" && (
            <Link
              href={`/oku/${chapterId}`}
              className="text-link"
              style={{ marginTop: 15 }}
            >
              Okuyucu görünümü <ArrowUpRight size={14} />
            </Link>
          )}
        </section>
        <section className="panel">
          <h3>Bölüm erişimi</h3>
          <p>
            {eligible
              ? "Bu bölüm premium onayından sonra yayımlandı. Fiyat belirleyebilir veya ücretsiz bırakabilirsin. Gerçek tahsilat henüz açık değil."
              : "Premium onayından önce yayımlanan bölümler ücretsiz kalır. Ücretlendirme, onaydan sonra ilk kez yayımlanan bölümlerde açılır."}
          </p>
          <ActionForm action={setChapterPriceAction} className="inline-form">
            <input type="hidden" name="chapterId" value={chapterId} />
            <label className="field">
              Fiyat (₺)
              <input
                name="price"
                type="number"
                min={0}
                max={1000}
                step="0.01"
                defaultValue={chapter.priceMinor / 100}
                disabled={!eligible}
              />
            </label>
            <SubmitButton className="button-outline" disabled={!eligible}>
              Kaydet
            </SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}

export default function Page(props: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditChapter {...props} />
    </Suspense>
  );
}
