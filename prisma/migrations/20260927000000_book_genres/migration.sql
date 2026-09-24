-- Preserve every existing category while replacing the single-value column.
ALTER TABLE "books" RENAME COLUMN "genre" TO "genres";
ALTER TABLE "books" ALTER COLUMN "genres" TYPE TEXT[] USING ARRAY["genres"];
ALTER TABLE "books" ADD CONSTRAINT "books_genres_nonempty"
  CHECK (cardinality("genres") > 0 AND array_position("genres", NULL) IS NULL);
CREATE INDEX "books_genres_idx" ON "books" USING GIN ("genres");

-- Reviewers must also see categories on applications submitted before migration.
UPDATE "applications"
SET "snapshot" = ("snapshot"::jsonb - 'genre') ||
  jsonb_build_object('genres', jsonb_build_array("snapshot"::jsonb ->> 'genre'))
WHERE "snapshot"::jsonb ? 'genre' AND NOT ("snapshot"::jsonb ? 'genres');
