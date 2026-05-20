-- ─── household_context ────────────────────────────────────────────────────────
-- Single-row config table keyed on id = 'default'.

create table if not exists public.household_context (
  id                text        primary key default 'default',
  household_name    text,
  address           text,
  timezone          text        not null default 'America/Chicago',
  members_summary   text,
  budget_monthly    numeric(12, 2),
  frugal_mode       boolean     not null default true,
  ai_persona        text,
  preferences       jsonb       not null default '{}'::jsonb,
  goals             text,
  updated_at        timestamptz not null default now()
);

alter table public.household_context enable row level security;

-- ─── activity_log ─────────────────────────────────────────────────────────────
-- Append-only event stream for cross-agent activity.

create table if not exists public.activity_log (
  id            uuid        primary key default gen_random_uuid(),
  occurred_at   timestamptz not null default now(),
  event_type    text        not null,
  domain        text        not null,
  entity_id     text,
  entity_title  text        not null,
  actor         text        not null default 'system',
  metadata      jsonb       not null default '{}'::jsonb
);

alter table public.activity_log enable row level security;

create index if not exists activity_log_occurred_at_idx  on public.activity_log (occurred_at desc);
create index if not exists activity_log_event_type_idx   on public.activity_log (event_type);
create index if not exists activity_log_domain_idx       on public.activity_log (domain);

-- ─── decisions: add chosen_option + outcome_notes ─────────────────────────────

alter table public.decisions
  add column if not exists chosen_option  text,
  add column if not exists outcome_notes  text;

-- ─── tasks: add recurring_rule, template_id, completed_at ────────────────────

alter table public.tasks
  add column if not exists recurring_rule text,
  add column if not exists template_id    text,
  add column if not exists completed_at   timestamptz;

-- ─── maintenance_items: add auto_create_task, last_task_id ───────────────────

alter table public.maintenance_items
  add column if not exists auto_create_task boolean not null default true,
  add column if not exists last_task_id     text;

-- ─── RLS: remove overly-permissive policies from service-role-only tables ─────
-- These tables are only accessed via the service role key (server-side).
-- With RLS enabled and no policies, anon/authenticated roles are denied by default.
-- The service_role bypasses RLS entirely.

drop policy if exists "shopping_list_all" on public.shopping_list_items;
drop policy if exists "inventory_items_all" on public.inventory_items;
drop policy if exists "vehicles_all" on public.vehicles;
drop policy if exists "appliances_all" on public.appliances;
