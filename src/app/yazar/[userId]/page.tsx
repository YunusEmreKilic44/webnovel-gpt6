import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getAuthorProfile } from "@/modules/catalog/queries";
import { Avatar } from "@/components/avatar";
import { BookCard } from "@/components/book-card";
import { ReportButton } from "@/components/report-button";
import { BlockSkeleton } from "@/components/loading-skeletons";
import {
  BookOpen,
  Feather,
  MessageCircle,
  Settings2,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
} from "@/components/icons";
import { getDb } from "@/db";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { getFollowState, getProfileComments } from "@/modules/social/service";
import {
  addProfileCommentAction,
  followAction,
  removeProfileCommentAction,
} from "@/modules/social/actions";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getAuthorProfile(userId);
  return profile
    ? {
        title: `${profile.user.name} · Yazar`,
        description: `${profile.user.name} adlı yazarın Satır'daki hikâyeleri.`,
      }
    : { title: "Yazar bulunamadı" };
}

const joined = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

export default function AuthorPage(props: Props) {
  return (
    <div className="author-page">
      <Suspense fallback={<BlockSkeleton label="Profil yükleniyor" rows={4} />}>
        <AuthorProfile {...props} />
      </Suspense>
    </div>
  );
}

async function AuthorProfile({ params }: Props) {
  const { userId } = await params;
  const profile = await getAuthorProfile(userId);
  if (!profile) notFound();
  const { user, books, stats } = profile;
  return (
    <>
      <section className="author-hero">
        <Avatar
          name={user.name}
          url={user.avatarUrl}
          className="profile-avatar"
          size={96}
        />
        <div className="author-identity">
          <span className="section-eyebrow">
            {stats.books ? "SATIR YAZARI" : "SATIR OKURU"}
          </span>
          <h1>{user.name}</h1>
          <p>{joined.format(user.createdAt)} tarihinden beri Satır’da</p>
        </div>
        <Suspense fallback={null}>
          <AuthorActions userId={user.id} name={user.name} />
        </Suspense>
      </section>

      <dl className="author-stats">
        <div>
          <dt>
            <Feather size={16} /> Hikâye
          </dt>
          <dd>{stats.books}</dd>
        </div>
        <div>
          <dt>
            <BookOpen size={16} /> Yayında bölüm
          </dt>
          <dd>{stats.chapters.toLocaleString("tr-TR")}</dd>
        </div>
        <div>
          <dt>
            <BookOpen size={16} /> Okunma
          </dt>
          <dd>{stats.reads.toLocaleString("tr-TR")}</dd>
        </div>
        <div>
          <dt>
            <Star size={16} /> Ortalama puan
          </dt>
          <dd>
            {stats.rating
              ? stats.rating.toLocaleString("tr-TR", {
                  maximumFractionDigits: 1,
                })
              : "—"}
          </dd>
        </div>
      </dl>

      <section className="home-section">
        <div className="section-heading">
          <h2>Hikâyeleri</h2>
        </div>
        {books.length ? (
          <div className="book-grid">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Feather size={30} />
            <h2>Henüz yayımlanmış hikâyesi yok.</h2>
            <p>Yayımladığı hikâyeler burada görünecek.</p>
          </div>
        )}
      </section>

      <Suspense
        fallback={<BlockSkeleton label="Yorumlar yükleniyor" rows={3} />}
      >
        <ProfileComments profileUserId={user.id} name={user.name} />
      </Suspense>
    </>
  );
}

/**
 * The owner edits their profile; everyone else can follow and report it.
 * Follower count is shown to all.
 */
async function AuthorActions({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const actor = await getCurrentUser();
  const { followers, following } = await getFollowState(
    getDb(),
    userId,
    actor?.id ?? null,
  );
  const count = (
    <span className="follower-count">
      <strong>{followers.toLocaleString("tr-TR")}</strong> takipçi
    </span>
  );
  if (actor?.id === userId)
    return (
      <div className="author-actions">
        {count}
        <Link href="/ayarlar" className="button button-outline">
          <Settings2 size={16} /> Profilini düzenle
        </Link>
      </div>
    );
  return (
    <div className="author-actions">
      {count}
      {actor ? (
        <ActionForm action={followAction} className="follow-form">
          <input type="hidden" name="authorId" value={userId} />
          <input type="hidden" name="follow" value={String(!following)} />
          <SubmitButton className={following ? "button-outline" : undefined}>
            {following ? (
              <>
                <UserCheck size={16} /> Takip ediliyor
              </>
            ) : (
              <>
                <UserPlus size={16} /> Takip et
              </>
            )}
          </SubmitButton>
        </ActionForm>
      ) : (
        <Link href="/giris" className="button button-dark">
          <UserPlus size={16} /> Takip et
        </Link>
      )}
      <ReportButton
        signedIn={Boolean(actor)}
        label="Profili şikâyet et"
        className="author-report"
        targets={[{ type: "USER", id: userId, label: name }]}
      />
    </div>
  );
}

const commentDate = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

async function ProfileComments({
  profileUserId,
  name,
}: {
  profileUserId: string;
  name: string;
}) {
  const [actor, comments] = await Promise.all([
    getCurrentUser(),
    getProfileComments(getDb(), profileUserId),
  ]);
  const own = actor?.id === profileUserId;
  return (
    <section
      className="profile-comments"
      aria-labelledby="profile-comments-title"
    >
      <div className="section-heading">
        <h2 id="profile-comments-title">
          <MessageCircle size={20} /> Yorumlar
          {comments.length > 0 && <small>{comments.length}</small>}
        </h2>
      </div>
      {actor ? (
        <ActionForm action={addProfileCommentAction} className="form-stack">
          <input type="hidden" name="profileUserId" value={profileUserId} />
          <label className="field">
            <span className="sr-only">Yorumun</span>
            <textarea
              name="body"
              required
              minLength={2}
              maxLength={1000}
              rows={3}
              placeholder={
                own
                  ? "Okurlarına bir not bırak…"
                  : `${name} için bir şeyler yaz…`
              }
            />
          </label>
          <div>
            <SubmitButton className="button-dark button-small">
              Yorumu paylaş
            </SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <p className="notice">
          Yorum yazmak için{" "}
          <Link className="text-link" href="/giris">
            giriş yap
          </Link>
          .
        </p>
      )}
      {comments.length === 0 ? (
        <p className="muted profile-comments-empty">Henüz yorum yok.</p>
      ) : (
        comments.map((comment) => {
          const mine = actor?.id === comment.author.id;
          return (
            <article className="comment" key={comment.id}>
              <Avatar
                name={comment.author.name}
                url={comment.author.avatarUrl}
                className="small-avatar"
                size={31}
              />
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>
                    <Link href={`/yazar/${comment.author.id}`}>
                      {comment.author.name}
                    </Link>
                  </strong>
                  <time dateTime={comment.createdAt.toISOString()}>
                    {commentDate.format(comment.createdAt)}
                  </time>
                </div>
                <p>{comment.body}</p>
                <div className="profile-comment-actions">
                  {(mine || own) && (
                    <ActionForm action={removeProfileCommentAction}>
                      <input
                        type="hidden"
                        name="commentId"
                        value={comment.id}
                      />
                      <input
                        type="hidden"
                        name="profileUserId"
                        value={profileUserId}
                      />
                      <SubmitButton className="report-trigger">
                        <Trash2 size={14} /> Sil
                      </SubmitButton>
                    </ActionForm>
                  )}
                  {!mine && (
                    <ReportButton
                      signedIn={Boolean(actor)}
                      className="comment-report"
                      targets={[
                        {
                          type: "PROFILE_COMMENT",
                          id: comment.id,
                          label: "Bu yorumu",
                        },
                        {
                          type: "USER",
                          id: comment.author.id,
                          label: comment.author.name,
                        },
                      ]}
                    />
                  )}
                </div>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
