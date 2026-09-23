import "server-only";
import { z } from "zod";
import type { Database } from "@/db";
import type { Actor } from "@/db/schema";
import { administrativeWrite, audit } from "@/modules/admin/service";
import { DomainError, requireReviewer } from "@/modules/publishing/policies";
import { deleteImage, mediaFolder, uploadImage } from "@/lib/cloudinary";
import { prepareImage } from "@/lib/image-upload";

export const imagePresets = [
  "hero",
  "ember",
  "forest",
  "ocean",
  "rose",
  "sand",
  "violet",
] as const;
const linkPath = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      !value ||
      (/^\/(?!\/)/.test(value) && !/[\\\s\u0000-\u001f\u007f]/.test(value)),
    "Bağlantı /kitap/ornek gibi site içi bir adres olmalı.",
  );
const common = z.object({
  id: z.string().max(128).default(""),
  title: z.string().trim().min(2, "Başlık en az 2 karakter olmalı.").max(120),
  linkPath,
  linkLabel: z.string().trim().max(50),
  published: z.boolean(),
  position: z.coerce.number().int().min(0).max(9999),
});
const validLink = (value: { linkPath: string; linkLabel: string }) =>
  Boolean(value.linkPath) === Boolean(value.linkLabel);
const linkError = {
  message: "Bağlantı adresini ve düğme yazısını birlikte doldur.",
};
export const announcementInput = common
  .extend({
    body: z
      .string()
      .trim()
      .min(3, "Duyuru metni en az 3 karakter olmalı.")
      .max(2000),
  })
  .refine(validLink, linkError);
export const slideInput = common
  .extend({
    description: z.string().trim().max(500),
    imagePreset: z.enum(imagePresets),
    imageAlt: z.string().trim().max(200),
    usePreset: z.boolean(),
  })
  .refine(validLink, linkError);

export const prepareSlideImage = (file: File | null) =>
  prepareImage(file, { width: 2400, height: 1600 });

export async function saveAnnouncement(
  db: Database,
  actor: Actor,
  raw: z.input<typeof announcementInput>,
) {
  const { id, ...data } = announcementInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    const before = id
      ? await tx.announcement.findUnique({ where: { id } })
      : null;
    if (id && !before) throw new DomainError("NOT_FOUND", "Duyuru bulunamadı.");
    if (!id && (await tx.announcement.count()) >= 50)
      throw new DomainError(
        "LIMIT",
        "En fazla 50 duyuru saklayabilirsin. Eski duyurulardan birini sil.",
      );
    const result = id
      ? await tx.announcement.update({
          where: { id },
          data: { ...data, updatedAt: new Date() },
        })
      : await tx.announcement.create({
          data: { ...data, id: crypto.randomUUID() },
        });
    await audit(
      tx,
      actor,
      "ADMIN_ANNOUNCEMENT_SAVED",
      result.id,
      `Duyuru kaydedildi: ${data.title}`,
      {
        before: before
          ? {
              title: before.title,
              body: before.body,
              published: before.published,
              position: before.position,
              linkPath: before.linkPath,
              linkLabel: before.linkLabel,
            }
          : {},
        after: data,
      },
    );
    return result.id;
  });
}

export async function saveSlide(
  db: Database,
  actor: Actor,
  raw: z.input<typeof slideInput>,
  file: File | null,
) {
  requireReviewer(actor);
  const { id, usePreset, ...data } = slideInput.parse(raw);
  const prepared = await prepareSlideImage(file);
  // Upload outside the transaction so the advisory lock is not held on network I/O.
  const uploaded = prepared
    ? await uploadImage(prepared, mediaFolder("slides"))
    : null;
  let replacedPublicId: string | null = null;
  try {
    const savedId = await administrativeWrite(db, actor, async (tx) => {
      // Do not load binary images into audit records or edit forms.
      const before = id
        ? await tx.homeSlide.findUnique({
            where: { id },
            omit: { imageData: true },
          })
        : null;
      if (id && !before)
        throw new DomainError("NOT_FOUND", "Slayt bulunamadı.");
      if (!id && (await tx.homeSlide.count()) >= 20)
        throw new DomainError(
          "LIMIT",
          "En fazla 20 slayt saklayabilirsin. Eski slaytlardan birini sil.",
        );
      const image = uploaded
        ? {
            imageUrl: uploaded.url,
            imagePublicId: uploaded.publicId,
            imageData: null,
          }
        : usePreset
          ? { imageUrl: null, imagePublicId: null, imageData: null }
          : {};
      if ("imageUrl" in image) replacedPublicId = before?.imagePublicId ?? null;
      const result = id
        ? await tx.homeSlide.update({
            where: { id },
            data: { ...data, ...image, updatedAt: new Date() },
            select: { id: true },
          })
        : await tx.homeSlide.create({
            data: { ...data, ...image, id: crypto.randomUUID() },
            select: { id: true },
          });
      await audit(
        tx,
        actor,
        "ADMIN_SLIDE_SAVED",
        result.id,
        `Slayt kaydedildi: ${data.title}`,
        {
          before: before
            ? {
                title: before.title,
                description: before.description,
                published: before.published,
                position: before.position,
                linkPath: before.linkPath,
                linkLabel: before.linkLabel,
                imagePreset: before.imagePreset,
                imageAlt: before.imageAlt,
              }
            : {},
          after: {
            ...data,
            imageChanged: Boolean(uploaded) || usePreset,
            ...(uploaded && { imagePublicId: uploaded.publicId }),
          },
        },
      );
      return result.id;
    });
    await deleteImage(replacedPublicId);
    return savedId;
  } catch (error) {
    // The row never pointed at the new upload; do not leave it orphaned.
    await deleteImage(uploaded?.publicId);
    throw error;
  }
}

export async function deleteSiteContent(
  db: Database,
  actor: Actor,
  kind: "announcement" | "slide",
  id: string,
) {
  z.string().min(1).max(128).parse(id);
  z.enum(["announcement", "slide"]).parse(kind);
  const removedPublicId = await administrativeWrite(db, actor, async (tx) => {
    const before: { title: string; imagePublicId?: string | null } | null =
      kind === "announcement"
        ? await tx.announcement.findUnique({
            where: { id },
            select: { title: true },
          })
        : await tx.homeSlide.findUnique({
            where: { id },
            select: { title: true, imagePublicId: true },
          });
    if (!before) throw new DomainError("NOT_FOUND", "Kayıt bulunamadı.");
    if (kind === "announcement")
      await tx.announcement.delete({ where: { id } });
    else await tx.homeSlide.delete({ where: { id } });
    await audit(
      tx,
      actor,
      kind === "announcement"
        ? "ADMIN_ANNOUNCEMENT_DELETED"
        : "ADMIN_SLIDE_DELETED",
      id,
      `Silindi: ${before.title}`,
      {},
    );
    return before.imagePublicId ?? null;
  });
  await deleteImage(removedPublicId);
}
