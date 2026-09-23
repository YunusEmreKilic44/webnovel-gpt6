-- Uploaded images live on Cloudinary; the database keeps the delivery URL and
-- the public_id needed to delete the asset.

-- Slides: image_data stays until `npm run media:migrate-slides` has copied
-- existing rows over.
ALTER TABLE home_slides ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE home_slides ADD COLUMN IF NOT EXISTS image_public_id TEXT;
ALTER TABLE home_slides DROP CONSTRAINT IF EXISTS home_slides_image_url_https;
ALTER TABLE home_slides ADD CONSTRAINT home_slides_image_url_https
  CHECK (image_url IS NULL OR image_url LIKE 'https://%');

-- Book covers: `cover` keeps the preset artwork used as the fallback.
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_public_id TEXT;
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_cover_url_https;
ALTER TABLE books ADD CONSTRAINT books_cover_url_https
  CHECK (cover_url IS NULL OR cover_url LIKE 'https://%');
