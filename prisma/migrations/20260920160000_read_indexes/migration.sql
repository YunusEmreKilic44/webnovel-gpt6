CREATE INDEX "books_author_updated_idx" ON "books"("author_id", "updated_at");
CREATE INDEX "comments_book_visible_created_idx" ON "comments"("book_id", "hidden", "created_at");
CREATE INDEX "ratings_book_idx" ON "ratings"("book_id");
