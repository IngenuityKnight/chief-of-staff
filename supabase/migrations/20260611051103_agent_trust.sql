-- Step 3: agent_trust table (BACKEND-BRIEF.md §7.3)
-- Trust levels: 0=always ask, 1=auto≤$50, 2=auto≤$200, 3=auto (no cost limit)
-- household_id added in Step 7 (multi-tenant hardening).
create table if not exists agent_trust (
  agent       text not null,
  kind        text not null,          -- proposal kind this trust applies to
  level       int  not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (agent, kind)
);
