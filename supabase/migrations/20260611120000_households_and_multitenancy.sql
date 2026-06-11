-- Phase 1: multi-tenancy foundation (NEXT-LEVEL-BRIEF.md Phase 1, BACKEND-BRIEF.md §7.7)
--
-- Adds households + household_memberships, backfills every private table with
-- household_id pointed at a single default household (so existing data and
-- service-role reads keep working), creates events + plays tables, and writes
-- RLS policies via membership. Service role bypasses RLS — anon/authenticated
-- access requires a row in household_memberships matching auth.uid().
--
-- IMPORTANT: existing tables use mixed PK types (text for some, uuid for others).
-- household_id is always uuid so it lines up with households.id.

-- ─── households + memberships ────────────────────────────────────────────────

create table if not exists public.households (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  inbound_address_token text unique,        -- per-household inbound email token (Phase 3)
  created_at  timestamptz not null default now()
);

create table if not exists public.household_memberships (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null,               -- auth.users.id; not FK'd to allow service-role seeds
  role         text not null default 'owner', -- owner | member
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_memberships_user_idx
  on public.household_memberships(user_id);

-- Seed the default household for backwards-compat with existing single-tenant data
insert into public.households (id, name)
  values ('00000000-0000-0000-0000-000000000001', 'Default Household')
  on conflict (id) do nothing;

-- ─── events: transactional outbox (BACKEND-BRIEF.md §3) ──────────────────────

create table if not exists public.events (
  id           bigint generated always as identity primary key,
  household_id uuid   not null references public.households(id) on delete cascade,
  type         text   not null,
  entity_id    text,
  payload      jsonb,
  delivered_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists events_pending_idx
  on public.events(created_at) where delivered_at is null;
create index if not exists events_household_type_idx
  on public.events(household_id, type, created_at desc);

-- ─── plays: one capture → coordinated multi-domain card (Phase 2 / F2) ───────

create table if not exists public.plays (
  id             text primary key,
  household_id   uuid not null references public.households(id) on delete cascade,
  inbox_item_id  text references public.inbox_items(id) on delete cascade,
  synthesis      text not null,            -- "the play" sentence, LLM-authored
  status         text not null default 'awaiting_approval',
                                           -- awaiting_approval | partial | approved
                                           -- | declined | executed | expired
  created_at     timestamptz not null default now()
);

create index if not exists plays_inbox_item_idx on public.plays(inbox_item_id);
create index if not exists plays_household_status_idx on public.plays(household_id, status, created_at desc);

-- ─── add household_id everywhere ─────────────────────────────────────────────

alter table public.inbox_items         add column if not exists household_id uuid;
alter table public.tasks               add column if not exists household_id uuid;
alter table public.maintenance_items   add column if not exists household_id uuid;
alter table public.bills               add column if not exists household_id uuid;
alter table public.calendar_events     add column if not exists household_id uuid;
alter table public.household_members   add column if not exists household_id uuid;
alter table public.rules               add column if not exists household_id uuid;
alter table public.meal_plan_days      add column if not exists household_id uuid;
alter table public.household_context   add column if not exists household_id uuid;
alter table public.activity_log        add column if not exists household_id uuid;
alter table public.inventory_items     add column if not exists household_id uuid;
alter table public.vehicles            add column if not exists household_id uuid;
alter table public.appliances          add column if not exists household_id uuid;
alter table public.shopping_list_items add column if not exists household_id uuid;
alter table public.decisions           add column if not exists household_id uuid;
alter table public.transactions        add column if not exists household_id uuid;
alter table public.plaid_connections   add column if not exists household_id uuid;
alter table public.plaid_accounts      add column if not exists household_id uuid;
alter table public.proposals           add column if not exists household_id uuid;
alter table public.proposals           add column if not exists play_id text references public.plays(id) on delete set null;
alter table public.agent_runs          add column if not exists household_id uuid;
alter table public.agent_trust         add column if not exists household_id uuid;
alter table public.daily_briefings     add column if not exists household_id uuid;

-- Backfill: every existing row belongs to the default household
update public.inbox_items         set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.tasks               set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.maintenance_items   set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.bills               set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.calendar_events     set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.household_members   set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.rules               set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.meal_plan_days      set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.household_context   set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.activity_log        set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.inventory_items     set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.vehicles            set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.appliances          set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.shopping_list_items set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.decisions           set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.transactions        set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.plaid_connections   set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.plaid_accounts      set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.proposals           set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.agent_runs          set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.agent_trust         set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;
update public.daily_briefings     set household_id = '00000000-0000-0000-0000-000000000001' where household_id is null;

-- Make household_id required + FK'd
alter table public.inbox_items         alter column household_id set not null;
alter table public.tasks               alter column household_id set not null;
alter table public.maintenance_items   alter column household_id set not null;
alter table public.bills               alter column household_id set not null;
alter table public.calendar_events     alter column household_id set not null;
alter table public.household_members   alter column household_id set not null;
alter table public.rules               alter column household_id set not null;
alter table public.meal_plan_days      alter column household_id set not null;
alter table public.household_context   alter column household_id set not null;
alter table public.activity_log        alter column household_id set not null;
alter table public.inventory_items     alter column household_id set not null;
alter table public.vehicles            alter column household_id set not null;
alter table public.appliances          alter column household_id set not null;
alter table public.shopping_list_items alter column household_id set not null;
alter table public.decisions           alter column household_id set not null;
alter table public.transactions        alter column household_id set not null;
alter table public.plaid_connections   alter column household_id set not null;
alter table public.plaid_accounts      alter column household_id set not null;
alter table public.proposals           alter column household_id set not null;
alter table public.agent_runs          alter column household_id set not null;
alter table public.agent_trust         alter column household_id set not null;
alter table public.daily_briefings     alter column household_id set not null;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'inbox_items','tasks','maintenance_items','bills','calendar_events',
      'household_members','rules','meal_plan_days','household_context','activity_log',
      'inventory_items','vehicles','appliances','shopping_list_items','decisions',
      'transactions','plaid_connections','plaid_accounts','proposals','agent_runs',
      'agent_trust','daily_briefings','events','plays'
    ])
  loop
    execute format(
      'alter table public.%I add constraint %I_household_id_fk
         foreign key (household_id) references public.households(id) on delete cascade
         not valid',
      t, t
    );
  exception when duplicate_object then null;
  end loop;
end$$;

-- Composite indexes for household-scoped queries (the hot path)
create index if not exists inbox_items_household_created_idx     on public.inbox_items(household_id, created_at desc);
create index if not exists tasks_household_status_idx            on public.tasks(household_id, status);
create index if not exists proposals_household_status_idx        on public.proposals(household_id, status, created_at desc);
create index if not exists agent_runs_household_created_idx      on public.agent_runs(household_id, created_at desc);
create index if not exists activity_log_household_occurred_idx   on public.activity_log(household_id, occurred_at desc);

-- ─── RLS policies (membership-gated) ─────────────────────────────────────────
-- Service role bypasses RLS, so this only affects anon/authenticated.
-- A user with auth.uid() X can read/write any row whose household_id appears
-- in household_memberships(user_id = X).

alter table public.households            enable row level security;
alter table public.household_memberships enable row level security;
alter table public.events                enable row level security;
alter table public.plays                 enable row level security;
alter table public.proposals             enable row level security;
alter table public.agent_runs            enable row level security;
alter table public.agent_trust           enable row level security;
alter table public.daily_briefings       enable row level security;

create or replace function public.is_member_of(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_memberships
    where household_id = target_household and user_id = auth.uid()
  );
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'inbox_items','tasks','maintenance_items','bills','calendar_events',
      'household_members','rules','meal_plan_days','household_context','activity_log',
      'inventory_items','vehicles','appliances','shopping_list_items','decisions',
      'transactions','plaid_accounts','proposals','agent_runs','agent_trust',
      'daily_briefings','events','plays'
    ])
  loop
    -- drop legacy permissive policies if present, replace with membership gate
    execute format('drop policy if exists "%s_all" on public.%I', t, t);
    execute format('drop policy if exists "%s_membership" on public.%I', t, t);
    execute format(
      'create policy "%s_membership" on public.%I
         for all
         using (public.is_member_of(household_id))
         with check (public.is_member_of(household_id))',
      t, t
    );
  end loop;
end$$;

-- households: members can read their own
drop policy if exists "households_read_own" on public.households;
create policy "households_read_own" on public.households
  for select
  using (public.is_member_of(id));

-- household_memberships: a user can see their own memberships
drop policy if exists "memberships_self_read" on public.household_memberships;
create policy "memberships_self_read" on public.household_memberships
  for select
  using (user_id = auth.uid());

-- plaid_connections stays service-role only (access_token is sensitive).
-- No policies = deny all to anon/authenticated. Service role bypasses.
