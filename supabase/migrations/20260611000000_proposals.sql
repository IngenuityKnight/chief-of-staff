-- Step 1 of the proposal-economy migration (BACKEND-BRIEF.md §7.1)
--
-- Adds the `proposals` table so intake can emit structured intents that require
-- human approval before any domain table is written to.  Also:
--   • inbox_items.origin  — distinguishes human captures from scanner-emitted items
--   • tasks.proposal_id   — provenance chain: task ← proposal ← inbox item ← capture
--
-- Note: existing tables use text PKs (crypto.randomUUID() stored as text),
-- so proposals follows the same convention for FK compatibility.

create table if not exists proposals (
  id                   text primary key,
  inbox_item_id        text references inbox_items(id) on delete cascade,
  agent                text not null,
  kind                 text not null,         -- 'create_task' | future kinds
  title                text not null,
  rationale            text not null,         -- shown to user: why the agent proposes this
  payload              jsonb not null,        -- typed per kind; validated before insert
  estimated_cost_cents int  not null default 0,
  status               text not null default 'awaiting_approval',
                                             -- awaiting_approval | approved | declined
                                             -- | auto_executed | executed | failed | expired
  decided_by           text,                 -- 'user' | 'policy'
  decided_at           timestamptz,
  executed_at          timestamptz,
  expires_at           timestamptz,
  created_at           timestamptz not null default now()
);

-- human-capture vs scanner-originated items (proactivity pipeline, Step 5)
alter table inbox_items
  add column if not exists origin text not null default 'capture';

-- provenance: every task traces back to the proposal that created it
alter table tasks
  add column if not exists proposal_id text references proposals(id);

-- fast lookup: all pending proposals for an inbox item
create index if not exists proposals_inbox_item_status
  on proposals(inbox_item_id, status);
