"use client";
import Image from "next/image";
import { SubmitButton } from "./action-form";
import { X } from "./icons";
import { imageSource } from "@/lib/cloudinary-loader";
import { acceptedImageTypes, formatSize, useImagePick } from "./use-image-pick";

/**
 * Profile picture picker with a live round preview. Lives inside an
 * <ActionForm action={updateAvatarAction}>; field names match that action.
 */
export function AvatarField({
  name,
  currentUrl,
}: {
  name: string;
  currentUrl: string | null;
}) {
  const { input, picked, error, clear, onChange } = useImagePick();
  const src = picked?.url ?? currentUrl;
  return (
    <div className="avatar-field">
      <span
        className={src ? "profile-avatar has-image" : "profile-avatar"}
        aria-live="polite"
      >
        {src ? (
          <Image
            key={src}
            src={src}
            alt="Profil resmi önizlemesi"
            fill
            sizes="96px"
            {...imageSource(src)}
          />
        ) : (
          name.charAt(0).toLocaleUpperCase("tr-TR")
        )}
      </span>
      <div className="avatar-field-controls">
        <div className="field">
          <label htmlFor="avatar-file">Profil resmi</label>
          <input
            ref={input}
            id="avatar-file"
            type="file"
            name="avatar"
            accept={acceptedImageTypes}
            aria-describedby="avatar-help"
            aria-invalid={error ? true : undefined}
            onChange={onChange}
          />
          {picked && (
            <small className="slide-file-meta">
              {picked.name} · {formatSize(picked.size)} · kaydedilmedi
            </small>
          )}
          {error && (
            <small className="slide-file-warning" role="alert">
              {error}
            </small>
          )}
          <small id="avatar-help">
            JPG, PNG veya WebP · En fazla 3 MB. Kare olarak ortadan kırpılır.
          </small>
        </div>
        <div className="button-row">
          <SubmitButton disabled={!picked}>Profil resmini kaydet</SubmitButton>
          {picked && (
            <button
              type="button"
              className="button button-outline"
              onClick={clear}
            >
              <X size={14} /> Seçimi kaldır
            </button>
          )}
          {currentUrl && !picked && (
            <SubmitButton
              className="button-outline"
              name="intent"
              value="remove"
            >
              Profil resmini kaldır
            </SubmitButton>
          )}
        </div>
      </div>
    </div>
  );
}
