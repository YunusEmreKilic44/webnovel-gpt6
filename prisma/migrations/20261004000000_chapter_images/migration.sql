CREATE TABLE "chapter_images" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chapter_id" TEXT NOT NULL REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "image_data" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "chapter_images_size_check" CHECK (octet_length("image_data") BETWEEN 1 AND 3145728)
);
CREATE INDEX "chapter_images_chapter_id_idx" ON "chapter_images"("chapter_id");
