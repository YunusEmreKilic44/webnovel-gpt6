import { PageSkeleton } from "@/components/loading-skeletons";
import { cache, Suspense } from "react";
import { BlockSkeleton, ButtonSkeleton } from "@/components/loading-skeletons";
import type { CatalogBook } from "@/modules/catalog/queries";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBookComments,
  getMyBookState,
  getPublicBook,
  getPublicChapters,
} from "@/modules/catalog/queries";
import { getCurrentUser } from "@/lib/session";
import { BookCover } from "@/components/book-cover";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { interactAction } from "@/modules/community/actions";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Crown,
  Feather,
  LockKeyhole,
  MessageCircle,
  Star,
} from "@/components/icons";
import { date, money } from "@/lib/utils";

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
        <Link href={`/kesfet?genre=${encodeURIComponent(book.genre)}`}>
          {book.genre}
        </Link>
        <ChevronRight size={12} />
        <span>{book.title}</span>
      </div>
      <section className="book-detail-header">
        <BookCover
          title={book.title}
          subtitle={book.subtitle}
          author={book.author}
          cover={book.cover}
          className="detail-cover"
          sizes="(max-width: 700px) 130px, 220px"
          eager
        />
        <div className="detail-heading">
          <div className="button-row">
            <span className="label-pill">{book.genre}</span>
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
          <p className="detail-author">{book.author}</p>
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
          <div className="detail-stats">
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
              <ChapterList bookId={book.id} />
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
async function ReadLink({ bookId }: { bookId: string }) {
  const chapters = await getPublicChapters(bookId);
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
async function ChapterList({ bookId }: { bookId: string }) {
  const chapters = await getPublicChapters(bookId);
  const groups = [...new Set(chapters.map((c) => c.volumeId))].map((id) => ({
    first: chapters.find((c) => c.volumeId === id)!,
    chapters: chapters.filter((c) => c.volumeId === id),
  }));
  return (
    <>
      {groups.map(({ first, chapters: items }) => (
        <details className="chapter-group" open key={first.volumeId}>
          <summary>
            <ChevronDown size={14} />
            Cilt {first.volumePosition} · {first.volumeTitle}
            <small>{items.length} bölüm</small>
          </summary>
          {items.map((c) => (
            <Link href={`/oku/${c.id}`} className="chapter-row" key={c.id}>
              <span className="chapter-position">
                {String(c.position).padStart(2, "0")}
              </span>
              <span>{c.title}</span>
              <small>{Math.max(1, Math.ceil(c.wordCount / 200))} dk</small>
              {c.accessType === "PAID" ? (
                <span className="label-pill amber">
                  <LockKeyhole size={11} />
                  {money(c.priceMinor)}
                </span>
              ) : (
                <ChevronRight size={14} />
              )}
            </Link>
          ))}
        </details>
      ))}
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
          <span className="small-avatar">{comment.name.charAt(0)}</span>
          <div className="comment-body">
            <div className="comment-meta">
              <strong>{comment.name}</strong>
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
          </div>
        </article>
      ))}
    </div>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookDetail {...props} />
    </Suspense>
  );
}
