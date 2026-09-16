import Link from "next/link";
import { getCatalog } from "@/modules/catalog/queries";
import { BookCard } from "@/components/book-card";
import { BookCover } from "@/components/book-cover";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Feather,
  Sparkles,
  Star,
} from "@/components/icons";
import { genres } from "@/lib/utils";

export default async function Home() {
  const catalog = await getCatalog();
  const featured = catalog[0];
  return (
    <div className="home-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> HAYAL GÜCÜNÜN SINIRI YOK
          </div>
          <h1>
            Bir sonraki dünyanı keşfet<span className="accent-text">.</span>
          </h1>
          <p>Bir sayfa çevir. Bir hayata dokun. Hiç gitmediğin bir yere git.</p>
        </div>
        <span className="heading-decoration">✳</span>
      </div>
      <div className="genre-tabs">
        {genres.map((genre, i) => (
          <Link
            key={genre}
            className={i === 0 ? "genre-tab selected" : "genre-tab"}
            href={
              i === 0 ? "/kesfet" : `/kesfet?genre=${encodeURIComponent(genre)}`
            }
          >
            {i === 0 && <Sparkles size={14} />}
            {genre}
          </Link>
        ))}
      </div>
      <section className="feature-grid" aria-label="Öne çıkan hikâye">
        {featured ? (
          <div className="featured-story">
            <div className="feature-grain" />
            <div className="featured-copy">
              <div className="feature-tag">
                <Star size={12} fill="currentColor" /> EDİTÖRÜN SEÇİMİ
              </div>
              <h2>
                Bazı hikâyeler,
                <br />
                içinde bir dünya açar.
              </h2>
              <p>{featured.description.slice(0, 132)}…</p>
              <div className="featured-byline">
                <span className="small-avatar">
                  {featured.author.charAt(0)}
                </span>
                <span>
                  {featured.author}
                  <small>
                    {featured.genre} · {featured.chapterCount} bölüm
                  </small>
                </span>
              </div>
              <Link
                href={`/kitap/${featured.slug}`}
                className="button button-cream"
              >
                Hikâyeyi keşfet <ArrowRight size={16} />
              </Link>
            </div>
            <div className="featured-art">
              <div className="orb orb-one" />
              <div className="orb orb-two" />
              <span className="feature-star star-one">✦</span>
              <span className="feature-star star-two">✧</span>
              <BookCover
                title={featured.title}
                cover={featured.cover}
                author={featured.author}
                subtitle={featured.subtitle}
                className="hero-cover"
              />
              <div className="hero-book-shadow" />
            </div>
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
        <div className="discovery-note">
          <div className="note-top">
            <span>HİKÂYELERİN ARDINDA</span>
            <Feather size={20} strokeWidth={1.4} />
          </div>
          <div className="note-illustration">
            <span className="little-star">✦</span>
            <BookOpen size={59} strokeWidth={0.8} />
            <span className="little-star second">✧</span>
          </div>
          <h3>
            Henüz yazılmamış
            <br />
            dünyalar var.
          </h3>
          <p>
            Aklındaki karakterlere bir ses,
            <br />
            hayalindeki dünyaya bir ev ver.
          </p>
          <Link href="/studio/yeni">
            İlk satırını yaz <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="section-eyebrow">YENİ BİR HİKÂYEYE YER AÇ</span>
            <h2>Okuma listene çok yakışacak</h2>
          </div>
          <Link href="/kesfet">
            Tümünü keşfet <ArrowRight size={16} />
          </Link>
        </div>
        <div className="book-grid">
          {catalog.slice(0, 6).map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </section>
      <section className="home-section updates-section">
        <div className="section-heading">
          <div>
            <span className="section-eyebrow">HİKÂYE DEVAM EDİYOR</span>
            <h2>Yeni satırlar, yeni heyecanlar</h2>
          </div>
          <Link href="/kesfet">
            Son güncellenenler <ArrowRight size={16} />
          </Link>
        </div>
        <div className="update-list">
          {catalog.slice(0, 4).map((book, index) => (
            <Link
              href={`/kitap/${book.slug}`}
              className="update-item"
              key={book.id}
            >
              <span className="update-number">0{index + 1}</span>
              <BookCover title={book.title} cover={book.cover} />
              <div>
                <h3>{book.title}</h3>
                <p>
                  {book.author} <span>·</span> {book.genre}
                </p>
              </div>
              <span className="update-chapters">{book.chapterCount} bölüm</span>
              <ChevronRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      <div className="quote-strip">
        <span>“</span>
        <p>Bir hikâye okursun, dünya biraz daha büyür.</p>
        <span className="quote-line" />
        <small>SATIR’A HOŞ GELDİN</small>
      </div>
    </div>
  );
}
