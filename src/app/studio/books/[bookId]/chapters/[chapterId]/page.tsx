import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { books, chapters } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { ChapterEditor } from "@/components/chapter-editor";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  publishChapterAction,
  setChapterPriceAction,
} from "@/modules/publishing/actions";
import { ArrowLeft, ArrowUpRight } from "@/components/icons";
export default async function EditChapter({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const actor = await requireUser();
  const { bookId, chapterId } = await params;
  const db = getDb();
  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.authorId, actor.id)));
  if (!book) notFound();
  const [chapter] = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.bookId, bookId)));
  if (!chapter) notFound();
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
          content: chapter.content,
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
          <ActionForm action={publishChapterAction}>
            <input type="hidden" name="chapterId" value={chapterId} />
            <input type="hidden" name="version" value={chapter.version} />
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
