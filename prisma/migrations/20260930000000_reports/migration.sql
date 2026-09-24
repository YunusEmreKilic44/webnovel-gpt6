-- User reports about books, chapters, comments and users, reviewed by admins.
-- target_id is polymorphic (no FK): a report must outlive the reported
-- content so the moderation history stays intact.
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN',
  action TEXT NOT NULL DEFAULT 'NONE',
  resolution_note TEXT NOT NULL DEFAULT '',
  handled_by_id TEXT,
  handled_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT reports_handled_by_id_fkey FOREIGN KEY (handled_by_id) REFERENCES "user"(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT reports_target_type_valid CHECK (target_type IN ('BOOK', 'CHAPTER', 'COMMENT', 'USER')),
  CONSTRAINT reports_reason_valid CHECK (reason IN ('SPAM', 'HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'COPYRIGHT', 'MISLEADING', 'SPOILER', 'IMPERSONATION', 'INAPPROPRIATE_PROFILE', 'OTHER')),
  CONSTRAINT reports_status_valid CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
  CONSTRAINT reports_action_valid CHECK (action IN ('NONE', 'HIDE', 'BAN')),
  CONSTRAINT reports_details_length CHECK (char_length(details) <= 1000),
  CONSTRAINT reports_handled CHECK ((status = 'OPEN') = (handled_at IS NULL))
);
-- A reader can have only one open report per target (no report spam).
CREATE UNIQUE INDEX IF NOT EXISTS reports_one_open_per_reporter ON reports(reporter_id, target_type, target_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS reports_status_created_at_idx ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS reports_target_type_target_id_idx ON reports(target_type, target_id);
