-- Readers follow authors; followers hear about an author's new books.
CREATE TABLE IF NOT EXISTS author_follows (
  follower_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT author_follows_pkey PRIMARY KEY (follower_id, author_id),
  CONSTRAINT author_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT author_follows_author_id_fkey FOREIGN KEY (author_id) REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT author_follows_not_self CHECK (follower_id <> author_id)
);
CREATE INDEX IF NOT EXISTS author_follows_author_id_idx ON author_follows(author_id);

-- Comments left on a user's public profile.
CREATE TABLE IF NOT EXISTS profile_comments (
  id TEXT PRIMARY KEY,
  profile_user_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT profile_comments_profile_user_id_fkey FOREIGN KEY (profile_user_id) REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT profile_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT profile_comments_body_length CHECK (char_length(body) BETWEEN 1 AND 1000)
);
CREATE INDEX IF NOT EXISTS profile_comments_profile_user_id_created_at_idx ON profile_comments(profile_user_id, created_at);

-- NEW_BOOK: a followed author's book went public. At most once per book.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_valid;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_valid CHECK (type IN (
  'NEW_CHAPTER', 'NEW_BOOK', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED',
  'REPORT_RESOLVED', 'REPORT_DISMISSED'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_subject;
ALTER TABLE notifications ADD CONSTRAINT notifications_subject CHECK (
  (type = 'NEW_CHAPTER' AND book_id IS NOT NULL AND chapter_id IS NOT NULL)
  OR (type = 'NEW_BOOK' AND book_id IS NOT NULL)
  OR (type IN ('APPLICATION_APPROVED', 'APPLICATION_REJECTED')
      AND application_id IS NOT NULL AND book_id IS NOT NULL)
  OR (type IN ('REPORT_RESOLVED', 'REPORT_DISMISSED') AND report_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_id_new_book_key
  ON notifications(user_id, book_id) WHERE type = 'NEW_BOOK';

-- Profile comments can be reported like book comments.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_valid;
ALTER TABLE reports ADD CONSTRAINT reports_target_type_valid CHECK (
  target_type IN ('BOOK', 'CHAPTER', 'COMMENT', 'PROFILE_COMMENT', 'USER'));
