import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { RichText } from "@/components/rich-text";
import {
  AdminHeading,
  VisibilityForm,
  statusLabels,
  fullDate,
} from "@/components/admin-ui";
import { getAdminChapter } from "@/modules/admin/queries";
import { chapterVisibilityAction } from "@/modules/admin/actions";

export const metadata = { title: "Bölüm inceleme" };
type Props = { params: Promise<{ bookId: string; chapterId: string }> };
export default function ChapterPage(props: Props) {
  return (
    <Suspense fallback={<BlockSkeleton label="Bölüm yükleniyor" rows={10} />}>
      <ChapterDetail {...props} />
    </Suspense>
  );
}
async function ChapterDetail({ params }: Props) {
  const { bookId, chapterId } = await params;
  const chapter = await getAdminChapter(bookId, chapterId);
  if (!chapter) notFound();
  return (
    <>
      <AdminHeading
        title={chapter.title}
        description={`Cilt ${chapter.volume.position} · ${chapter.volume.title}`}
        back={{ href: `/admin/kitaplar/${bookId}`, label: chapter.book.title }}
      />
      <div className="button-row admin-book-links">
        <span className="label-pill">{statusLabels[chapter.status]}</span>
        <span className="label-pill gray">
          {chapter.hidden ? "Gizli" : "Gizlenmemiş"}
        </span>
        <span className="label-pill gray">
          {chapter.accessType === "PAID" ? "Ücretli" : "Ücretsiz"}
        </span>
        <span className="muted">
          {chapter._count.reads.toLocaleString("tr-TR")} okunma
        </span>
      </div>
      <section className="panel">
        <h2>Moderasyon</h2>
        <p>
          {chapter.firstPublishedAt
            ? `İlk yayın: ${fullDate(chapter.firstPublishedAt)}.`
            : "Bu bölüm henüz yayımlanmadı."}{" "}
          Gizlenen bölümü okurlar açamaz.
        </p>
        <VisibilityForm
          id={chapter.id}
          hidden={chapter.hidden}
          action={chapterVisibilityAction}
          noun="Bölümü"
        />
      </section>
      {chapter.publishedContent && (
        <section className="panel admin-chapter-preview">
          <h2>Yayımdaki metin · {chapter.publishedTitle}</h2>
          <RichText content={chapter.publishedContent as JSONContent} />
        </section>
      )}
      <details
        className="panel admin-chapter-preview"
        open={!chapter.publishedContent}
      >
        <summary className="text-link">
          Yazarın taslağı · Sürüm {chapter.version}
        </summary>
        <RichText content={chapter.content as JSONContent} />
      </details>
    </>
  );
}
