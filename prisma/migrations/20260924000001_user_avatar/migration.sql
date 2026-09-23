-- Profile pictures on Cloudinary (see src/modules/account/service.ts).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS avatar_public_id TEXT;
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_avatar_url_https;
ALTER TABLE "user" ADD CONSTRAINT user_avatar_url_https
  CHECK (avatar_url IS NULL OR avatar_url LIKE 'https://%');
