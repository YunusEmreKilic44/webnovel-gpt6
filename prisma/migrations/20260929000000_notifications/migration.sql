-- In-app notifications. A reader gets NEW_CHAPTER when a book in their
-- library publishes a chapter for the first time. Titles are not copied:
-- they are read from the book/chapter, so edits and hiding apply at once.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  book_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  read_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT notifications_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT notifications_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT notifications_type_valid CHECK (type IN ('NEW_CHAPTER'))
);
-- Re-publishing an edited chapter must not notify the same reader again.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_id_chapter_id_type_key ON notifications(user_id, chapter_id, type);
-- Newest-first list and the unread badge.
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_id_read_at_idx ON notifications(user_id, read_at);
