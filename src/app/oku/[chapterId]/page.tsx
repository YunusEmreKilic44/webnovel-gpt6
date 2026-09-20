import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getReaderChapter } from "@/modules/catalog/reader-queries";
import { Reader } from "@/components/reader";
import {
  BlockSkeleton,
  ButtonSkeleton,
  PageSkeleton,
} from "@/components/loading-skeletons";
import { ChapterBody, ChapterBookmark, ChapterNavigation } from "./sections";

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
  const [chapter, store] = await Promise.all([
    getReaderChapter(chapterId),
    cookies(),
  ]);
  if (!chapter) notFound();
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
        chapter.accessType === "FREE" ? (
          <Suspense
            fallback={<ButtonSkeleton label="Okuma işareti yükleniyor" />}
          >
            <ChapterBookmark bookId={chapter.bookId} chapterId={chapterId} />
          </Suspense>
        ) : null
      }
    >
      <Suspense
        fallback={<BlockSkeleton label="Bölüm metni yükleniyor" rows={12} />}
      >
        <ChapterBody
          chapterId={chapterId}
          bookSlug={chapter.bookSlug}
          price={chapter.price}
        />
      </Suspense>
    </Reader>
  );
}
