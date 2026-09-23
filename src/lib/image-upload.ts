import "server-only";
import sharp from "sharp";
import { DomainError } from "@/modules/publishing/policies";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/**
 * Validates an uploaded JPG/PNG/WebP and re-encodes it as WebP, bounded by
 * `box` ("inside" keeps the whole image, "cover" centre-crops to the box).
 * Re-encoding strips metadata (EXIF/GPS) and any non-image payload before the
 * file is sent to Cloudinary.
 */
export async function prepareImage(
  file: File | null,
  box: { width: number; height: number; fit?: "inside" | "cover" },
) {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_IMAGE_BYTES)
    throw new DomainError("IMAGE_SIZE", "Görsel en fazla 3 MB olabilir.");
  try {
    const source = Buffer.from(await file.arrayBuffer());
    const options = {
      limitInputPixels: 40_000_000,
      failOn: "warning" as const,
    };
    const metadata = await sharp(source, options).metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("unsupported image");
    // "cover" must still crop small images, so shrink the box instead of
    // relying on withoutEnlargement (which would skip the crop entirely).
    const upright = (metadata.orientation ?? 1) >= 5;
    const width = (upright ? metadata.height : metadata.width) ?? box.width;
    const height = (upright ? metadata.width : metadata.height) ?? box.height;
    const scale =
      box.fit === "cover"
        ? Math.min(1, width / box.width, height / box.height)
        : 1;
    const image = await sharp(source, options)
      .rotate()
      .resize({
        width: Math.max(1, Math.round(box.width * scale)),
        height: Math.max(1, Math.round(box.height * scale)),
        fit: box.fit ?? "inside",
        withoutEnlargement: box.fit !== "cover",
      })
      .webp({ quality: 85 })
      .toBuffer();
    if (image.length > MAX_IMAGE_BYTES) throw new Error("image too large");
    return new Uint8Array(image);
  } catch {
    throw new DomainError(
      "IMAGE_INVALID",
      "Geçerli bir JPG, PNG veya WebP görseli seç. Hareketli görseller desteklenmiyor.",
    );
  }
}
