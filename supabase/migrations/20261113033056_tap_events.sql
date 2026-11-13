-- NFC tap log: one row per physical-tag tap (see lib/tap-tags.ts, app/api/tap).
create table if not exists public.tap_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  slug text not null,
  label text not null,
  created_at timestamptz not null default now()
);

create index if not exists tap_events_household_created_idx
  on public.tap_events (household_id, created_at desc);

alter table public.tap_events enable row level security;

revoke all on public.tap_events from anon, authenticated;
grant all on public.tap_events to service_role;
grant select on public.tap_events to authenticated;

drop policy if exists tap_events_member_read on public.tap_events;
create policy tap_events_member_read on public.tap_events
  for select to authenticated
  using (public.is_member_of(household_id));
