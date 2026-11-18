-- A snapshot of what Monarch says recurs, so the dashboard can say "BGE on
-- Friday" without anyone opening Monarch.
--
-- A snapshot rather than a live read because there is no way to make it live:
-- Monarch has no API the server can call, and the connector that can read it
-- lives in a Claude session, not in this app. Refreshing is therefore a
-- deliberate act, which is why captured_at is displayed rather than hidden —
-- a copy whose age you cannot see is how the old Bills section went four
-- months wrong without anyone noticing.
--
-- This is deliberately NOT tasks. Most of these are autopay and need nobody;
-- a row that appears on its own and has to be dismissed teaches you to
-- dismiss without reading, which is how the one that did need you gets
-- missed. Nothing here is tickable.
--
-- Category is not stored. The strip needs a name, an amount and a date, and
-- what someone spends money on is the most sensitive column Monarch holds.

create table if not exists public.recurring_snapshot (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind         text not null check (kind in ('income', 'expense')),
  name         text not null,
  amount       numeric not null,
  frequency    text,
  next_date    date,
  captured_at  timestamptz not null default now()
);

create index if not exists recurring_snapshot_idx
  on public.recurring_snapshot (household_id, next_date);

alter table public.recurring_snapshot enable row level security;

drop policy if exists recurring_snapshot_membership on public.recurring_snapshot;
create policy recurring_snapshot_membership on public.recurring_snapshot for all
  using (public.is_member_of(household_id))
  with check (public.is_member_of(household_id));
