"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Search, X } from "lucide-react";
import { bookGenres, MAX_BOOK_GENRES } from "@/lib/genres";

/** Shared by author and moderation forms; repeated fields submit via getAll. */
export function GenreField({ defaultValue = [] }: { defaultValue?: string[] }) {
  const id = useId();
  const { pending } = useFormStatus();
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const search = query.trim().toLocaleLowerCase("tr-TR");
  const visible = bookGenres.filter((genre) =>
    genre.toLocaleLowerCase("tr-TR").includes(search),
  );

  return (
    <fieldset
      className="genre-field"
      disabled={pending}
      aria-describedby={`${id}-help`}
    >
      <legend>Kategoriler</legend>
      <div className="genre-field-heading">
        <p id={`${id}-help`}>
          Hikâyene uyan en az 1, en fazla {MAX_BOOK_GENRES} kategori seç.
        </p>
        <span className="genre-field-count" role="status">
          {selected.length}/{MAX_BOOK_GENRES} seçili
        </span>
      </div>
      {selected.length >= MAX_BOOK_GENRES && (
        <p className="genre-field-limit" role="status">
          {selected.length > MAX_BOOK_GENRES
            ? `Kaydetmek için kategori sayısını ${MAX_BOOK_GENRES} veya altına indir.`
            : "Kategori sınırına ulaştın. Yeni bir kategori seçmek için öncekilerden birini kaldır."}
        </p>
      )}
      <div className="genre-field-selected" aria-label="Seçilen kategoriler">
        {selected.length ? (
          selected.map((genre) => (
            <button
              key={genre}
              type="button"
              className="genre-field-tag"
              aria-label={`${genre} kategorisini kaldır`}
              onClick={() =>
                setSelected(selected.filter((value) => value !== genre))
              }
            >
              {genre}
              <X size={14} aria-hidden="true" />
            </button>
          ))
        ) : (
          <span>Henüz kategori seçmedin. En az bir kategori seçmelisin.</span>
        )}
      </div>
      <label className="genre-field-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          aria-label="Kategori ara"
          placeholder="Kategori ara…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="genre-field-options">
        {bookGenres.map((genre) => (
          <label
            className="genre-field-option"
            key={genre}
            hidden={!visible.includes(genre)}
          >
            <input
              type="checkbox"
              name="genres"
              value={genre}
              checked={selected.includes(genre)}
              disabled={
                !selected.includes(genre) && selected.length >= MAX_BOOK_GENRES
              }
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, genre]
                    : selected.filter((value) => value !== genre),
                )
              }
            />
            <span>
              <Check size={14} aria-hidden="true" />
              {genre}
            </span>
          </label>
        ))}
        {!visible.length && (
          <p className="genre-field-empty">Bu aramayla eşleşen kategori yok.</p>
        )}
      </div>
    </fieldset>
  );
}
