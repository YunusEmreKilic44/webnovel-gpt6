-- Coin economy. Readers top up coins through iyzico and unlock premium
-- chapters for one fixed, admin-managed price. Authors only choose whether a
-- chapter is premium (access_type = 'PAID'); they no longer set a price.

-- Per-chapter TRY prices are gone. Existing PAID chapters stay premium and
-- are now unlocked for the fixed coin price.
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapter_price_valid;
ALTER TABLE chapters DROP COLUMN IF EXISTS price_minor;

-- Balance lives on the user row so a debit is one conditional UPDATE; the
-- CHECK makes overspending impossible even under concurrent unlocks.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS coin_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_coin_balance_non_negative;
ALTER TABLE "user" ADD CONSTRAINT user_coin_balance_non_negative CHECK (coin_balance >= 0);

CREATE TABLE IF NOT EXISTS coin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  chapter_price_coins INTEGER NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT coin_settings_singleton CHECK (id = 1),
  CONSTRAINT coin_settings_price_range CHECK (chapter_price_coins BETWEEN 1 AND 1000)
);
INSERT INTO coin_settings (id, chapter_price_coins) VALUES (1, 5) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS coin_packages (
  id TEXT PRIMARY KEY,
  coins INTEGER NOT NULL,
  price_minor INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT coin_packages_coins_range CHECK (coins BETWEEN 1 AND 100000),
  CONSTRAINT coin_packages_price_range CHECK (price_minor BETWEEN 100 AND 10000000)
);
INSERT INTO coin_packages (id, coins, price_minor, position) VALUES
  ('coins-50', 50, 2499, 1),
  ('coins-150', 150, 6499, 2),
  ('coins-400', 400, 15999, 3)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS coin_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  package_id TEXT,
  coins INTEGER NOT NULL,
  price_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider TEXT NOT NULL DEFAULT 'iyzico',
  provider_token TEXT,
  provider_payment_id TEXT,
  failure_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ(6),
  CONSTRAINT coin_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT coin_orders_package_id_fkey FOREIGN KEY (package_id) REFERENCES coin_packages(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT coin_orders_status_valid CHECK (status IN ('PENDING', 'PAID', 'FAILED')),
  CONSTRAINT coin_orders_amounts_positive CHECK (coins > 0 AND price_minor > 0),
  CONSTRAINT coin_orders_paid_at CHECK ((status = 'PAID') = (paid_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS coin_orders_provider_token_key ON coin_orders(provider_token);
CREATE INDEX IF NOT EXISTS coin_orders_user_id_created_at_idx ON coin_orders(user_id, created_at);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  kind TEXT NOT NULL,
  order_id TEXT,
  chapter_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT coin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT coin_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES coin_orders(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT coin_transactions_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT coin_transactions_kind_valid CHECK (kind IN ('TOP_UP', 'UNLOCK', 'ADJUSTMENT')),
  CONSTRAINT coin_transactions_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT coin_transactions_balance_non_negative CHECK (balance_after >= 0),
  CONSTRAINT coin_transactions_top_up_order CHECK (kind <> 'TOP_UP' OR (order_id IS NOT NULL AND amount > 0)),
  CONSTRAINT coin_transactions_unlock_chapter CHECK (kind <> 'UNLOCK' OR (chapter_id IS NOT NULL AND amount < 0))
);
-- One credit per paid order, whatever retries or duplicate callbacks happen.
CREATE UNIQUE INDEX IF NOT EXISTS coin_transactions_order_id_key ON coin_transactions(order_id);
CREATE INDEX IF NOT EXISTS coin_transactions_user_id_created_at_idx ON coin_transactions(user_id, created_at);

CREATE TABLE IF NOT EXISTS chapter_unlocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  coins_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT chapter_unlocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chapter_unlocks_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT chapter_unlocks_coins_positive CHECK (coins_spent > 0)
);
-- A chapter can be paid for only once per reader.
CREATE UNIQUE INDEX IF NOT EXISTS chapter_unlocks_user_id_chapter_id_key ON chapter_unlocks(user_id, chapter_id);
CREATE INDEX IF NOT EXISTS chapter_unlocks_chapter_id_idx ON chapter_unlocks(chapter_id);
