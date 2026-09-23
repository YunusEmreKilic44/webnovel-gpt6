import type { ImageLoaderProps } from "next/image";

// Cloudinary resizes and picks the format itself, so next/image only needs
// to ask for the right width. Non-Cloudinary sources are returned unchanged.
const uploadSegment = "/image/upload/";

export function isCloudinaryUrl(src: string) {
  return src.startsWith("https://res.cloudinary.com/");
}

export function cloudinaryLoader({ src, width, quality }: ImageLoaderProps) {
  if (!isCloudinaryUrl(src) || !src.includes(uploadSegment)) return src;
  const transform = `f_auto,q_${quality ?? "auto"},c_limit,w_${width}`;
  return src.replace(uploadSegment, `${uploadSegment}${transform}/`);
}

/** next/image props: Cloudinary resizes remotely, other sources are served as-is. */
export function imageSource(src: string) {
  return isCloudinaryUrl(src)
    ? { loader: cloudinaryLoader }
    : { unoptimized: true as const };
}
