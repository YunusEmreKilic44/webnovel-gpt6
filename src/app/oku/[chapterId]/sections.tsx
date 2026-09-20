import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { getReaderNeighbours } from "@/modules/catalog/reader-queries";
import { RichText } from "@/components/rich-text";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  List,
  LockKeyhole,
} from "@/components/icons";
import { interactAction } from "@/modules/community/actions";
import { money } from "@/lib/utils";

export async function ChapterBody(props: {
  chapterId: string;
  bookSlug: string;
  price: number;
}) {
  // Recheck access in the body query itself, including when metadata changes during streaming.
  const body = await getDb().chapter.findFirst({
    where: {
      id: props.chapterId,
      accessType: "FREE",
      status: "PUBLISHED",
      hidden: false,
      book: { status: "PUBLISHED", hidden: false },
    },
    select: { publishedContent: true },
  });
  const content = body?.publishedContent as JSONContent | null;
  return (
    <>
      {" "}
      {content ? (
        <RichText content={content} />
      ) : (
        <div className="locked-chapter">
          <LockKeyhole size={35} />
          <h2>Hikâyenin bu bölümü premium.</h2>
          <p>
            Bu bölümün fiyatı {money(props.price)}.<br />
            Satın alma henüz kullanıma açılmadı. Şu an ödeme alınmıyor.
          </p>
          <Link
            href={`/kitap/${props.bookSlug}`}
            className="button button-outline"
          >
            Ücretsiz bölümlere dön
          </Link>
        </div>
      )}
    </>
  );
}

export async function ChapterNavigation(props: {
  bookId: string;
  chapterId: string;
  bookSlug: string;
}) {
  const neighbours = await getReaderNeighbours(props.bookId, props.chapterId);
  return (
    <nav className="reader-navigation">
      {neighbours?.previous ? (
        <Link
          href={`/oku/${neighbours?.previous}`}
          className="button button-outline"
        >
          <ArrowLeft size={15} />
          Önceki bölüm
        </Link>
      ) : (
        <span />
      )}
      {neighbours?.next ? (
        <Link href={`/oku/${neighbours?.next}`} className="button button-dark">
          Sonraki bölüm <ArrowRight size={15} />
        </Link>
      ) : (
        <Link href={`/kitap/${props.bookSlug}`} className="button button-dark">
          Kitaba dön <List size={15} />
        </Link>
      )}
    </nav>
  );
}

export async function ChapterBookmark(props: {
  bookId: string;
  chapterId: string;
}) {
  const actor = await getCurrentUser();
  if (!actor) return null;
  return (
    <>
      {" "}
      {
        <ActionForm action={interactAction}>
          <input type="hidden" name="bookId" value={props.bookId} />
          <input type="hidden" name="chapterId" value={props.chapterId} />
          <input type="hidden" name="intent" value="progress" />
          <SubmitButton className="button-outline">
            <Bookmark size={14} />
            Burada kaldığımı kaydet
          </SubmitButton>
        </ActionForm>
      }
    </>
  );
}
