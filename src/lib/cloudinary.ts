import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { DomainError } from "@/modules/publishing/policies";

// Images are validated and re-encoded with sharp before they reach this
// module; Cloudinary only stores and delivers them. The API secret never
// leaves the server — pages receive the public secure_url.

export type StoredImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
};

let configured: boolean | undefined;
function client() {
  if (configured === undefined) {
    const {
      CLOUDINARY_CLOUD_NAME: cloud_name,
      CLOUDINARY_API_KEY: api_key,
      CLOUDINARY_API_SECRET: api_secret,
    } = process.env;
    configured = Boolean(cloud_name && api_key && api_secret);
    if (configured)
      cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  }
  if (!configured)
    throw new DomainError(
      "MEDIA_NOT_CONFIGURED",
      "Görsel yükleme şu an kullanılamıyor. Cloudinary ayarlarını kontrol et.",
    );
  return cloudinary;
}

export function isCloudinaryConfigured() {
  try {
    client();
    return true;
  } catch {
    return false;
  }
}

/** Folder under CLOUDINARY_FOLDER, e.g. "satir/slides". */
export function mediaFolder(name: string) {
  const root = (process.env.CLOUDINARY_FOLDER || "satir").replace(/\/+$/, "");
  return `${root}/${name}`;
}

export async function uploadImage(
  data: Uint8Array,
  folder: string,
): Promise<StoredImage> {
  const api = client();
  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      api.uploader
        .upload_stream(
          {
            folder,
            // Unguessable ids: unpublished slide URLs must not be enumerable.
            public_id: crypto.randomUUID(),
            resource_type: "image",
            overwrite: false,
          },
          (error, response) =>
            error || !response ? reject(error) : resolve(response),
        )
        .end(Buffer.from(data));
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error("media.upload.failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new DomainError(
      "MEDIA_UPLOAD_FAILED",
      "Görsel yüklenemedi. Biraz sonra tekrar dene.",
    );
  }
}

/** Best effort: a leftover asset must never fail the user's request. */
export async function deleteImage(publicId: string | null | undefined) {
  if (!publicId) return;
  try {
    await client().uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
  } catch (error) {
    console.error("media.delete.failed", {
      publicId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
