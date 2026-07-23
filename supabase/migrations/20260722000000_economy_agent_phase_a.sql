-- Economy Agent: Gigs, Accounts, and Paydays for the household (Phase A–D)
--
-- This migration implements the Economy Agent schema as described in
-- FAMILY-ECONOMY-BRIEF.md §3, with household_id scope and RLS enforcement.
--
-- Tables:
--   - economy_accounts: One per household member who participates
--   - economy_buckets: Give/Save/Spend/Invest splits per account
--   - gigs: Posted work items with bounties, claimed/done/approved/paid workflow
--   - payday_settings: Household-level scheduling (frequency, anchor day)
--   - payday_runs: Audit trail of each payout batch
--   - economy_transactions: Ledger entries for splits, transfers, and ventures
--   - micro_ventures: Real small ventures (lemonade stand, vending machine, etc.)
--   - micro_venture_stakes: Who owns what % of which venture
--   - linked_financial_accounts: Read-only connection to custodial accounts via Plaid

-- ─── economy_accounts ──────────────────────────────────────────────────────────
-- One per household member who participates in the gig economy.

CREATE TABLE IF NOT EXISTS public.economy_accounts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id             UUID        NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, member_id)
);

ALTER TABLE public.economy_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "economy_accounts_membership" ON public.economy_accounts;
CREATE POLICY "economy_accounts_membership" ON public.economy_accounts
  FOR ALL
  USING (public.is_member_of(household_id))
  WITH CHECK (public.is_member_of(household_id));

CREATE INDEX IF NOT EXISTS economy_accounts_household_idx
  ON public.economy_accounts(household_id);
CREATE INDEX IF NOT EXISTS economy_accounts_member_idx
  ON public.economy_accounts(member_id);

-- ─── economy_buckets ──────────────────────────────────────────────────────────
-- Give, Save, Spend, Invest buckets per account, with optional save-goal tracking.

CREATE TABLE IF NOT EXISTS public.economy_buckets (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID        NOT NULL REFERENCES public.economy_accounts(id) ON DELETE CASCADE,
  type                  TEXT        NOT NULL,
  -- 'give' | 'save' | 'spend' | 'invest'
  balance_cents         INTEGER     NOT NULL DEFAULT 0,
  goal_label            TEXT,                     -- "New bike" | "Video game"
  goal_target_cents     INTEGER,                  -- null if no goal
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, type)
);

ALTER TABLE public.economy_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "economy_buckets_membership" ON public.economy_buckets;
CREATE POLICY "economy_buckets_membership" ON public.economy_buckets
  FOR ALL
  USING (public.is_member_of((SELECT household_id FROM public.economy_accounts WHERE id = account_id)))
  WITH CHECK (public.is_member_of((SELECT household_id FROM public.economy_accounts WHERE id = account_id)));

CREATE INDEX IF NOT EXISTS economy_buckets_account_idx
  ON public.economy_buckets(account_id);

-- ─── gigs ─────────────────────────────────────────────────────────────────────
-- Claimable work items, from either manual posting or maintenance automation.
-- Workflow: open → claimed → submitted → approved → paid

CREATE TABLE IF NOT EXISTS public.gigs (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id                 UUID        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title                        TEXT        NOT NULL,
  description                  TEXT,
  bounty_cents                 INTEGER     NOT NULL,        -- USD cents
  posted_by                    UUID        NOT NULL REFERENCES public.household_members(id) ON DELETE RESTRICT,
  claimed_by                   UUID        REFERENCES public.household_members(id) ON DELETE SET NULL,
  status                       TEXT        NOT NULL DEFAULT 'open',
  -- 'open' | 'claimed' | 'submitted' | 'approved' | 'paid'
  source_type                  TEXT        NOT NULL DEFAULT 'manual',
  -- 'manual' | 'maintenance_automation'
  linked_maintenance_item_id   UUID,                         -- if maintenance_automation
  payday_run_id                UUID,                         -- set when included in a payout
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at                 TIMESTAMPTZ                   -- when status changed to approved
);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gigs_membership" ON public.gigs;
CREATE POLICY "gigs_membership" ON public.gigs
  FOR ALL
  USING (public.is_member_of(household_id))
  WITH CHECK (public.is_member_of(household_id));

CREATE INDEX IF NOT EXISTS gigs_household_idx
  ON public.gigs(household_id);
CREATE INDEX IF NOT EXISTS gigs_status_idx
  ON public.gigs(status);
CREATE INDEX IF NOT EXISTS gigs_posted_by_idx
  ON public.gigs(posted_by);
CREATE INDEX IF NOT EXISTS gigs_claimed_by_idx
  ON public.gigs(claimed_by);
CREATE INDEX IF NOT EXISTS gigs_payday_run_idx
  ON public.gigs(payday_run_id);

-- ─── payday_settings ──────────────────────────────────────────────────────────
-- Household-level scheduling: when (frequency + anchor day) and what to do.

CREATE TABLE IF NOT EXISTS public.payday_settings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL UNIQUE REFERENCES public.households(id) ON DELETE CASCADE,
  frequency             TEXT        NOT NULL DEFAULT 'weekly',
  -- 'weekly' | 'biweekly'
  anchor_day            TEXT        NOT NULL DEFAULT 'friday',
  -- 'monday' | 'tuesday' | ... | 'sunday'
  active                BOOLEAN     NOT NULL DEFAULT true,
  next_run_at           TIMESTAMPTZ,                         -- calculated; used for scheduling
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payday_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payday_settings_membership" ON public.payday_settings;
CREATE POLICY "payday_settings_membership" ON public.payday_settings
  FOR ALL
  USING (public.is_member_of(household_id))
  WITH CHECK (public.is_member_of(household_id));

-- ─── payday_runs ──────────────────────────────────────────────────────────────
-- Audit trail: each scheduled payout batch (pending → approved → completed).

CREATE TABLE IF NOT EXISTS public.payday_runs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  period_start          DATE        NOT NULL,
  period_end            DATE        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'completed'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at           TIMESTAMPTZ,
  approved_by           UUID        REFERENCES public.household_members(id) ON DELETE SET NULL
);

ALTER TABLE public.payday_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payday_runs_membership" ON public.payday_runs;
CREATE POLICY "payday_runs_membership" ON public.payday_runs
  FOR ALL
  USING (public.is_member_of(household_id))
  WITH CHECK (public.is_member_of(household_id));

CREATE INDEX IF NOT EXISTS payday_runs_household_idx
  ON public.payday_runs(household_id, period_end DESC);
CREATE INDEX IF NOT EXISTS payday_runs_status_idx
  ON public.payday_runs(status);

-- ─── economy_transactions ─────────────────────────────────────────────────────
-- Ledger: every bucket movement (payday split, transfer, invest contribution, venture).

CREATE TABLE IF NOT EXISTS public.economy_transactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  account_id            UUID        NOT NULL REFERENCES public.economy_accounts(id) ON DELETE CASCADE,
  bucket_id             UUID        NOT NULL REFERENCES public.economy_buckets(id) ON DELETE RESTRICT,
  amount_cents          INTEGER     NOT NULL,
  kind                  TEXT        NOT NULL,
  -- 'payday_disbursement' | 'transfer' | 'invest_contribution'
  -- | 'venture_buyin' | 'venture_distribution' | 'give_out'
  ref_id                UUID,                         -- proposal_id, venture_id, etc (provenance)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.economy_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "economy_transactions_membership" ON public.economy_transactions;
CREATE POLICY "economy_transactions_membership" ON public.economy_transactions
  FOR ALL
  USING (public.is_member_of(household_id))
  WITH CHECK (public.is_member_of(household_id));

CREATE INDEX IF NOT EXISTS economy_transactions_account_idx
  ON public.economy_transactions(account_id);
CREATE INDEX IF NOT EXISTS economy_transactions_bucket_idx
  ON public.economy_transactions(bucket_id);
CREATE INDEX IF NOT EXISTS economy_transactions_kind_idx
  ON public.economy_transactions(kind);
CREATE INDEX IF NOT EXISTS economy_transactions_created_idx
  ON public.economy_transactions(created_at DESC);

-- ─── micro_ventures ───────────────────────────────────────────────────────────
-- Real small ventures (vending machine, lemonade stand, family business slice).

CREATE TABLE IF NOT EXISTS public.micro_ventures (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  description           TEXT,
  status                TEXT        NOT NULL DEFAULT 'open',
  -- 'open' | 'active' | 'closed'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.micro_ventures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "micro_ventures_membership" ON public.micro_ventures;
CREATE POLICY "micro_ventures_membership" ON public.micro_ventures
  FOR ALL
  USING (public.is_member_of(household_id))
  WITH CHECK (public.is_member_of(household_id));

CREATE INDEX IF NOT EXISTS micro_ventures_household_idx
  ON public.micro_ventures(household_id);

-- ─── micro_venture_stakes ─────────────────────────────────────────────────────
-- Ownership stakes in ventures: who owns what %, how much they put in.

CREATE TABLE IF NOT EXISTS public.micro_venture_stakes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id            UUID        NOT NULL REFERENCES public.micro_ventures(id) ON DELETE CASCADE,
  account_id            UUID        NOT NULL REFERENCES public.economy_accounts(id) ON DELETE CASCADE,
  contributed_cents     INTEGER     NOT NULL DEFAULT 0,
  percent_stake         NUMERIC(5, 2) NOT NULL,      -- 0.00 to 100.00
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venture_id, account_id)
);

ALTER TABLE public.micro_venture_stakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "micro_venture_stakes_membership" ON public.micro_venture_stakes;
CREATE POLICY "micro_venture_stakes_membership" ON public.micro_venture_stakes
  FOR ALL
  USING (public.is_member_of((SELECT household_id FROM public.micro_ventures WHERE id = venture_id)))
  WITH CHECK (public.is_member_of((SELECT household_id FROM public.micro_ventures WHERE id = venture_id)));

CREATE INDEX IF NOT EXISTS micro_venture_stakes_venture_idx
  ON public.micro_venture_stakes(venture_id);
CREATE INDEX IF NOT EXISTS micro_venture_stakes_account_idx
  ON public.micro_venture_stakes(account_id);

-- ─── linked_financial_accounts ────────────────────────────────────────────────
-- Read-only connections to custodial accounts (Plaid Tier 1: display only).
-- Never stores access tokens or write scope. Gig payouts happen outside this app.

CREATE TABLE IF NOT EXISTS public.linked_financial_accounts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id             UUID        NOT NULL REFERENCES public.household_members(id) ON DELETE CASCADE,
  provider              TEXT        NOT NULL DEFAULT 'plaid',
  plaid_item_id         TEXT,                         -- Plaid item token (secure server-side)
  plaid_account_id      TEXT,                         -- Plaid account_id within the item
  account_label         TEXT,                         -- User-facing name (e.g. "529 Plan")
  last_synced_balance_cents INTEGER,                  -- Last read balance for display
  last_synced_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.linked_financial_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "linked_financial_accounts_membership" ON public.linked_financial_accounts;
CREATE POLICY "linked_financial_accounts_membership" ON public.linked_financial_accounts
  FOR ALL
  USING (public.is_member_of(household_id))
  WITH CHECK (public.is_member_of(household_id));

CREATE INDEX IF NOT EXISTS linked_financial_accounts_household_idx
  ON public.linked_financial_accounts(household_id);
CREATE INDEX IF NOT EXISTS linked_financial_accounts_member_idx
  ON public.linked_financial_accounts(member_id);
