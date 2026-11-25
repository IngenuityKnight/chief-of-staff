-- Local-only test data. Loaded by `supabase db reset`, never by production.
--
-- Everything here is fake and labelled as such, so a screenshot of the local
-- app can't be mistaken for the real household. The household row itself
-- comes from the multitenancy migration.

insert into public.maintenance_items (id, household_id, item, system, frequency, last_done, next_due, status) values
  ('mnt_local_1', '00000000-0000-0000-0000-000000000001', 'Change HVAC filter',     'HVAC',     'quarterly', now() - interval '80 days', now() + interval '10 days', 'ok'),
  ('mnt_local_2', '00000000-0000-0000-0000-000000000001', 'Water heater flush',     'Plumbing', 'annual',    null,                       now() - interval '3 days',  'ok'),
  ('mnt_local_3', '00000000-0000-0000-0000-000000000001', 'Smoke detectors tested', 'Safety',   'monthly',   now() - interval '20 days', now() + interval '10 days', 'ok')
on conflict (id) do nothing;

insert into public.vehicles (id, household_id, make, model, year, mileage, tank_gallons, notes) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Test', 'Sedan (local)', 2008, 200000, 18.5, 'Local seed data'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Test', 'Crossover (local)', 2022, 50000, 14.5, 'Local seed data')
on conflict (id) do nothing;

insert into public.routine_items (household_id, label, time_of_day, days, interval_weeks, anchor_date) values
  ('00000000-0000-0000-0000-000000000001', 'Daycare drop-off (local)', '08:00', '{1,2,3,4,5}', 1, null),
  ('00000000-0000-0000-0000-000000000001', 'Cleaner (local)',          '09:00', '{2}',         2, current_date);
