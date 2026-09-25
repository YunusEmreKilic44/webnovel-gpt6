import { z } from "zod";

export const MAX_ANNOUNCEMENT_IMAGES = 8;
export const MAX_ANNOUNCEMENT_UPLOAD_BYTES = 12 * 1024 * 1024;
const blockId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[\w-]+$/);
const textBlock = z.object({
  type: z.literal("text"),
  id: blockId,
  text: z.string().max(20000),
});
const imageBlock = z.object({
  type: z.literal("image"),
  id: blockId,
  alt: z.string().trim().max(200),
});

// Requests carry image IDs only. URLs and deletion IDs come from the server.
export const announcementBlocksInput = z
  .array(z.discriminatedUnion("type", [textBlock, imageBlock]))
  .min(1)
  .max(100)
  .refine(
    (blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length,
    "İçerik blokları benzersiz olmalı.",
  )
  .refine(
    (blocks) =>
      blocks.filter((block) => block.type === "image").length <=
      MAX_ANNOUNCEMENT_IMAGES,
    "En fazla 8 görsel ekleyebilirsin.",
  )
  .refine((blocks) => {
    const text = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n\n")
      .trim();
    return text.length >= 3 && text.length <= 20000;
  }, "Duyuru metni 3–20.000 karakter arasında olmalı.");

const storedBlocks = z.array(
  z.discriminatedUnion("type", [
    textBlock,
    imageBlock.extend({
      url: z.string().startsWith("https://res.cloudinary.com/"),
      publicId: z.string().min(1),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  ]),
);
export type AnnouncementBlock = z.infer<typeof storedBlocks>[number];
export type AnnouncementBlockInput = z.infer<
  typeof announcementBlocksInput
>[number];

/** Legacy plain text remains readable without rewriting or interpreting HTML. */
export function readAnnouncementBlocks(
  content: unknown,
  body: string,
): AnnouncementBlock[] {
  const parsed = storedBlocks.safeParse(content);
  return parsed.success && parsed.data.length
    ? parsed.data
    : [{ type: "text", id: "legacy-text", text: body }];
}

export function announcementText(blocks: AnnouncementBlockInput[]) {
  return blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

export function announcementExcerpt(body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}
