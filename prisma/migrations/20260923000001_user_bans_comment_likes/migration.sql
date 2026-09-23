ALTER TABLE "user"
  ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ban_reason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "banned_at" TIMESTAMPTZ(6);

CREATE TABLE "comment_likes" (
  "comment_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("comment_id", "user_id"),
  CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "comment_likes_user_idx" ON "comment_likes"("user_id");

-- Serialize session creation with a ban, including logins already in flight.
CREATE FUNCTION reject_banned_session() RETURNS trigger AS $$
DECLARE is_banned boolean;
BEGIN
  SELECT banned INTO is_banned FROM "user" WHERE id = NEW.user_id FOR SHARE;
  IF is_banned THEN
    RAISE EXCEPTION 'Banned users cannot create or renew sessions' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER session_ban_guard BEFORE INSERT OR UPDATE ON "session"
FOR EACH ROW EXECUTE FUNCTION reject_banned_session();
