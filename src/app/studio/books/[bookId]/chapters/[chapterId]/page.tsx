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
  setChapterAccessAction,
} from "@/modules/publishing/actions";
import { getChapterPrice } from "@/modules/coins/service";
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
  const chapterPrice = await getChapterPrice(db);
  const chapter = await db.chapter.findFirst({
    where: { id: chapterId, bookId, book: { authorId: actor.id } },
    select: {
      id: true,
      title: true,
      content: true,
      version: true,
      status: true,
      firstPublishedAt: true,
      accessType: true,
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
              ? `Bu bölüm premium onayından sonra yayımlandı; premium yapabilirsin. Okurlar premium bölümleri platformun sabit fiyatıyla (şu an ${chapterPrice} coin) açar. Fiyatı yazar belirlemez.`
              : "Premium onayından önce yayımlanan bölümler daima ücretsiz kalır. Premium, onaydan sonra ilk kez yayımlanan bölümlerde açılır."}
          </p>
          <ActionForm action={setChapterAccessAction} className="form-stack">
            <input type="hidden" name="chapterId" value={chapterId} />
            <fieldset className="access-options" disabled={!eligible}>
              <legend className="sr-only">Bölüm erişimi</legend>
              <label className="check-field">
                <input
                  type="radio"
                  name="access"
                  value="FREE"
                  defaultChecked={chapter.accessType !== "PAID"}
                />
                Ücretsiz · herkes okuyabilir
              </label>
              <label className="check-field">
                <input
                  type="radio"
                  name="access"
                  value="PAID"
                  defaultChecked={chapter.accessType === "PAID"}
                />
                Premium · {chapterPrice} coin ile açılır
              </label>
            </fieldset>
            <div>
              <SubmitButton className="button-outline" disabled={!eligible}>
                Erişimi kaydet
              </SubmitButton>
            </div>
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
