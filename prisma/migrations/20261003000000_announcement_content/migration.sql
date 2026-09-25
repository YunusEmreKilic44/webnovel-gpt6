ALTER TABLE "announcements" ADD COLUMN "content" JSONB;

-- Preserve existing text verbatim, including line breaks.
UPDATE "announcements"
SET "content" = jsonb_build_array(jsonb_build_object(
  'type', 'text', 'id', 'legacy-text', 'text', "body"
));
