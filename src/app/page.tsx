import { cache, Suspense } from "react";
import {
  BlockSkeleton,
  BookGridSkeleton,
  HeroSkeleton,
} from "@/components/loading-skeletons";
import Link from "next/link";
import { announcementExcerpt } from "@/modules/site-content/announcement-content";
import { getCatalog } from "@/modules/catalog/queries";
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
import { date } from "@/lib/utils";
import { HomeSlider } from "@/components/home-slider";
import {
  getAnnouncements,
  getHomeSlides,
} from "@/modules/site-content/queries";

const getHomeCatalog = cache(() => getCatalog({ limit: 6 }));

export const revalidate = 60;

export default function Home() {
  return (
    <div className="home-page">
      <Suspense fallback={<HeroSkeleton />}>
        <HomeHero />
      </Suspense>
      <div className="home-container">
        <Suspense fallback={null}>
          <HomeAnnouncements />
        </Suspense>
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
  const slides = await getHomeSlides();
  return (
    <HomeSlider
      key={slides.map((slide) => slide.id).join(",")}
      slides={slides}
    />
  );
}
async function HomeAnnouncements() {
  const announcements = await getAnnouncements();
  if (!announcements.length) return null;
  return (
    <section className="home-announcements" aria-label="Duyurular">
      <h2>Duyurular</h2>
      <Link className="text-link" href="/duyurular">
        Tüm duyurular →
      </Link>
      {announcements.map((item) => (
        <article className="announcement-card" key={item.id}>
          <h3>
            <Link href={`/duyurular/${item.id}`}>{item.title}</Link>
          </h3>
          <p>{announcementExcerpt(item.body)}</p>
          <Link className="text-link" href={`/duyurular/${item.id}`}>
            Duyuruyu oku <ArrowRight size={15} />
          </Link>
        </article>
      ))}
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
          <BookCover
            title={book.title}
            cover={book.cover}
            coverUrl={book.coverUrl}
            sizes="48px"
          />
          <div>
            <h3>{book.title}</h3>
            <p>
              {book.genres.join(" · ")} <span>·</span> {book.author}
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
          <BookCover
            title={book.title}
            cover={book.cover}
            coverUrl={book.coverUrl}
            sizes="48px"
          />
          <div>
            <h3>{book.title}</h3>
            <p>{book.genres.join(" · ")}</p>
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
