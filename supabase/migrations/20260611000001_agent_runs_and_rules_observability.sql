-- Step 2 of the proposal-economy migration (BACKEND-BRIEF.md §7.2)
--
-- agent_runs: observability for every LLM invocation.
--   "Phase 6 (tune prompts from real usage) is impossible without this."
--
-- proposals: rules provenance — which rules informed/conflict with each proposal.
--
-- rules: usage counters — dead rules should be visible before we invest in them.

create table if not exists agent_runs (
  id                text primary key,
  agent             text not null,
  trigger           text not null,           -- 'capture' | 'scanner' | 'approval' | 'briefing'
  inbox_item_id     text references inbox_items(id) on delete set null,
  model             text,
  prompt_tokens     int,
  completion_tokens int,
  latency_ms        int,
  input_summary     text,
  output            jsonb,
  ok                boolean not null,
  error             text,
  created_at        timestamptz not null default now()
);

create index if not exists agent_runs_agent_created
  on agent_runs(agent, created_at desc);

-- which rules the LLM cited as informing this proposal
alter table proposals
  add column if not exists rules_consulted text[] not null default '{}',
  add column if not exists rules_conflicts text[] not null default '{}';

-- how often each rule is cited — unused rules should be pruned or rewritten
alter table rules
  add column if not exists times_consulted  int         not null default 0,
  add column if not exists last_consulted_at timestamptz;
