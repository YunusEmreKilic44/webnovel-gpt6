"use client";
import { useEffect, useRef, useState } from "react";

const accepted = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 3 * 1024 * 1024;
export const acceptedImageTypes = accepted.join(",");

export type PickedImage = { url: string; name: string; size: number };

export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Local state for an <input type="file"> image picker: an object URL for the
 * preview, the same type/size checks the server makes, and a reset that
 * follows the form (React resets uncontrolled fields after a successful action).
 */
export function useImagePick(onFormReset?: () => void) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const resetRef = useRef(onFormReset);
  useEffect(() => {
    resetRef.current = onFormReset;
  });

  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked.url);
  }, [picked]);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => {
      setPicked(null);
      setError("");
      resetRef.current?.();
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  function clear() {
    if (input.current) input.current.value = "";
    setPicked(null);
  }
  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    if (!file) return setPicked(null);
    if (!accepted.includes(file.type)) {
      clear();
      return setError("Yalnızca JPG, PNG veya WebP görseli seçebilirsin.");
    }
    if (file.size > maxBytes) {
      clear();
      return setError(
        `Bu görsel ${formatSize(file.size)}. En fazla 3 MB yükleyebilirsin.`,
      );
    }
    setSize(null);
    setPicked({
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    });
  }
  /** Pass to the preview <Image onLoad> to learn the picked file's dimensions. */
  function onPreviewLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    setSize({ w: img.naturalWidth, h: img.naturalHeight });
  }
  return { input, picked, error, size, clear, onChange, onPreviewLoad };
}
