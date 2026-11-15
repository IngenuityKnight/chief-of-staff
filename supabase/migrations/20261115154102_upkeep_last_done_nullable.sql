-- "Never done" is a real state for an upkeep job, and the one every job is in
-- before its first completion. UpkeepItem.lastDone has always been optional in
-- the application; only the column disagreed, which forced a date to be
-- invented for a job nobody has done yet.
alter table public.maintenance_items alter column last_done drop not null;
