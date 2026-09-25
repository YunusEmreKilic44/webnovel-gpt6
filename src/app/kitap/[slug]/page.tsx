import { PageSkeleton } from "@/components/loading-skeletons";
import { getDb } from "@/db";
import { CommentLikeButton } from "@/components/comment-like-button";
import { ReportButton } from "@/components/report-button";
import { cache, Suspense } from "react";
import { BlockSkeleton, ButtonSkeleton } from "@/components/loading-skeletons";
import type { CatalogBook } from "@/modules/catalog/queries";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CHAPTER_PREVIEW_SIZE,
  getBookComments,
  getMyBookState,
  getPublicBook,
  getPublicChapters,
} from "@/modules/catalog/queries";
import { getCurrentUser } from "@/lib/session";
import { BookCover } from "@/components/book-cover";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { interactAction } from "@/modules/community/actions";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Crown,
  Feather,
  Heart,
  MessageCircle,
  Star,
} from "@/components/icons";
import { date } from "@/lib/utils";
import { PublicChapterList } from "@/components/public-chapter-list";
import { Eye } from "lucide-react";
import { getPublicReadCount } from "@/modules/analytics/queries";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const book = await getPublicBook((await params).slug);
  return {
    title: book?.title || "Kitap bulunamadı",
    description: book?.description.slice(0, 160),
  };
}
async function BookDetail({ params }: Props) {
  const book = await getPublicBook((await params).slug);
  if (!book) notFound();
  return (
    <>
      <div className="breadcrumbs">
        <Link href="/">Keşfet</Link>
        <ChevronRight size={12} />
        <Link href="/kesfet">Kitaplar</Link>
        <ChevronRight size={12} />
        <span>{book.title}</span>
      </div>
      <section className="book-detail-header">
        <BookCover
          title={book.title}
          subtitle={book.subtitle}
          author={book.author}
          cover={book.cover}
          coverUrl={book.coverUrl}
          className="detail-cover"
          sizes="(max-width: 700px) 130px, 220px"
          eager
        />
        <div className="detail-heading">
          <div className="button-row">
            {book.genres.map((genre) => (
              <Link
                key={genre}
                className="label-pill"
                href={`/kesfet?genre=${encodeURIComponent(genre)}`}
              >
                {genre}
              </Link>
            ))}
            <span className="label-pill gray">
              {book.storyStatus === "COMPLETED"
                ? "Tamamlandı"
                : book.storyStatus === "HIATUS"
                  ? "Arada"
                  : "Devam ediyor"}
            </span>
            {book.premiumStatus === "ACTIVE" && (
              <span className="label-pill amber">
                <Crown size={11} />
                Premium
              </span>
            )}
          </div>
          <h1>{book.title}</h1>
          <p className="detail-author">
            <Link href={`/yazar/${book.authorId}`}>
              <Avatar
                name={book.author}
                url={book.authorAvatarUrl}
                className="small-avatar"
                size={28}
              />
              {book.author}
            </Link>
          </p>
          <div className="detail-rating">
            <Star size={15} fill="currentColor" />
            <strong>
              {book.averageRating
                ? book.averageRating.toLocaleString("tr-TR")
                : "Henüz puan yok"}
            </strong>
            <small>({book.ratingCount} değerlendirme)</small>
          </div>
          <p className="detail-description">{book.description}</p>
          {book.tags.length > 0 && (
            <nav className="book-tags" aria-label="Kitabın etiketleri">
              {book.tags.map((tag) => (
                <Link key={tag} href={`/kesfet?tag=${encodeURIComponent(tag)}`}>
                  {tag}
                </Link>
              ))}
            </nav>
          )}
          <div className="detail-stats">
            <Suspense fallback={<span>Okunma yükleniyor…</span>}>
              <ReadCount bookId={book.id} />
            </Suspense>
            <span>
              <BookOpen size={15} />
              {book.chapterCount} bölüm
            </span>
            <span>{book.volumeCount} cilt</span>
            <span>Türkçe</span>
          </div>
          <div className="button-row">
            <Suspense
              fallback={<ButtonSkeleton label="Okuma bağlantısı yükleniyor" />}
            >
              <ReadLink bookId={book.id} />
            </Suspense>
            <Suspense
              fallback={<ButtonSkeleton label="Kütüphane durumu yükleniyor" />}
            >
              <SaveBook bookId={book.id} />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <BookReport
              bookId={book.id}
              authorId={book.authorId}
              author={book.author}
            />
          </Suspense>
        </div>
      </section>
      <div className="detail-tabs">
        <a href="#bolumler">
          <BookOpen size={13} style={{ display: "inline", marginRight: 7 }} />
          Bölümler ({book.chapterCount})
        </a>
        <a href="#yorumlar">
          <MessageCircle
            size={13}
            style={{ display: "inline", marginRight: 7 }}
          />
          Yorumlar
        </a>
      </div>
      <div className="split-layout">
        <div>
          <section id="bolumler">
            <Suspense
              fallback={<BlockSkeleton label="Bölümler yükleniyor" rows={6} />}
            >
              <ChapterList book={book} />
            </Suspense>
          </section>
          <section id="yorumlar">
            <div className="comments-heading">
              <h2>Satır aralarında buluşalım.</h2>
              <MessageCircle size={20} className="muted" />
            </div>
            <Suspense
              fallback={<BlockSkeleton label="Yorum alanı yükleniyor" />}
            >
              <CommunityForms book={book} />
            </Suspense>
            <Suspense fallback={<BlockSkeleton label="Yorumlar yükleniyor" />}>
              <Comments bookId={book.id} />
            </Suspense>
          </section>
        </div>
        <aside className="stack">
          <div className="panel book-side-panel">
            <Feather size={26} className="muted" style={{ marginBottom: 18 }} />
            <h3>
              Bir dünya da
              <br />
              senin içinde.
            </h3>
            <p>Okuduğun her hikâye, yazacağın ilk satıra ilham olabilir.</p>
            <Link href="/studio/yeni" className="text-link">
              Yazmaya başla <ArrowRight size={14} />
            </Link>
          </div>
          {book.premiumStatus === "ACTIVE" && (
            <div className="notice">
              Premium onayından önce yayımlanan tüm bölümler ücretsiz kalır.
              Ücretli bölümlerin fiyatı listede ayrıca gösterilir.
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

const getBookInteraction = cache(async (bookId: string) => {
  const actor = await getCurrentUser();
  const state = actor
    ? await getMyBookState(actor.id, bookId)
    : { saved: false, score: 0 };
  return { actor, state };
});
async function ReadCount({ bookId }: { bookId: string }) {
  const count = await getPublicReadCount(bookId);
  return (
    <span title="Bölümlerin toplam okunması. Aynı okurun aynı bölümü bir UTC gününde bir kez sayılır.">
      <Eye size={15} />
      {count.toLocaleString("tr-TR")} okunma
    </span>
  );
}
async function ReadLink({ bookId }: { bookId: string }) {
  const chapters = await getPublicChapters(bookId, CHAPTER_PREVIEW_SIZE);
  return (
    <>
      {chapters[0] && (
        <Link className="button button-dark" href={`/oku/${chapters[0].id}`}>
          <BookOpen size={15} />
          Okumaya başla <ArrowRight size={15} />
        </Link>
      )}
    </>
  );
}
async function SaveBook({ bookId }: { bookId: string }) {
  const { actor, state } = await getBookInteraction(bookId);
  return (
    <>
      {actor ? (
        <ActionForm action={interactAction}>
          <input type="hidden" name="bookId" value={bookId} />
          <input
            type="hidden"
            name="intent"
            value={state.saved ? "unsave" : "save"}
          />
          <SubmitButton className="button-outline">
            {state.saved ? <Check size={15} /> : <Bookmark size={15} />}
            {state.saved ? "Kütüphanemde" : "Kütüphaneme ekle"}
          </SubmitButton>
        </ActionForm>
      ) : (
        <Link className="button button-outline" href="/giris">
          <Bookmark size={15} />
          Kütüphaneme ekle
        </Link>
      )}
    </>
  );
}
async function ChapterList({ book }: { book: CatalogBook }) {
  const chapters = await getPublicChapters(book.id, CHAPTER_PREVIEW_SIZE);
  return (
    <>
      <PublicChapterList chapters={chapters} />
      {book.chapterCount > 0 && (
        <div className="chapter-list-footer">
          {book.chapterCount > CHAPTER_PREVIEW_SIZE && (
            <p className="muted">
              İlk {CHAPTER_PREVIEW_SIZE} bölüm gösteriliyor.
            </p>
          )}
          <Link
            href={`/kitap/${book.slug}/bolumler`}
            className="button button-outline"
          >
            Tüm bölümleri gör ({book.chapterCount}) <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </>
  );
}
async function CommunityForms({ book }: { book: CatalogBook }) {
  const { actor, state } = await getBookInteraction(book.id);
  return (
    <>
      {actor && actor.id !== book.authorId && (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h3>Bu hikâyeye kaç yıldız verirsin?</h3>
          <ActionForm action={interactAction} className="rating-form">
            <input type="hidden" name="bookId" value={book.id} />
            <input type="hidden" name="intent" value="rate" />
            <div className="rating-options">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n}>
                  <input
                    type="radio"
                    name="score"
                    value={n}
                    defaultChecked={state.score === n}
                    required
                    aria-label={`${n} yıldız`}
                  />
                  <span>
                    {n}
                    <Star size={14} fill="currentColor" />
                  </span>
                </label>
              ))}
            </div>
            <SubmitButton className="button-outline button-small">
              Puan ver
            </SubmitButton>
          </ActionForm>
        </div>
      )}
      {actor ? (
        <ActionForm action={interactAction} className="form-stack">
          <input type="hidden" name="bookId" value={book.id} />
          <input type="hidden" name="intent" value="comment" />
          <label className="field">
            Sen ne düşünüyorsun?
            <textarea
              name="body"
              placeholder="Hikâyenin sende bıraktıklarını paylaş…"
              required
              minLength={3}
              maxLength={2000}
            />
          </label>
          <div
            className="button-row"
            style={{ justifyContent: "space-between" }}
          >
            <label className="check-field">
              <input type="checkbox" name="spoiler" />
              Yorumum spoiler içeriyor
            </label>
            <SubmitButton className="button-dark button-small">
              Yorumu paylaş
            </SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <div className="notice">
          Düşüncelerini paylaşmak ve puan vermek için{" "}
          <Link href="/giris" style={{ textDecoration: "underline" }}>
            giriş yap
          </Link>
          .
        </div>
      )}
    </>
  );
}
async function Comments({ bookId }: { bookId: string }) {
  const comments = await getBookComments(bookId);
  return (
    <div style={{ marginTop: 20 }}>
      {comments.map((comment) => (
        <article className="comment" key={comment.id}>
          <Avatar
            name={comment.name}
            url={comment.avatarUrl}
            className="small-avatar"
            size={31}
          />
          <div className="comment-body">
            <div className="comment-meta">
              <strong>
                <Link href={`/yazar/${comment.userId}`}>{comment.name}</Link>
              </strong>
              <time dateTime={comment.createdAt.toISOString()}>
                {date(comment.createdAt)}
              </time>
            </div>
            {comment.spoiler ? (
              <details>
                <summary>Spoiler içeriyor · Görmek için aç</summary>
                <p>{comment.body}</p>
              </details>
            ) : (
              <p>{comment.body}</p>
            )}
            <Suspense
              fallback={
                <span className="comment-like-button">
                  <Heart size={15} />
                  {comment._count.likes.toLocaleString("tr-TR")} beğeni
                </span>
              }
            >
              <CommentLikeControl
                bookId={bookId}
                commentId={comment.id}
                likeCount={comment._count.likes}
              />
            </Suspense>
            <Suspense fallback={null}>
              <CommentReport
                bookId={bookId}
                commentId={comment.id}
                userId={comment.userId}
                name={comment.name}
              />
            </Suspense>
          </div>
        </article>
      ))}
    </div>
  );
}

const getCommentLikeViewer = cache(async (bookId: string) => {
  const [actor, comments] = await Promise.all([
    getCurrentUser(),
    getBookComments(bookId),
  ]);
  const likes = actor
    ? await getDb().commentLike.findMany({
        where: {
          userId: actor.id,
          commentId: { in: comments.map((comment) => comment.id) },
        },
        select: { commentId: true },
      })
    : [];
  return { actor, likedIds: new Set(likes.map((like) => like.commentId)) };
});
async function CommentLikeControl({
  bookId,
  commentId,
  likeCount,
}: {
  bookId: string;
  commentId: string;
  likeCount: number;
}) {
  const { actor, likedIds } = await getCommentLikeViewer(bookId);
  if (!actor)
    return (
      <Link
        href="/giris"
        className="comment-like-button"
        aria-label="Yorumu beğenmek için giriş yap"
      >
        <Heart size={15} />
        <span>Beğen</span>
        <span aria-label="Beğeni sayısı">
          {likeCount.toLocaleString("tr-TR")}
        </span>
      </Link>
    );
  const liked = likedIds.has(commentId);
  return (
    <CommentLikeButton
      key={`${commentId}:${likeCount}:${liked}`}
      bookId={bookId}
      commentId={commentId}
      likeCount={likeCount}
      liked={liked}
    />
  );
}

/** Report the book or its author; hidden from the author themselves. */
async function BookReport(props: {
  bookId: string;
  authorId: string;
  author: string;
}) {
  const actor = await getCurrentUser();
  if (actor?.id === props.authorId) return null;
  return (
    <ReportButton
      signedIn={Boolean(actor)}
      className="book-report"
      targets={[
        { type: "BOOK", id: props.bookId, label: "Bu kitabı" },
        { type: "USER", id: props.authorId, label: `Yazarı (${props.author})` },
      ]}
    />
  );
}
async function CommentReport(props: {
  bookId: string;
  commentId: string;
  userId: string;
  name: string;
}) {
  const { actor } = await getCommentLikeViewer(props.bookId);
  if (actor?.id === props.userId) return null;
  return (
    <ReportButton
      signedIn={Boolean(actor)}
      className="comment-report"
      targets={[
        { type: "COMMENT", id: props.commentId, label: "Bu yorumu" },
        { type: "USER", id: props.userId, label: props.name },
      ]}
    />
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookDetail {...props} />
    </Suspense>
  );
}
