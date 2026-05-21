-- Plaid transaction history (last 30 days, refreshed nightly)
CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL,
  connection_id UUID REFERENCES plaid_connections(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  merchant_name TEXT,
  amount        NUMERIC(12, 2) NOT NULL,
  category      TEXT,
  subcategory   TEXT,
  date          DATE NOT NULL,
  pending       BOOLEAN NOT NULL DEFAULT FALSE,
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS transactions_date_idx     ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS transactions_category_idx ON transactions (category);
