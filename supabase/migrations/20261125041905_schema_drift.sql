-- Make production and a fresh replay of this folder agree.
--
-- Found by diffing `supabase db dump` of production against a local database
-- built from these migrations. Two differences, one in each direction:
--
-- 1. idx_vehicles_household_id exists in production but in no migration: it
--    was added by hand. Written down here so a rebuilt database has it too.
--
-- 2. vehicle_logs_household_id_fkey is declared by the vehicle_logs migration
--    but missing in production, where the table already existed when that
--    migration's `create table if not exists` ran, so the whole definition —
--    foreign key included — was skipped. All existing rows were checked to
--    reference a real household before this was added.

create index if not exists idx_vehicles_household_id on public.vehicles (household_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vehicle_logs'::regclass and conname = 'vehicle_logs_household_id_fkey'
  ) then
    alter table public.vehicle_logs
      add constraint vehicle_logs_household_id_fkey
      foreign key (household_id) references public.households (id) on delete cascade;
  end if;
end $$;
