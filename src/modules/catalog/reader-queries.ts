import "server-only";
import { cache } from "react";
import { getDb } from "@/db";

// No draft or published body is selected with navigation metadata.
export const getReaderChapter = cache(async (chapterId: string) => {
  const rows = await getDb().$queryRaw<
    {
      id: string;
      title: string;
      bookId: string;
      bookTitle: string;
      bookSlug: string;
      author: string;
      position: number;
      volumeTitle: string;
      wordCount: number;
      accessType: string;
      authorId: string;
      premiumStatus: string;
    }[]
  >`
    SELECT c.id, c.published_title AS title, c.book_id AS "bookId",
      b.title AS "bookTitle", b.slug AS "bookSlug", u.name AS author,
      c.position, v.title AS "volumeTitle", c.published_word_count AS "wordCount",
      c.access_type AS "accessType", b.author_id AS "authorId",
      b.premium_status AS "premiumStatus"
    FROM chapters c JOIN books b ON b.id = c.book_id
    JOIN volumes v ON v.id = c.volume_id JOIN "user" u ON u.id = b.author_id
    WHERE c.id = ${chapterId} AND c.status = 'PUBLISHED' AND NOT c.hidden
      AND b.status = 'PUBLISHED' AND NOT b.hidden
  `;
  return rows[0];
});

export async function getReaderNeighbours(bookId: string, chapterId: string) {
  const rows = await getDb().$queryRaw<
    { previous: string | null; next: string | null }[]
  >`
    SELECT previous, next FROM (
      SELECT c.id,
        lag(c.id) OVER (ORDER BY v.position, c.position) AS previous,
        lead(c.id) OVER (ORDER BY v.position, c.position) AS next
      FROM chapters c JOIN volumes v ON v.id = c.volume_id
      WHERE c.book_id = ${bookId} AND c.status = 'PUBLISHED' AND NOT c.hidden
    ) ordered WHERE id = ${chapterId}
  `;
  return rows[0];
}
