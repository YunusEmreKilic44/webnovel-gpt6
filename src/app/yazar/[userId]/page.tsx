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
import { BookOpen, Feather, Settings2, Star } from "@/components/icons";

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
    </>
  );
}

/** The owner edits their profile; everyone else can report it. */
async function AuthorActions({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const actor = await getCurrentUser();
  if (actor?.id === userId)
    return (
      <Link href="/ayarlar" className="button button-outline">
        <Settings2 size={16} /> Profilini düzenle
      </Link>
    );
  return (
    <ReportButton
      signedIn={Boolean(actor)}
      label="Profili şikâyet et"
      className="author-report"
      targets={[{ type: "USER", id: userId, label: name }]}
    />
  );
}
