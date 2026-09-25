import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

export const MAX_CHAPTER_IMAGES = 1;
export const MAX_CHAPTER_UPLOAD_BYTES = 3 * 1024 * 1024;
export const chapterImageId = z.uuid();
export const chapterImageNode = z
  .object({
    type: z.literal("image"),
    attrs: z
      .object({
        imageId: chapterImageId,
        alt: z.string().max(200).default(""),
      })
      .strict(),
  })
  .strict();

export const chapterImageUrl = (id: string) =>
  `/api/chapter-images/${encodeURIComponent(id)}`;

export function chapterImageIds(content: JSONContent): string[] {
  const ids: string[] = [];
  const pending = [content];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === "image" && typeof node.attrs?.imageId === "string")
      ids.push(node.attrs.imageId);
    pending.push(...(node.content ?? []));
  }
  return ids;
}
