-- Scheduled car services (oil, filters, fluids...) with intervals and an
-- estimated cost, so the app can forecast what the year will cost.
create table if not exists public.vehicle_services (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  item text not null check (length(item) between 1 and 80),
  interval_miles integer check (interval_miles is null or interval_miles > 0),
  interval_months integer check (interval_months is null or interval_months > 0),
  est_cost numeric(10,2) not null default 0 check (est_cost >= 0),
  last_done_miles integer,
  last_done_date date,
  notes text,
  created_at timestamptz not null default now(),
  check (interval_miles is not null or interval_months is not null)
);
create index if not exists vehicle_services_household_idx on public.vehicle_services (household_id, vehicle_id);
alter table public.vehicle_services enable row level security;
revoke all on public.vehicle_services from anon, authenticated;
grant all on public.vehicle_services to service_role;
grant select on public.vehicle_services to authenticated;
drop policy if exists vehicle_services_member_read on public.vehicle_services;
create policy vehicle_services_member_read on public.vehicle_services
  for select to authenticated using (public.is_member_of(household_id));

-- Estimated cost of a home upkeep job, per time it is done.
alter table public.maintenance_items add column if not exists est_cost numeric(10,2);
