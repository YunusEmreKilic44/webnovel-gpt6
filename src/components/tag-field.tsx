"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import { MAX_BOOK_TAGS, parseTags } from "@/lib/tags";

export function TagField({ defaultValue = [] }: { defaultValue?: string[] }) {
  const id = useId();
  const { pending } = useFormStatus();
  const [tags, setTags] = useState(defaultValue);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function add() {
    const result = parseTags([...tags, draft]);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTags(result.tags);
    setDraft("");
    setError("");
  }

  return (
    <fieldset
      className="tag-field"
      disabled={pending}
      aria-describedby={`${id}-help`}
    >
      <legend>
        Etiketler <span>(isteğe bağlı)</span>
      </legend>
      <p id={`${id}-help`} className="tag-field-help">
        Kitabını anlatan kısa anahtar kelimeler yaz: isekai, yeni dünya, güçlü
        karakter. Açıklama veya cümle yazma. En fazla {MAX_BOOK_TAGS} etiket;
        her biri 2–32 karakter ve en fazla 3 kelime.
      </p>
      <div className="tag-field-chips" aria-label="Eklenen etiketler">
        {tags.map((tag) => (
          <span className="tag-field-chip" key={tag}>
            <input type="hidden" name="tags" value={tag} />
            <span>{tag}</span>
            <button
              type="button"
              aria-label={`${tag} etiketini kaldır`}
              onClick={() => {
                setTags(tags.filter((value) => value !== tag));
                setError("");
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-field-entry">
        <input
          id={id}
          name="tags"
          aria-label="Yeni etiket"
          placeholder="Örn. yeni dünya"
          value={draft}
          maxLength={400}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error ${id}-help` : `${id}-help`}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="button button-outline button-small"
          onClick={add}
          disabled={!draft.trim()}
        >
          <Plus size={15} aria-hidden="true" /> Ekle
        </button>
      </div>
      <div className="tag-field-footer">
        <small>
          Enter veya Ekle ile ekle. Birden fazla etiketi virgülle ayırabilirsin.
        </small>
        <span role="status">
          {tags.length}/{MAX_BOOK_TAGS}
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} className="form-message error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
