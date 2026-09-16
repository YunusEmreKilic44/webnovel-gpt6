import { z } from "zod";
import type { JSONContent } from "@tiptap/react";

const mark = z
  .object({ type: z.enum(["bold", "italic", "strike", "code"]) })
  .strict();
const node: z.ZodType<JSONContent> = z.lazy(() =>
  z
    .object({
      type: z.enum([
        "doc",
        "paragraph",
        "text",
        "heading",
        "blockquote",
        "bulletList",
        "orderedList",
        "listItem",
        "hardBreak",
        "horizontalRule",
      ]),
      text: z.string().max(100_000).optional(),
      attrs: z
        .object({
          level: z.number().int().min(2).max(3).optional(),
          start: z.number().int().min(1).max(10000).optional(),
          type: z.null().optional(),
        })
        .strict()
        .optional(),
      marks: z.array(mark).max(4).optional(),
      content: z.array(node).max(2000).optional(),
    })
    .strict(),
);
export function parseContent(raw: string): JSONContent {
  if (raw.length > 500_000) throw new Error("Bölüm metni çok uzun.");
  const json: unknown = JSON.parse(raw);
  const pending: { value: unknown; depth: number }[] = [
    { value: json, depth: 0 },
  ];
  while (pending.length) {
    const current = pending.pop()!;
    if (current.depth > 24)
      throw new Error("Metin iç içe çok fazla blok içeriyor.");
    if (current.value && typeof current.value === "object") {
      for (const value of Object.values(current.value))
        pending.push({ value, depth: current.depth + 1 });
    }
  }
  const parsed = node.parse(json);
  if (parsed.type !== "doc") throw new Error("Geçersiz metin belgesi.");
  return parsed;
}
export function plainText(content: JSONContent): string {
  return content.text ?? (content.content ?? []).map(plainText).join(" ");
}
export function wordCount(content: JSONContent): number {
  return plainText(content).trim().split(/\s+/).filter(Boolean).length;
}
export const emptyContent: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
