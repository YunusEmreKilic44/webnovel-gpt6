-- Preserve the previously automatic home carousel as editable slide records.
-- Existing custom slides (including drafts) are left untouched.
WITH catalog AS (
  SELECT b.*, row_number() OVER (
    ORDER BY b.featured DESC, b.updated_at DESC, b.id
  ) AS slide_number
  FROM books b
  WHERE b.status = 'PUBLISHED' AND NOT b.hidden
  ORDER BY b.featured DESC, b.updated_at DESC, b.id
  LIMIT 6
)
INSERT INTO home_slides (
  id, title, description, link_path, link_label, image_preset,
  image_url, image_alt, published, position
)
SELECT
  'catalog-slide-' || b.id,
  left(b.title, 120),
  left(b.description, 500),
  CASE WHEN b.slide_number = 1 AND first_chapter.id IS NOT NULL
    THEN '/oku/' || first_chapter.id ELSE '/kitap/' || b.slug END,
  CASE WHEN b.slide_number = 1 AND first_chapter.id IS NOT NULL
    THEN 'Okumaya başla' ELSE 'Seriyi incele' END,
  CASE WHEN b.cover IN ('ocean', 'forest', 'violet', 'sand', 'rose')
    THEN b.cover ELSE 'hero' END,
  b.cover_url,
  '',
  true,
  b.slide_number::int
FROM catalog b
LEFT JOIN LATERAL (
  SELECT c.id FROM chapters c JOIN volumes v ON v.id = c.volume_id
  WHERE c.book_id = b.id AND c.status = 'PUBLISHED' AND NOT c.hidden
  ORDER BY v.position, c.position, c.id LIMIT 1
) first_chapter ON true
WHERE NOT EXISTS (SELECT 1 FROM home_slides)
ON CONFLICT (id) DO NOTHING;
