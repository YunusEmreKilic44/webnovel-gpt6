"use client";
import { useState } from "react";
import Image from "next/image";
import { X } from "./icons";
import { imageSource } from "@/lib/cloudinary-loader";
import { acceptedImageTypes, formatSize, useImagePick } from "./use-image-pick";

/**
 * Upload / preset picker for a home slide with a live preview of what the
 * homepage will show after saving. Field names match saveSlideAction.
 */
export function SlideImageField({
  fieldId,
  currentImageUrl,
  initialPreset,
  presets,
  imageAlt,
}: {
  fieldId: string;
  /** Set only when the slide already has an uploaded image. */
  currentImageUrl?: string;
  initialPreset: string;
  presets: { value: string; label: string }[];
  imageAlt?: string;
}) {
  const [preset, setPreset] = useState(initialPreset);
  const [usePreset, setUsePreset] = useState(false);
  const {
    input,
    picked,
    error,
    size,
    clear: clearFile,
    onChange: onFile,
    onPreviewLoad,
  } = useImagePick(() => {
    setPreset(initialPreset);
    setUsePreset(false);
  });

  const presetLabel = presets.find((p) => p.value === preset)?.label ?? preset;
  const showUploaded = currentImageUrl && !usePreset;
  const src =
    picked?.url ?? (showUploaded ? currentImageUrl : `/art/${preset}.png`);
  const caption = picked
    ? "Yeni görsel · kaydedilmedi"
    : showUploaded
      ? "Mevcut yüklenmiş görsel"
      : `Hazır görsel · ${presetLabel}`;
  const portrait = picked && size && size.h > size.w;

  return (
    <div className="slide-image-field">
      <div className="slide-preview-frames" aria-live="polite">
        <figure className="admin-slide-preview">
          <Image
            key={src}
            src={src}
            alt={imageAlt || "Slayt görseli önizlemesi"}
            fill
            {...imageSource(src)}
            sizes="(max-width: 800px) 100vw, 760px"
            onLoad={onPreviewLoad}
          />
          <span className="admin-slide-preview-shade" aria-hidden="true" />
          <figcaption>
            <span className={picked ? "label-pill amber" : "label-pill gray"}>
              {caption}
            </span>
          </figcaption>
        </figure>
        {/* Phones crop the hero almost square; mirror .hero-image there. */}
        <figure className="admin-slide-preview is-mobile" aria-hidden="true">
          <Image
            key={src}
            src={src}
            alt=""
            fill
            {...imageSource(src)}
            sizes="160px"
          />
          <span className="admin-slide-preview-shade" />
          <figcaption>
            <span className="label-pill gray">Mobil</span>
          </figcaption>
        </figure>
      </div>

      <div className="field">
        <label htmlFor={`${fieldId}-file`}>Görsel yükle</label>
        <div className="slide-file-row">
          <input
            ref={input}
            id={`${fieldId}-file`}
            type="file"
            name="image"
            accept={acceptedImageTypes}
            aria-describedby={`${fieldId}-help`}
            aria-invalid={error ? true : undefined}
            onChange={onFile}
          />
          {picked && (
            <button
              type="button"
              className="button button-outline button-small"
              onClick={clearFile}
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
        {portrait && (
          <small className="slide-file-warning">
            Dikey bir görsel seçtin; ana sayfada kenarlarından kırpılacak.
          </small>
        )}
        {error && (
          <small className="slide-file-warning" role="alert">
            {error}
          </small>
        )}
        <small id={`${fieldId}-help`}>
          JPG, PNG veya WebP · En fazla 3 MB. Yatay görsel önerilir.
          {currentImageUrl && " Dosya seçmezsen mevcut görsel korunur."}
        </small>
      </div>

      <fieldset className="slide-preset-picker">
        <legend>
          Hazır görsel
          {currentImageUrl || picked ? (
            <small> · yüklenmiş görsel yoksa kullanılır</small>
          ) : null}
        </legend>
        <div className="slide-preset-options">
          {presets.map(({ value, label }) => (
            <label key={value} className="slide-preset-option">
              <input
                type="radio"
                name="imagePreset"
                value={value}
                checked={preset === value}
                onChange={() => setPreset(value)}
              />
              <span
                className="slide-preset-thumb"
                style={{ backgroundImage: `url(/art/${value}.png)` }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {currentImageUrl && (
        <label className="check-field">
          <input
            type="checkbox"
            name="usePreset"
            checked={usePreset}
            disabled={Boolean(picked)}
            onChange={(event) => setUsePreset(event.target.checked)}
          />
          Yüklenmiş görseli kaldır ve hazır görseli kullan
        </label>
      )}
    </div>
  );
}
