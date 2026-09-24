import { z } from "zod";

export const MAX_BOOK_TAGS = 10;
export const MAX_TAG_LENGTH = 32;
export const MAX_TAG_WORDS = 3;

export function normalizeTag(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/^\((.*)\)$/u, "$1")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase()
    .replace(/\u0307/gu, "");
}

/** Shared identity for Isekai/İSEKAİ and yeni dünya/yeni dunya, including Turkish ı. */
export function tagKey(value: string) {
  return normalizeTag(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/gu, "i")
    .replace(/’/gu, "'");
}

export function parseTags(entries: readonly string[]): {
  tags: string[];
  error?: string;
} {
  const unique = new Map<string, string>();
  for (const entry of entries) {
    if (entry.length > 400 || /[\r\n]/u.test(entry)) {
      return {
        tags: [],
        error:
          "Açıklama yerine kısa etiketler yaz; her etiket en fazla 3 kelime olmalı.",
      };
    }
    for (const part of entry.split(",")) {
      if (!part.trim()) continue;
      const name = normalizeTag(part);
      if (
        name.length < 2 ||
        name.length > MAX_TAG_LENGTH ||
        name.split(" ").length > MAX_TAG_WORDS
      ) {
        return {
          tags: [],
          error: "Her etiket 2–32 karakter ve en fazla 3 kelime olmalı.",
        };
      }
      if (!/^[\p{L}\p{N}]+(?:['’ -][\p{L}\p{N}]+)*$/u.test(name)) {
        return {
          tags: [],
          error:
            "Etiketlerde harf, sayı, boşluk, kesme işareti ve kısa çizgi kullanabilirsin. Cümle veya bağlantı yazma.",
        };
      }
      const key = tagKey(name);
      if (!unique.has(key)) unique.set(key, name);
    }
  }
  if (unique.size > MAX_BOOK_TAGS) {
    return { tags: [], error: "Bir kitaba en fazla 10 etiket ekleyebilirsin." };
  }
  return {
    tags: [...unique.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([, name]) => name),
  };
}

// The extra entry is the unfinished input: saving the form must not lose it.
export const bookTagsInput = z
  .array(z.string())
  .max(MAX_BOOK_TAGS + 1, "Bir kitaba en fazla 10 etiket ekleyebilirsin.")
  .default([])
  .transform((entries, ctx) => {
    const result = parseTags(entries);
    if (result.error) ctx.addIssue({ code: "custom", message: result.error });
    return result.tags;
  });
