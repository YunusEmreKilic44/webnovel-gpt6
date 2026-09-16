import Link from "next/link";
import { BookCard } from "@/components/book-card";
import { BookOpen, Search } from "@/components/icons";
import { getCatalog } from "@/modules/catalog/queries";
import { genres } from "@/lib/utils";
export const metadata = { title: "Hikâyeleri keşfet" };
export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const genre = typeof params.genre === "string" ? params.genre : "Tümü";
  const sort = typeof params.sort === "string" ? params.sort : "recent";
  const completed = params.completed === "true";
  const books = await getCatalog({ q, genre, sort, completed });
  return (
    <div className="catalog-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> SANA GÖRE BİR DÜNYA VAR
          </div>
          <h1>
            Hikâyelerin arasında kaybol<span className="accent-text">.</span>
          </h1>
          <p>Merak ettiğin dünyayı bul. Gerisini ilk sayfaya bırak.</p>
        </div>
      </div>
      <form className="catalog-toolbar" action="/kesfet">
        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Kitap veya yazar adı"
          aria-label="Kitap veya yazar adı"
          maxLength={100}
        />
        <select
          className="input"
          name="genre"
          aria-label="Tür"
          defaultValue={genre}
        >
          {genres.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select
          className="input"
          name="sort"
          aria-label="Sıralama"
          defaultValue={sort}
        >
          <option value="recent">Son güncellenen</option>
          <option value="rating">En yüksek puan</option>
        </select>
        <label className="check-field">
          <input
            type="checkbox"
            name="completed"
            value="true"
            defaultChecked={completed}
          />
          Tamamlananlar
        </label>
        <button className="button button-dark" type="submit">
          <Search size={15} />
          Ara
        </button>
      </form>
      <p className="catalog-count">
        {books.length} hikâye{" "}
        {q ? `· “${q}” için sonuçlar` : "keşfedilmeyi bekliyor"}
      </p>
      {books.length ? (
        <div className="book-grid">
          {books.map((book) => (
            <BookCard book={book} key={book.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={32} />
          <h2>Bu sayfa henüz yazılmamış.</h2>
          <p>
            Aradığın hikâyeyi bulamadık. Başka bir kelime veya tür
            deneyebilirsin.
          </p>
          <Link href="/kesfet" className="button button-outline">
            <BookOpen size={16} />
            Tüm hikâyelere dön
          </Link>
        </div>
      )}
    </div>
  );
}
