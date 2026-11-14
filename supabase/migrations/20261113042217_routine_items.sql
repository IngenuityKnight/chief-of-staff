-- Household defaults for the seeded Burden House household.
--
-- The routine_items table itself is created in 20261113000000_routine_items.sql;
-- this migration originally repeated that DDL, which was redundant. All that was
-- ever unique to it are the two seed updates below. Kept under its original
-- filename because this version is already recorded as applied.

update public.household_context set timezone = 'America/New_York' where household_id = '00000000-0000-0000-0000-000000000001';
update public.households set name = 'Burden House' where id = '00000000-0000-0000-0000-000000000001';
