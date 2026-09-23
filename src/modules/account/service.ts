import "server-only";
import type { Database } from "@/db";
import type { Actor } from "@/db/schema";
import { deleteImage, mediaFolder, uploadImage } from "@/lib/cloudinary";
import { prepareImage } from "@/lib/image-upload";
import { DomainError } from "@/modules/publishing/policies";

export const prepareAvatarImage = (file: File | null) =>
  prepareImage(file, { width: 512, height: 512, fit: "cover" });

/** Uploads, replaces (`file`) or removes (`remove`) the actor's profile picture. */
export async function updateAvatar(
  db: Database,
  actor: Pick<Actor, "id">,
  file: File | null,
  remove = false,
) {
  const prepared = await prepareAvatarImage(file);
  if (!prepared && !remove)
    throw new DomainError("IMAGE_REQUIRED", "Önce bir profil resmi seç.");
  const uploaded = prepared
    ? await uploadImage(prepared, mediaFolder("avatars"))
    : null;
  try {
    const previous = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: actor.id },
        select: { avatarPublicId: true, banned: true },
      });
      if (!user || user.banned)
        throw new DomainError(
          "FORBIDDEN",
          "Hesabın bu işlem için uygun değil.",
        );
      await tx.user.update({
        where: { id: actor.id },
        data: {
          avatarUrl: uploaded?.url ?? null,
          avatarPublicId: uploaded?.publicId ?? null,
          updatedAt: new Date(),
        },
      });
      return user.avatarPublicId;
    });
    await deleteImage(previous);
    return uploaded?.url ?? null;
  } catch (error) {
    await deleteImage(uploaded?.publicId);
    throw error;
  }
}
