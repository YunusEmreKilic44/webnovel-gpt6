CREATE TABLE "chapter_reads" (
    "chapter_id" TEXT NOT NULL,
    "viewer_key" TEXT NOT NULL,
    "read_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chapter_reads_pkey" PRIMARY KEY ("chapter_id", "viewer_key", "read_on"),
    CONSTRAINT "chapter_reads_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
