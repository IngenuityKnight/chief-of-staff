-- Routine could only repeat weekly. Some things that belong on a schedule do
-- not: a cleaner every other Tuesday, a fortnightly collection, anything on an
-- alternating rota.
--
-- interval_weeks says how many weeks apart, and anchor_date says which week is
-- an "on" week. Without the anchor the interval means nothing — "every other
-- Tuesday" is only well defined once you say which Tuesday.
--
-- Defaults keep every existing row weekly, so nothing already here changes.

alter table public.routine_items
  add column if not exists interval_weeks int  not null default 1,
  add column if not exists anchor_date    date;

alter table public.routine_items
  drop constraint if exists routine_items_interval_weeks_check;
alter table public.routine_items
  add constraint routine_items_interval_weeks_check check (interval_weeks between 1 and 8);
