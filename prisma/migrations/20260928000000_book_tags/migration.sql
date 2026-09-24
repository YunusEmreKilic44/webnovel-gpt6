CREATE TABLE "tags" (
  "key" VARCHAR(64) NOT NULL PRIMARY KEY,
  "name" VARCHAR(32) NOT NULL,
  CONSTRAINT "tags_name_nonempty" CHECK (char_length("name") BETWEEN 2 AND 32),
  CONSTRAINT "tags_key_nonempty" CHECK (char_length("key") > 0)
);
CREATE TABLE "book_tags" (
  "book_id" TEXT NOT NULL,
  "tag_key" VARCHAR(64) NOT NULL,
  PRIMARY KEY ("book_id", "tag_key"),
  CONSTRAINT "book_tags_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "book_tags_tag_key_fkey" FOREIGN KEY ("tag_key") REFERENCES "tags"("key") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "book_tags_tag_book_idx" ON "book_tags" ("tag_key", "book_id");

-- Retire the category without leaving any book uncategorized.
UPDATE "books"
SET "genres" = CASE WHEN cardinality(array_remove("genres", 'LGBT+')) = 0
  THEN ARRAY['Diğer'] ELSE array_remove("genres", 'LGBT+') END
WHERE "genres" @> ARRAY['LGBT+'];

-- Old snapshots have no tags; keep their historical content otherwise intact.
UPDATE "applications" SET "snapshot" = "snapshot"::jsonb || '{"tags":[]}'::jsonb
WHERE NOT ("snapshot"::jsonb ? 'tags');
