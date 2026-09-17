import Link from "next/link";
import { BookCover } from "./book-cover";
import { BookOpen, Star } from "./icons";
import type { CatalogBook } from "@/modules/catalog/queries";

export function BookCard({ book }: { book: CatalogBook }) {
  return (
    <Link href={`/kitap/${book.slug}`} className="book-card">
      <div className="book-card-image">
        <BookCover
          title={book.title}
          cover={book.cover}
          author={book.author}
          subtitle={book.subtitle}
        />
        <div className="cover-labels">
          {book.storyStatus === "COMPLETED" && (
            <span className="cover-label">Tamamlandı</span>
          )}
          {book.premiumStatus === "ACTIVE" && (
            <span className="cover-label">Premium</span>
          )}
        </div>
      </div>
      <div className="book-card-genre">{book.genre}</div>
      <h3>{book.title}</h3>
      <p>{book.author}</p>
      <div className="book-card-meta">
        <span>
          <Star size={12} fill="currentColor" />{" "}
          {book.averageRating > 0
            ? book.averageRating.toLocaleString("tr-TR")
            : "Yeni"}
        </span>
        <span>
          <BookOpen size={12} /> {book.chapterCount} bölüm
        </span>
      </div>
    </Link>
  );
}
