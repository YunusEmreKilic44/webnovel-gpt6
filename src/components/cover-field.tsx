"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "./icons";
import { imageSource } from "@/lib/cloudinary-loader";
import { acceptedImageTypes, formatSize, useImagePick } from "./use-image-pick";

/**
 * Book cover picker: upload from the computer or choose a preset, with a live
 * preview drawn like <BookCover>. Field names match createBookAction and
 * updateBookCoverAction (coverImage, cover, removeCoverImage).
 */
export function CoverField({
  fieldId,
  presets,
  initialPreset,
  currentImageUrl,
  title: initialTitle = "",
  author,
}: {
  fieldId: string;
  presets: { value: string; label: string }[];
  initialPreset: string;
  /** Set only when the book already has an uploaded cover. */
  currentImageUrl?: string | null;
  title?: string;
  author?: string;
}) {
  const [preset, setPreset] = useState(initialPreset);
  const [removeUpload, setRemoveUpload] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const { input, picked, error, size, clear, onChange, onPreviewLoad } =
    useImagePick(() => {
      setPreset(initialPreset);
      setRemoveUpload(false);
    });

  // On the new-book form the title is typed above; mirror it onto the preview.
  useEffect(() => {
    const field = input.current?.form?.elements.namedItem("title");
    if (!(field instanceof HTMLInputElement)) return;
    const sync = () => setTitle(field.value);
    field.addEventListener("input", sync);
    return () => field.removeEventListener("input", sync);
  }, [input]);

  const showUploaded = Boolean(currentImageUrl) && !removeUpload;
  const src =
    picked?.url ?? (showUploaded ? currentImageUrl! : `/art/${preset}.png`);
  const isArtwork = !picked && !showUploaded;
  const status = picked
    ? "Yeni kapak · kaydedilmedi"
    : showUploaded
      ? "Yüklenmiş kapak"
      : `Hazır kapak · ${presets.find((p) => p.value === preset)?.label}`;
  const ratio = size ? size.w / size.h : 2 / 3;
  const offRatio = picked && size && Math.abs(ratio - 2 / 3) > 0.12;

  return (
    <div className="cover-field">
      <div className="cover-field-preview" aria-live="polite">
        <div className="book-cover">
          <Image
            key={src}
            src={src}
            alt={`${title || "Kitap"} kapak önizlemesi`}
            fill
            {...imageSource(src)}
            sizes="200px"
            onLoad={onPreviewLoad}
          />
          {isArtwork && (
            <div className="cover-caption">
              <span className="cover-series">SATIR ORIGINAL</span>
              <strong className="cover-title">
                {title.trim() || "Kitabının adı"}
              </strong>
              {author && <span className="cover-author">{author}</span>}
            </div>
          )}
        </div>
        <div className="cover-field-thumb" aria-hidden="true">
          <div className="book-cover">
            <Image
              key={src}
              src={src}
              alt=""
              fill
              {...imageSource(src)}
              sizes="54px"
            />
          </div>
          <span>Liste görünümü</span>
        </div>
        <span className={picked ? "label-pill amber" : "label-pill gray"}>
          {status}
        </span>
      </div>

      <div className="cover-field-controls">
        <div className="field">
          <label htmlFor={`${fieldId}-file`}>Bilgisayardan kapak yükle</label>
          <div className="slide-file-row">
            <input
              ref={input}
              id={`${fieldId}-file`}
              type="file"
              name="coverImage"
              accept={acceptedImageTypes}
              aria-describedby={`${fieldId}-help`}
              aria-invalid={error ? true : undefined}
              onChange={onChange}
            />
            {picked && (
              <button
                type="button"
                className="button button-outline button-small"
                onClick={clear}
              >
                <X size={14} /> Seçimi kaldır
              </button>
            )}
          </div>
          {picked && (
            <small className="slide-file-meta">
              {picked.name} · {formatSize(picked.size)}
              {size && ` · ${size.w}×${size.h}`}
            </small>
          )}
          {offRatio && (
            <small className="slide-file-warning">
              Kapaklar 2:3 dikey oranda gösterilir; bu görselin kenarları
              kırpılacak.
            </small>
          )}
          {error && (
            <small className="slide-file-warning" role="alert">
              {error}
            </small>
          )}
          <small id={`${fieldId}-help`}>
            JPG, PNG veya WebP · En fazla 3 MB. Önerilen: 1200×1800 (2:3 dikey).
            Kapağın üzerine başlık yazılmaz; görselin kendisi gösterilir.
          </small>
        </div>

        <fieldset className="slide-preset-picker">
          <legend>
            Hazır kapak illüstrasyonu
            <small> · yüklenmiş kapak yoksa kullanılır</small>
          </legend>
          <div className="cover-picker">
            {presets.map(({ value, label }) => (
              <label className={`cover-choice cover-${value}`} key={value}>
                <input
                  type="radio"
                  name="cover"
                  value={value}
                  checked={preset === value}
                  onChange={() => setPreset(value)}
                  aria-label={label}
                />
                <span />
              </label>
            ))}
          </div>
        </fieldset>

        {currentImageUrl && (
          <label className="check-field">
            <input
              type="checkbox"
              name="removeCoverImage"
              checked={removeUpload}
              disabled={Boolean(picked)}
              onChange={(event) => setRemoveUpload(event.target.checked)}
            />
            Yüklenmiş kapağı kaldır ve hazır illüstrasyonu kullan
          </label>
        )}
      </div>
    </div>
  );
}
