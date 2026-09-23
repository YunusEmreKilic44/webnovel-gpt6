CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_path TEXT NOT NULL DEFAULT '',
  link_label TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX announcements_published_position_idx ON announcements(published, position);

CREATE TABLE home_slides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  link_path TEXT NOT NULL DEFAULT '',
  link_label TEXT NOT NULL DEFAULT '',
  image_preset TEXT NOT NULL DEFAULT 'hero',
  image_data BYTEA,
  image_alt TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT home_slides_image_size CHECK (octet_length(image_data) <= 3145728)
);
CREATE INDEX home_slides_published_position_idx ON home_slides(published, position);
