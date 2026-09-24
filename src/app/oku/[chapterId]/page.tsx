import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { getReaderChapter } from "@/modules/catalog/reader-queries";
import { canReadChapter } from "@/modules/coins/service";
import { Reader } from "@/components/reader";
import { ReportButton } from "@/components/report-button";
import {
  BlockSkeleton,
  ButtonSkeleton,
  PageSkeleton,
} from "@/components/loading-skeletons";
import {
  ChapterBody,
  ChapterBookmark,
  ChapterNavigation,
  LockedChapter,
} from "./sections";

export const metadata = {
  title: "Okuma zamanı",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { params: Promise<{ chapterId: string }> };

export default function ReadChapter(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReadingPage {...props} />
    </Suspense>
  );
}

async function ReadingPage({ params }: Props) {
  const { chapterId } = await params;
  const [chapter, store, actor] = await Promise.all([
    getReaderChapter(chapterId),
    cookies(),
    getCurrentUser(),
  ]);
  if (!chapter) notFound();
  const readable = await canReadChapter(getDb(), actor?.id ?? null, {
    id: chapter.id,
    accessType: chapter.accessType,
    authorId: chapter.authorId,
  });
  const storedTheme = store.get("reader-theme")?.value;
  const theme =
    storedTheme === "paper" || storedTheme === "sepia" ? storedTheme : "dark";
  const font = Number(store.get("reader-font")?.value || 20);
  return (
    <Reader
      {...chapter}
      chapterId={chapterId}
      initialTheme={theme}
      initialFontSize={
        Number.isFinite(font) ? Math.max(16, Math.min(28, font)) : 20
      }
      navigation={
        <Suspense
          fallback={<ButtonSkeleton label="Bölüm bağlantıları yükleniyor" />}
        >
          <ChapterNavigation {...chapter} chapterId={chapterId} />
        </Suspense>
      }
      bookmark={
        <div className="reader-bottom-actions">
          {readable && (
            <Suspense
              fallback={<ButtonSkeleton label="Okuma işareti yükleniyor" />}
            >
              <ChapterBookmark bookId={chapter.bookId} chapterId={chapterId} />
            </Suspense>
          )}
          {actor?.id !== chapter.authorId && (
            <ReportButton
              signedIn={Boolean(actor)}
              label="Bölümü şikâyet et"
              targets={[
                { type: "CHAPTER", id: chapter.id, label: "Bu bölümü" },
                { type: "BOOK", id: chapter.bookId, label: "Kitabın tamamını" },
              ]}
            />
          )}
        </div>
      }
    >
      {readable ? (
        <Suspense
          fallback={<BlockSkeleton label="Bölüm metni yükleniyor" rows={12} />}
        >
          <ChapterBody chapterId={chapterId} bookSlug={chapter.bookSlug} />
        </Suspense>
      ) : (
        <Suspense fallback={<BlockSkeleton label="Bölüm bilgisi yükleniyor" />}>
          <LockedChapter
            chapterId={chapterId}
            bookSlug={chapter.bookSlug}
            salesOpen={chapter.premiumStatus === "ACTIVE"}
            signedIn={Boolean(actor)}
          />
        </Suspense>
      )}
    </Reader>
  );
}
