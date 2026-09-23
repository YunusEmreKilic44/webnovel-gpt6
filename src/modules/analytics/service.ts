import "server-only";
import { createHash } from "node:crypto";
import type { Database } from "@/db";

// Identity comes from the server session or its anonymous cookie, never a posted user ID.
export async function recordChapterRead(
  db: Database,
  chapterId: string,
  viewer: { userId: string } | { visitorId: string },
) {
  const userId = "userId" in viewer ? viewer.userId : null;
  const viewerKey = createHash("sha256")
    .update(
      "userId" in viewer
        ? `user:${viewer.userId}`
        : `visitor:${viewer.visitorId}`,
    )
    .digest("hex");
  // One atomic insert also enforces access and deduplicates concurrent requests.
  // The UTC date is supplied by PostgreSQL, not by the client.
  return db.$executeRaw`
    INSERT INTO chapter_reads (chapter_id, viewer_key, read_on)
    SELECT c.id, ${viewerKey}, (now() AT TIME ZONE 'UTC')::date
    FROM chapters c JOIN books b ON b.id = c.book_id
    WHERE c.id = ${chapterId} AND c.status = 'PUBLISHED' AND NOT c.hidden
      AND c.access_type = 'FREE' AND c.published_content IS NOT NULL
      AND c.published_content <> 'null'::jsonb
      AND b.status = 'PUBLISHED' AND NOT b.hidden
      AND (${userId}::text IS NULL OR b.author_id <> ${userId})
    ON CONFLICT (chapter_id, viewer_key, read_on) DO NOTHING
  `;
}
