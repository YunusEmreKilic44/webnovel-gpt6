-- 1) Notifications beyond new chapters: application decisions for authors and
--    report outcomes for reporters. Each kind keeps its own subject column.
ALTER TABLE notifications ALTER COLUMN book_id DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN chapter_id DROP NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS application_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS report_id TEXT;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_application_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_report_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_report_id_fkey
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_valid;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_valid CHECK (type IN (
  'NEW_CHAPTER', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED',
  'REPORT_RESOLVED', 'REPORT_DISMISSED'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_subject;
ALTER TABLE notifications ADD CONSTRAINT notifications_subject CHECK (
  (type = 'NEW_CHAPTER' AND book_id IS NOT NULL AND chapter_id IS NOT NULL)
  OR (type IN ('APPLICATION_APPROVED', 'APPLICATION_REJECTED')
      AND application_id IS NOT NULL AND book_id IS NOT NULL)
  OR (type IN ('REPORT_RESOLVED', 'REPORT_DISMISSED') AND report_id IS NOT NULL));
-- A decision or report outcome is announced to a user at most once.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_id_application_id_key
  ON notifications(user_id, application_id) WHERE application_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_id_report_id_key
  ON notifications(user_id, report_id) WHERE report_id IS NOT NULL;

-- 2) Premium applications need a minimum of published chapters and reads.
--    Admin-editable next to the chapter price.
ALTER TABLE coin_settings ADD COLUMN IF NOT EXISTS premium_min_chapters INTEGER NOT NULL DEFAULT 10;
ALTER TABLE coin_settings ADD COLUMN IF NOT EXISTS premium_min_reads INTEGER NOT NULL DEFAULT 500;
ALTER TABLE coin_settings DROP CONSTRAINT IF EXISTS coin_settings_premium_rules_range;
ALTER TABLE coin_settings ADD CONSTRAINT coin_settings_premium_rules_range CHECK (
  premium_min_chapters BETWEEN 0 AND 1000 AND premium_min_reads BETWEEN 0 AND 10000000);
