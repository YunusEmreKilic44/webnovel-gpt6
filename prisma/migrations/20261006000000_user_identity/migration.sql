-- Never silently rename existing accounts. Resolve duplicates before deploying.
DO $$
BEGIN
  IF EXISTS (SELECT name FROM "user" GROUP BY name HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate user names: resolve SELECT name, array_agg(id) FROM "user" GROUP BY name HAVING count(*) > 1 before applying user_identity';
  END IF;
END $$;

CREATE UNIQUE INDEX user_name_unique ON "user" (name);
ALTER TABLE "user" ADD COLUMN slug text;
CREATE UNIQUE INDEX user_slug_unique ON "user" (slug);

-- All writers (Better Auth, seed, Prisma and SQL imports) use this allocator.
CREATE FUNCTION assign_user_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  base text;
  candidate text;
  suffix integer := 1;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'User slug is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Preserve slugs when importing an already migrated database.
  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF;

  -- Serialize allocations, including collisions such as "ali", "ali-2", "Ali".
  PERFORM pg_advisory_xact_lock(7340922);
  base := trim(both '-' from regexp_replace(
    lower(regexp_replace(normalize(translate(NEW.name, 'İIıĞğÜüŞşÖöÇç', 'iiigguussoocc'), NFD), U&'[\0300-\036f]', '', 'g')),
    '[^a-z0-9]+', '-', 'g'));
  base := coalesce(nullif(base, ''), 'yazar');
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM "user" WHERE slug = candidate AND id <> NEW.id)
     OR EXISTS (SELECT 1 FROM "user" WHERE id = candidate AND id <> NEW.id)
     OR candidate = NEW.id LOOP
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END $$;

CREATE TRIGGER user_assign_slug BEFORE INSERT OR UPDATE OF slug ON "user"
FOR EACH ROW EXECUTE FUNCTION assign_user_slug();

-- Deterministic ownership of unsuffixed slugs for existing accounts.
DO $$
DECLARE account record;
BEGIN
  FOR account IN SELECT id FROM "user" ORDER BY created_at, id LOOP
    UPDATE "user" SET slug = NULL WHERE id = account.id;
  END LOOP;
END $$;

ALTER TABLE "user" ALTER COLUMN slug SET NOT NULL;
ALTER TABLE "user" ADD CONSTRAINT user_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
