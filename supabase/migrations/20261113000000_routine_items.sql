-- Intentionally empty. The routine_items table this file used to create now
-- lives at the end of 20261113032945_households_and_multitenancy.sql.
--
-- This version was applied in production after households existed, but sorts
-- before the migration that creates households, so replaying it on a fresh
-- database failed. The file stays (empty) because production's migration
-- history lists this version; deleting it would make the history disagree
-- with the repo.
select 1;
