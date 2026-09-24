import { Suspense } from "react";
import { BookGridSkeleton } from "@/components/loading-skeletons";
import Link from "next/link";
import Form from "next/form";
import { BookCard } from "@/components/book-card";
import { BookOpen, Check, Search, X } from "@/components/icons";
import {
  getCatalog,
  getGenreCounts,
  getPopularTags,
} from "@/modules/catalog/queries";
import { normalizeTag, tagKey } from "@/lib/tags";
import { genres } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Hikâyeleri keşfet" };

type Filters = {
  q: string;
  genre: string;
  tag: string;
  sort: "recent" | "rating";
  completed: boolean;
};
const sorts = [
  { value: "recent", label: "Son güncellenen" },
  { value: "rating", label: "En yüksek puan" },
] as const;

/** Discovery URL for these filters; defaults are left out to keep links short. */
function discoverHref(filters: Filters, change: Partial<Filters> = {}) {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.genre !== "Tümü") params.set("genre", next.genre);
  if (next.tag) params.set("tag", next.tag);
  if (next.sort !== "recent") params.set("sort", next.sort);
  if (next.completed) params.set("completed", "true");
  const query = params.toString();
  return query ? `/kesfet?${query}` : "/kesfet";
}

export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawGenre = typeof params.genre === "string" ? params.genre : "";
  const filters: Filters = {
    q: typeof params.q === "string" ? params.q.trim().slice(0, 100) : "",
    tag:
      typeof params.tag === "string"
        ? normalizeTag(params.tag.slice(0, 100))
        : "",
    // Unknown genres from old or hand-edited links fall back to everything.
    genre: (genres as readonly string[]).includes(rawGenre) ? rawGenre : "Tümü",
    sort: params.sort === "rating" ? "rating" : "recent",
    completed: params.completed === "true",
  };
  const active =
    filters.q || filters.tag || filters.genre !== "Tümü" || filters.completed;
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

      <Form className="catalog-search" action="/kesfet" role="search">
        <Search size={18} aria-hidden="true" />
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Kitap, yazar veya etiket ara"
          aria-label="Kitap, yazar veya etiket ara"
          maxLength={100}
        />
        {/* A new search keeps the chosen category, order and status. */}
        {filters.genre !== "Tümü" && (
          <input type="hidden" name="genre" value={filters.genre} />
        )}
        {filters.tag && <input type="hidden" name="tag" value={filters.tag} />}
        {filters.sort !== "recent" && (
          <input type="hidden" name="sort" value={filters.sort} />
        )}
        {filters.completed && (
          <input type="hidden" name="completed" value="true" />
        )}
        <button className="button button-dark" type="submit">
          Ara
        </button>
      </Form>

      <div className="catalog-layout">
        <aside className="catalog-filters" aria-label="Filtreler">
          <Suspense fallback={<GenreListSkeleton />}>
            <GenreList filters={filters} />
          </Suspense>
          <section className="tag-filter" aria-labelledby="tag-filter-title">
            <h2 id="tag-filter-title">Etiketler</h2>
            <Form action="/kesfet" className="tag-filter-form">
              {filters.q && <input type="hidden" name="q" value={filters.q} />}
              {filters.genre !== "Tümü" && (
                <input type="hidden" name="genre" value={filters.genre} />
              )}
              {filters.sort !== "recent" && (
                <input type="hidden" name="sort" value={filters.sort} />
              )}
              {filters.completed && (
                <input type="hidden" name="completed" value="true" />
              )}
              <label className="field">
                Etikete göre filtrele
                <input
                  name="tag"
                  key={filters.tag}
                  defaultValue={filters.tag}
                  maxLength={32}
                  placeholder="Örn. isekai"
                />
              </label>
              <button
                type="submit"
                className="button button-outline button-small"
              >
                Uygula
              </button>
            </Form>
            <Suspense fallback={<p className="muted">Etiketler yükleniyor…</p>}>
              <TagList filters={filters} />
            </Suspense>
          </section>
        </aside>

        <div className="catalog-results">
          <div className="catalog-options">
            <nav className="segmented" aria-label="Sıralama">
              {sorts.map((option) => (
                <Link
                  key={option.value}
                  href={discoverHref(filters, { sort: option.value })}
                  aria-current={
                    filters.sort === option.value ? "page" : undefined
                  }
                  scroll={false}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
            <Link
              className={cn("filter-toggle", filters.completed && "is-on")}
              href={discoverHref(filters, { completed: !filters.completed })}
              scroll={false}
            >
              <span className="filter-toggle-box" aria-hidden="true">
                {filters.completed && <Check size={12} strokeWidth={3} />}
              </span>
              Yalnız tamamlananlar
              <span className="sr-only">
                {filters.completed ? " (açık)" : " (kapalı)"}
              </span>
            </Link>
          </div>

          {active && (
            <div className="active-filters" aria-label="Uygulanan filtreler">
              {filters.q && (
                <Link href={discoverHref(filters, { q: "" })} scroll={false}>
                  “{filters.q}” <X size={13} aria-label="kaldır" />
                </Link>
              )}
              {filters.tag && (
                <Link href={discoverHref(filters, { tag: "" })} scroll={false}>
                  {filters.tag} <X size={13} aria-label="etiketi kaldır" />
                </Link>
              )}
              {filters.genre !== "Tümü" && (
                <Link
                  href={discoverHref(filters, { genre: "Tümü" })}
                  scroll={false}
                >
                  {filters.genre} <X size={13} aria-label="kaldır" />
                </Link>
              )}
              {filters.completed && (
                <Link
                  href={discoverHref(filters, { completed: false })}
                  scroll={false}
                >
                  Tamamlananlar <X size={13} aria-label="kaldır" />
                </Link>
              )}
              <Link className="text-link" href="/kesfet" scroll={false}>
                Tümünü temizle
              </Link>
            </div>
          )}

          <Suspense
            key={JSON.stringify(filters)}
            fallback={<BookGridSkeleton />}
          >
            <CatalogResults filters={filters} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function TagList({ filters }: { filters: Filters }) {
  const tags = await getPopularTags();
  return tags.length ? (
    <nav className="book-tags" aria-label="Popüler etiketler">
      {tags.map((tag) => (
        <Link
          key={tag.key}
          href={discoverHref(filters, { tag: tag.name })}
          aria-current={tagKey(filters.tag) === tag.key ? "page" : undefined}
          scroll={false}
        >
          {tag.name} <small>{tag.count}</small>
        </Link>
      ))}
    </nav>
  ) : (
    <p className="muted">
      Yayındaki kitaplara eklenen etiketler burada görünecek.
    </p>
  );
}

async function GenreList({ filters }: { filters: Filters }) {
  const counts = await getGenreCounts();
  return (
    <nav className="genre-filter" aria-labelledby="genre-filter-title">
      <h2 id="genre-filter-title">Kategoriler</h2>
      <ul>
        {genres.map((genre) => {
          const count = counts[genre] ?? 0;
          const selected = filters.genre === genre;
          return (
            <li key={genre}>
              <Link
                href={discoverHref(filters, { genre })}
                aria-current={selected ? "page" : undefined}
                className={cn(!count && !selected && "is-empty")}
                scroll={false}
              >
                <span>{genre === "Tümü" ? "Tüm kategoriler" : genre}</span>
                <small>{count}</small>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function GenreListSkeleton() {
  return (
    <div className="genre-filter" aria-busy="true" aria-label="Kategoriler">
      <h2>Kategoriler</h2>
      <ul>
        {genres.map((genre) => (
          <li key={genre}>
            <span className="skeleton genre-filter-skeleton" />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function CatalogResults({ filters }: { filters: Filters }) {
  const books = await getCatalog(filters);
  return (
    <>
      <p className="catalog-count" aria-live="polite">
        {books.length} hikâye
        {filters.q
          ? ` · “${filters.q}” için sonuçlar`
          : filters.genre !== "Tümü"
            ? ` · ${filters.genre}`
            : " keşfedilmeyi bekliyor"}
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
            Bu filtrelerle eşleşen bir hikâye bulamadık. Başka bir kelime veya
            kategori veya etiket deneyebilirsin.
          </p>
          <Link href="/kesfet" className="button button-outline">
            <BookOpen size={16} />
            Tüm hikâyelere dön
          </Link>
        </div>
      )}
    </>
  );
}
