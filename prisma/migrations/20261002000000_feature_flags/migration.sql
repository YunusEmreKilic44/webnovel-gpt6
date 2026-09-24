-- Admin-controlled switches for features that are not launched yet. Both
-- start OFF: the coin store and premium applications open from the admin
-- panel when the platform is ready.
ALTER TABLE coin_settings ADD COLUMN IF NOT EXISTS coin_store_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coin_settings ADD COLUMN IF NOT EXISTS premium_applications_enabled BOOLEAN NOT NULL DEFAULT false;
