import type { JSONContent } from "@tiptap/react";
import Link from "next/link";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { getReaderNeighbours } from "@/modules/catalog/reader-queries";
import { RichText } from "@/components/rich-text";
import { ChapterReadTracker } from "@/components/chapter-read-tracker";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Coins,
  List,
  LockKeyhole,
} from "@/components/icons";
import { interactAction } from "@/modules/community/actions";
import { unlockChapterAction } from "@/modules/coins/actions";
import { getChapterPrice } from "@/modules/coins/service";
import { getFeatureFlags } from "@/modules/features/flags";

export async function ChapterBody(props: {
  chapterId: string;
  bookSlug: string;
}) {
  const actor = await getCurrentUser();
  // Recheck access in the body query itself, including when metadata changes
  // during streaming: free, the author's own, or unlocked by this reader.
  const body = await getDb().chapter.findFirst({
    where: {
      id: props.chapterId,
      status: "PUBLISHED",
      hidden: false,
      book: { status: "PUBLISHED", hidden: false },
      OR: [
        { accessType: "FREE" },
        ...(actor
          ? [
              { book: { authorId: actor.id } },
              { unlocks: { some: { userId: actor.id } } },
            ]
          : []),
      ],
    },
    select: { publishedContent: true },
  });
  const content = body?.publishedContent as JSONContent | null;
  if (!content)
    return (
      <div className="locked-chapter">
        <LockKeyhole size={35} />
        <h2>Bu bölüm şu an okunamıyor.</h2>
        <Link
          href={`/kitap/${props.bookSlug}`}
          className="button button-outline"
        >
          Kitaba dön
        </Link>
      </div>
    );
  return (
    <>
      <RichText content={content} />
      <ChapterReadTracker chapterId={props.chapterId} />
    </>
  );
}

export async function LockedChapter(props: {
  chapterId: string;
  bookSlug: string;
  salesOpen: boolean;
  signedIn: boolean;
}) {
  const db = getDb();
  const [price, actor, flags] = await Promise.all([
    getChapterPrice(db),
    getCurrentUser(),
    getFeatureFlags(),
  ]);
  const balance = actor?.coinBalance ?? 0;
  const enough = balance >= price;
  return (
    <div className="locked-chapter">
      <LockKeyhole size={35} />
      <h2>Hikâyenin bu bölümü premium.</h2>
      {!props.salesOpen ? (
        <p>
          Bu kitabın premium bölümleri şu an açılamıyor. Daha önce açtığın
          bölümleri okumaya devam edebilirsin.
        </p>
      ) : !props.signedIn ? (
        <>
          <p>
            Bu bölümü <strong>{price} coin</strong> ile kalıcı olarak
            açabilirsin. Devam etmek için giriş yap.
          </p>
          <Link
            href="/giris"
            className="button button-dark locked-chapter-action"
          >
            Giriş yap
          </Link>
        </>
      ) : (
        <>
          <p>
            Bu bölümü <strong>{price} coin</strong> ile kalıcı olarak aç.
            <br />
            Bakiyen: <strong>{balance} coin</strong>
          </p>
          {enough ? (
            <ActionForm
              action={unlockChapterAction}
              className="locked-chapter-action"
            >
              <input type="hidden" name="chapterId" value={props.chapterId} />
              <SubmitButton>
                <Coins size={15} /> {price} coin ile aç
              </SubmitButton>
            </ActionForm>
          ) : (
            <>
              <p className="locked-chapter-shortfall">
                {price - balance} coin daha gerekiyor.
              </p>
              {flags.coinStore ? (
                <Link
                  href={`/cuzdan?geri=${encodeURIComponent(`/oku/${props.chapterId}`)}`}
                  className="button button-dark locked-chapter-action"
                >
                  <Coins size={15} /> Coin yükle
                </Link>
              ) : (
                <p className="locked-chapter-shortfall">
                  Coin mağazası yakında açılacak.
                </p>
              )}
            </>
          )}
        </>
      )}
      <Link href={`/kitap/${props.bookSlug}`} className="text-link">
        Bölüm listesine dön
      </Link>
    </div>
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
