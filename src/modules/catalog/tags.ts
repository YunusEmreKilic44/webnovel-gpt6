import type { Prisma } from "@/generated/prisma/client";
import { tagKey } from "@/lib/tags";

export const bookTagSelection = {
  select: { tag: { select: { name: true } } },
  orderBy: { tagKey: "asc" },
} as const;

export const tagNames = (rows: { tag: { name: string } }[]) =>
  rows.map(({ tag }) => tag.name);

/** Called inside the publishing/admin transaction, after locking the book. */
export async function replaceBookTags(
  tx: Prisma.TransactionClient,
  bookId: string,
  names: string[],
) {
  const tags = names
    .map((name) => ({ key: tagKey(name), name }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  // Ordered upserts avoid conflicting insert order across concurrent books.
  for (const tag of tags) {
    await tx.$executeRaw`
      INSERT INTO tags (key, name) VALUES (${tag.key}, ${tag.name})
      ON CONFLICT (key) DO NOTHING
    `;
  }
  await tx.bookTag.deleteMany({ where: { bookId } });
  if (tags.length)
    await tx.bookTag.createMany({
      data: tags.map((tag) => ({ bookId, tagKey: tag.key })),
    });
}
