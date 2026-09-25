import "server-only";
import type { Database } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import type { JSONContent } from "@tiptap/react";
import { prepareImage } from "@/lib/image-upload";
import { DomainError } from "./policies";
import { chapterImageIds, MAX_CHAPTER_UPLOAD_BYTES } from "./image-content";

export async function prepareChapterImages(
  content: JSONContent,
  files: Map<string, File>,
) {
  const ids = new Set(chapterImageIds(content));
  if ([...files.keys()].some((id) => !ids.has(id)))
    throw new DomainError(
      "IMAGE_INVALID",
      "Görsel bölüm içeriğine ait olmalı.",
    );
  if (
    [...files.values()].reduce((sum, file) => sum + file.size, 0) >
    MAX_CHAPTER_UPLOAD_BYTES
  )
    throw new DomainError(
      "IMAGE_SIZE",
      "Bir kayıtta en fazla 3 MB görsel yükleyebilirsin.",
    );
  const prepared = new Map<string, Uint8Array>();
  for (const [id, file] of files) {
    // Plenty for a ~760px reading column on high-density screens.
    const bytes = await prepareImage(file, { width: 1600, height: 2000 });
    if (!bytes)
      throw new DomainError("IMAGE_INVALID", "Görsel dosyası boş olamaz.");
    prepared.set(id, bytes);
  }
  return prepared;
}

/** Media and revision commit together. Never overwrite bytes referenced by old revisions. */
export async function saveChapterImages(
  tx: Prisma.TransactionClient,
  chapterId: string,
  content: JSONContent,
  prepared: Map<string, Uint8Array>,
) {
  const ids = [...new Set(chapterImageIds(content))];
  if (!ids.length) return;
  const existing = await tx.chapterImage.findMany({
    where: { id: { in: ids }, chapterId },
    select: { id: true },
  });
  const saved = new Set(existing.map((image) => image.id));
  for (const id of ids) {
    // Retrying a request whose response was lost must not replace a saved image.
    if (saved.has(id)) continue;
    const imageData = prepared.get(id);
    if (!imageData)
      throw new DomainError(
        "IMAGE_MISSING",
        "Görsel bulunamadı. Dosyayı bu bölüme yeniden ekle.",
      );
    await tx.chapterImage.create({
      data: { id, chapterId, imageData: new Uint8Array(imageData) },
    });
  }
}

/** Check access and published references in the same query that reads bytes. */
export async function getReadableChapterImage(
  db: Database,
  imageId: string,
  viewerId: string | null,
) {
  const rows = await db.$queryRaw<{ imageData: Uint8Array }[]>`
    SELECT i.image_data AS "imageData"
    FROM chapter_images i
    JOIN chapters c ON c.id = i.chapter_id
    JOIN books b ON b.id = c.book_id
    LEFT JOIN "user" viewer ON viewer.id = ${viewerId}
    WHERE i.id = ${imageId} AND (
      (viewer.id IS NOT NULL AND NOT viewer.banned AND (
        b.author_id = viewer.id OR (viewer.role = 'admin' AND viewer.email_verified)
      )) OR (
        c.status = 'PUBLISHED' AND NOT c.hidden AND b.status = 'PUBLISHED' AND NOT b.hidden
        AND (c.access_type = 'FREE' OR (
          viewer.id IS NOT NULL AND NOT viewer.banned AND EXISTS (
            SELECT 1 FROM chapter_unlocks u WHERE u.chapter_id = c.id AND u.user_id = viewer.id
          )
        ))
        AND jsonb_path_exists(c.published_content,
          '$.** ? (@.type == "image" && @.attrs.imageId == $imageId)',
          jsonb_build_object('imageId', i.id))
      )
    )
    LIMIT 1
  `;
  return rows[0]?.imageData ?? null;
}
