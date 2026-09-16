CREATE FUNCTION protect_first_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.first_published_at IS NOT NULL AND NEW.first_published_at IS DISTINCT FROM OLD.first_published_at THEN
    RAISE EXCEPTION 'first_published_at is immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER chapter_first_publication_immutable BEFORE UPDATE ON chapters
FOR EACH ROW EXECUTE FUNCTION protect_first_publication();
--> statement-breakpoint
CREATE FUNCTION protect_first_premium_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.first_premium_approved_at IS NOT NULL AND NEW.first_premium_approved_at IS DISTINCT FROM OLD.first_premium_approved_at THEN
    RAISE EXCEPTION 'first_premium_approved_at is immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER book_first_premium_approval_immutable BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION protect_first_premium_approval();
--> statement-breakpoint
ALTER TABLE volumes ADD CONSTRAINT volume_id_book_unique UNIQUE (id, book_id);
--> statement-breakpoint
ALTER TABLE chapters ADD CONSTRAINT chapter_volume_book_fk FOREIGN KEY (volume_id, book_id) REFERENCES volumes (id, book_id);
--> statement-breakpoint
ALTER TABLE chapters ADD CONSTRAINT chapter_status_valid CHECK (status IN ('DRAFT', 'PUBLISHED'));
--> statement-breakpoint
ALTER TABLE chapters ADD CONSTRAINT chapter_access_valid CHECK (access_type IN ('FREE', 'PAID'));
--> statement-breakpoint
ALTER TABLE books ADD CONSTRAINT book_status_valid CHECK (status IN ('DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED'));
--> statement-breakpoint
ALTER TABLE books ADD CONSTRAINT premium_status_valid CHECK (premium_status IN ('NONE', 'ACTIVE', 'SUSPENDED', 'REVOKED'));
