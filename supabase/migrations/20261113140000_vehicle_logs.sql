-- Vehicle fuel/odometer logs. `vehicles` already exists from initial_schema.
-- Mirrors the table as created on the live project, and turns on RLS
-- using the same pattern as routine_items / vehicle_services.

create table if not exists public.vehicle_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  odometer_miles integer not null,
  gallons_pumped numeric(5,2),
  cost_dollars numeric(8,2),
  location text,
  fuel_type text,
  notes text,
  log_date timestamp not null default now(),
  created_at timestamp default now(),
  constraint odometer_positive check (odometer_miles > 0),
  constraint gallons_positive check (gallons_pumped > 0 or gallons_pumped is null),
  constraint cost_positive check (cost_dollars > 0 or cost_dollars is null)
);

create index if not exists idx_vehicle_logs_vehicle_id on public.vehicle_logs (vehicle_id);
create index if not exists idx_vehicle_logs_log_date on public.vehicle_logs (log_date desc);
create index if not exists idx_vehicle_logs_household_id on public.vehicle_logs (household_id);

alter table public.vehicle_logs enable row level security;
revoke all on public.vehicle_logs from anon, authenticated;
grant all on public.vehicle_logs to service_role;
grant select on public.vehicle_logs to authenticated;
drop policy if exists vehicle_logs_member_read on public.vehicle_logs;
create policy vehicle_logs_member_read on public.vehicle_logs
  for select to authenticated using (public.is_member_of(household_id));
