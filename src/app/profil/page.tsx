import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDb } from "@/db";
import { AccountNavigation } from "@/components/account-navigation";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { Avatar } from "@/components/avatar";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Feather,
  Library,
  Settings2,
} from "@/components/icons";

export const metadata = {
  title: "Profilim",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <div className="account-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            SENİN HİKÂYEN
          </div>
          <h1>
            Profilim<span className="accent-text">.</span>
          </h1>
          <p>Okuduğun dünyalar, yazdığın satırlar.</p>
        </div>
      </div>
      <AccountNavigation active="profile" />
      <Suspense fallback={<BlockSkeleton label="Profil yükleniyor" rows={5} />}>
        <Profile />
      </Suspense>
    </div>
  );
}

async function Profile() {
  const user = await requireUser();
  return (
    <>
      <section className="profile-overview">
        <Avatar
          name={user.name}
          url={user.avatarUrl}
          className="profile-avatar"
          size={90}
        />
        <div className="profile-identity">
          <span className="section-eyebrow">
            {user.role === "admin" ? "YÖNETİCİ" : "SATIR OKURU"}
          </span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="profile-verification">
            <CheckCircle2 size={14} />
            {user.emailVerified
              ? "E-posta doğrulandı"
              : "E-posta doğrulaması bekleniyor"}
          </span>
        </div>
        <Link href={`/yazar/${user.slug}`} className="button button-outline">
          Herkese açık profilim
        </Link>
        <Link href="/ayarlar" className="button button-outline">
          <Settings2 size={16} />
          Profili düzenle
        </Link>
      </section>
      <Suspense
        fallback={<BlockSkeleton label="Hesap özeti yükleniyor" rows={3} />}
      >
        <ProfileStats userId={user.id} />
      </Suspense>
      <section className="profile-stories">
        <div className="section-heading">
          <h2>Yazdığım hikâyeler</h2>
          <Link href="/studio">
            Stüdyoya git <ArrowRight size={15} />
          </Link>
        </div>
        <Suspense fallback={<BlockSkeleton label="Hikâyelerin yükleniyor" />}>
          <MyStories userId={user.id} />
        </Suspense>
      </section>
    </>
  );
}

async function ProfileStats({ userId }: { userId: string }) {
  const db = getDb();
  const [saved, progress, written] = await Promise.all([
    db.libraryEntry.count({ where: { userId } }),
    db.readingProgress.count({ where: { userId } }),
    db.book.count({ where: { authorId: userId } }),
  ]);
  return (
    <div className="profile-stats">
      <Link href="/kutuphanem">
        <Library size={21} />
        <strong>{saved}</strong>
        <span>Kütüphanemdeki hikâye</span>
      </Link>
      <Link href="/kutuphanem">
        <BookOpen size={21} />
        <strong>{progress}</strong>
        <span>Okuma işaretim</span>
      </Link>
      <Link href="/studio">
        <Feather size={21} />
        <strong>{written}</strong>
        <span>Yazdığım hikâye</span>
      </Link>
    </div>
  );
}

async function MyStories({ userId }: { userId: string }) {
  const books = await getDb().book.findMany({
    where: { authorId: userId },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: { id: true, title: true, genres: true, status: true },
  });
  const statuses: Record<string, string> = {
    DRAFT: "Taslak",
    APPROVED: "Onaylandı",
    PUBLISHED: "Yayında",
    ARCHIVED: "Arşivde",
  };
  return books.length ? (
    <div className="profile-story-list">
      {books.map((book) => (
        <Link
          key={book.id}
          href={`/studio/books/${book.id}`}
          className="profile-story"
        >
          <BookOpen size={22} />
          <div>
            <h3>{book.title}</h3>
            <p>
              {book.genres.join(" · ")} · {statuses[book.status] ?? book.status}
            </p>
          </div>
          <ArrowRight size={17} />
        </Link>
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <Feather size={30} />
      <h3>İlk satırını yazmaya ne dersin?</h3>
      <p>Kendi dünyanı oluştur. Hikâyelerin burada biriksin.</p>
      <Link href="/studio/yeni" className="button button-dark">
        Hikâye yaz <ArrowRight size={16} />
      </Link>
    </div>
  );
}
