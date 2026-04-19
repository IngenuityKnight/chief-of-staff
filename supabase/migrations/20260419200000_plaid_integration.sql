-- ─── Plaid Integration Tables ────────────────────────────────────────────────
-- access_token is sensitive. It is only read server-side via the service role
-- key. RLS prevents any client-side access to this table entirely.

CREATE TABLE IF NOT EXISTS plaid_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          TEXT        NOT NULL UNIQUE,
  access_token     TEXT        NOT NULL,           -- never exposed to client
  institution_id   TEXT,
  institution_name TEXT,
  accounts         JSONB       DEFAULT '[]'::jsonb, -- cached account list
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Cached account balances — safe to read from client (no credentials here)
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id               TEXT        PRIMARY KEY,         -- Plaid account_id
  connection_id    UUID        REFERENCES plaid_connections(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  official_name    TEXT,
  type             TEXT,                             -- depository, credit, loan, etc.
  subtype          TEXT,                             -- checking, savings, credit card, etc.
  balance_current  NUMERIC,
  balance_available NUMERIC,
  balance_limit    NUMERIC,
  currency         TEXT        DEFAULT 'USD',
  mask             TEXT,                             -- last 4 digits
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_accounts    ENABLE ROW LEVEL SECURITY;

-- plaid_connections: NO client access — service role only
-- (no policies = deny all by default under RLS)

-- plaid_accounts: readable by anyone with the anon key (no credentials stored)
CREATE POLICY "plaid_accounts_read" ON plaid_accounts
  FOR SELECT USING (true);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS plaid_accounts_connection_id ON plaid_accounts(connection_id);
