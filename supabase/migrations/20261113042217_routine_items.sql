create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  time_of_day text not null check (time_of_day ~ '^[0-2][0-9]:[0-5][0-9]$'),
  days smallint[] not null default '{0,1,2,3,4,5,6}',
  who text,
  created_at timestamptz not null default now()
);
create index if not exists routine_items_household_idx on public.routine_items (household_id, time_of_day);
alter table public.routine_items enable row level security;
revoke all on public.routine_items from anon, authenticated;
grant all on public.routine_items to service_role;
grant select on public.routine_items to authenticated;
drop policy if exists routine_items_member_read on public.routine_items;
create policy routine_items_member_read on public.routine_items
  for select to authenticated using (public.is_member_of(household_id));
update public.household_context set timezone = 'America/New_York' where household_id = '00000000-0000-0000-0000-000000000001';
update public.households set name = 'Burden House' where id = '00000000-0000-0000-0000-000000000001';
