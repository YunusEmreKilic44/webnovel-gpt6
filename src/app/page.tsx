import { cache, Suspense } from "react";
import {
  BlockSkeleton,
  BookGridSkeleton,
  HeroSkeleton,
} from "@/components/loading-skeletons";
import Image from "next/image";
import Link from "next/link";
import { getCatalog, getFeaturedChapterId } from "@/modules/catalog/queries";
import { BookCard } from "@/components/book-card";
import { BookCover } from "@/components/book-cover";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Flame,
  Star,
  TrendingUp,
} from "@/components/icons";
import {
  Sword,
  Rocket,
  Heart,
  ScanEye,
  Mountain,
  Drama,
  Sparkles,
} from "lucide-react";
import { genres, date } from "@/lib/utils";

const genreIcons = [Sparkles, Sword, Rocket, Heart, ScanEye, Mountain, Drama];
const getHomeCatalog = cache(() => getCatalog({ limit: 6 }));

export const revalidate = 60;

export default function Home() {
  return (
    <div className="home-page">
      <Suspense fallback={<HeroSkeleton />}>
        <HomeHero />
      </Suspense>
      <div className="home-container">
        <nav className="genre-tabs" aria-label="Hikâye türleri">
          {genres.map((genre, index) => {
            const Icon = genreIcons[index];
            return (
              <Link
                key={genre}
                href={
                  index
                    ? `/kesfet?genre=${encodeURIComponent(genre)}`
                    : "/kesfet"
                }
                className={index ? "genre-tab" : "genre-tab selected"}
              >
                <Icon size={17} />
                {index ? genre : "Tüm dünyalar"}
              </Link>
            );
          })}
        </nav>
        <section className="home-section">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">BİR BÖLÜM DAHA?</span>
              <h2>
                <Flame size={23} className="accent-text" />
                Radarına girecek seriler
              </h2>
            </div>
            <Link href="/kesfet">
              Tüm seriler <ArrowRight size={16} />
            </Link>
          </div>
          <Suspense fallback={<BookGridSkeleton />}>
            <HomeShelf />
          </Suspense>
        </section>
        <div className="home-lower">
          <section className="home-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">HİKÂYE DEVAM EDİYOR</span>
                <h2>Son güncellemeler</h2>
              </div>
              <Link href="/kesfet?sort=recent">
                Tümü <ArrowRight size={16} />
              </Link>
            </div>
            <Suspense
              fallback={
                <BlockSkeleton label="Son güncellemeler yükleniyor" rows={6} />
              }
            >
              <RecentBooks />
            </Suspense>
          </section>
          <section className="home-section ranking-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">OKURLARIN SEÇİMİ</span>
                <h2>
                  <TrendingUp size={22} />
                  En yüksek puanlılar
                </h2>
              </div>
            </div>
            <Suspense
              fallback={<BlockSkeleton label="Sıralama yükleniyor" rows={5} />}
            >
              <RankedBooks />
            </Suspense>
            <Link href="/kesfet?sort=rating" className="ranking-more">
              Sıralamayı gör <ArrowRight size={15} />
            </Link>
          </section>
        </div>
        <section className="writer-band">
          <div>
            <span className="section-eyebrow">SIRADAKİ EVREN SENİN OLSUN</span>
            <h2>Kendi hikâyenin kahramanı ol.</h2>
          </div>
          <Link href="/studio/yeni" className="button button-outline">
            Yazmaya başla <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </div>
  );
}

async function HomeHero() {
  // Both reads are independent, so the hero never waits on a second round trip
  // to learn which chapter its primary button should open.
  const [catalog, firstChapterId] = await Promise.all([
    getHomeCatalog(),
    getFeaturedChapterId(),
  ]);
  const featured = catalog[0];
  return (
    <section className="home-hero" aria-label="Öne çıkan hikâye">
      <Image
        className="hero-image"
        src={
          featured?.cover && featured.cover !== "ember"
            ? `/art/${featured.cover}.png`
            : "/art/hero.png"
        }
        alt=""
        fill
        loading="eager"
        fetchPriority="high"
        quality={60}
        sizes="100vw"
      />
      <div className="hero-shade" />
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="feature-tag">
            <Flame size={15} fill="currentColor" /> HAFTANIN HİKÂYESİ
          </span>
          <div className="hero-genres">
            <span>{featured?.genre ?? "Webnovel"}</span>
            <span>ORİJİNAL SERİ</span>
            <span>
              {featured?.storyStatus === "COMPLETED"
                ? "Tamamlandı"
                : "Devam ediyor"}
            </span>
          </div>
          <h1>{featured?.title ?? "Yeni dünyalar seni bekliyor."}</h1>
          <p>
            {featured?.description ??
              "İlk hikâyeni yaz ve okuyucularla buluştur."}
          </p>
          {featured && (
            <div className="hero-meta">
              <span className="rating">
                <Star size={15} fill="currentColor" />{" "}
                {featured.averageRating > 0
                  ? featured.averageRating.toLocaleString("tr-TR")
                  : "Yeni"}
              </span>
              <span>{featured.chapterCount} bölüm</span>
              <span>{featured.author}</span>
            </div>
          )}
          <div className="hero-actions">
            <Link
              href={firstChapterId ? `/oku/${firstChapterId}` : "/studio/yeni"}
              className="button button-dark"
            >
              <BookOpen size={17} />
              {firstChapterId ? "Okumaya başla" : "Hikâyeni yaz"}
              <ArrowRight size={17} />
            </Link>
            {featured && (
              <Link
                href={`/kitap/${featured.slug}`}
                className="button button-glass"
              >
                Seriyi incele <ChevronRight size={17} />
              </Link>
            )}
          </div>
        </div>
        <div className="hero-edition">
          <span>SPOTLIGHT</span>
          <strong>
            01<span> / {String(catalog.length).padStart(2, "0")}</span>
          </strong>
        </div>
      </div>
    </section>
  );
}
async function HomeShelf() {
  const catalog = await getHomeCatalog();
  return (
    <>
      {catalog.length ? (
        <div className="book-grid">
          {catalog.slice(0, 6).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BookOpen size={36} />
          <h2>İlk hikâye seninki olsun.</h2>
          <Link href="/studio/yeni" className="button button-dark">
            Yazmaya başla
          </Link>
        </div>
      )}
    </>
  );
}
async function RecentBooks() {
  const recent = await getCatalog({ sort: "recent", limit: 6 });
  return (
    <div className="update-list">
      {recent.slice(0, 6).map((book) => (
        <Link
          href={`/kitap/${book.slug}`}
          className="update-item"
          key={book.id}
        >
          <BookCover title={book.title} cover={book.cover} sizes="48px" />
          <div>
            <h3>{book.title}</h3>
            <p>
              {book.genre} <span>·</span> {book.author}
            </p>
            <small>{date(book.updatedAt)}</small>
          </div>
          <span className="update-chapters">
            {book.chapterCount} bölüm
            <ChevronRight size={15} />
          </span>
        </Link>
      ))}
    </div>
  );
}
async function RankedBooks() {
  const ranked = await getCatalog({ sort: "rating", limit: 5 });
  return (
    <div className="ranking-list">
      {ranked.slice(0, 5).map((book, index) => (
        <Link
          href={`/kitap/${book.slug}`}
          key={book.id}
          className="ranking-item"
        >
          <span className="rank-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <BookCover title={book.title} cover={book.cover} sizes="48px" />
          <div>
            <h3>{book.title}</h3>
            <p>{book.genre}</p>
            <span className="rating">
              <Star size={12} fill="currentColor" />{" "}
              {book.averageRating > 0
                ? book.averageRating.toLocaleString("tr-TR")
                : "Yeni"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
