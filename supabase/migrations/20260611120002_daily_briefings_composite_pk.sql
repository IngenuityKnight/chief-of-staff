-- The daily_briefings table was created with date as the sole PK. After
-- multi-tenancy, the PK has to be (date, household_id) so multiple households
-- can have a briefing on the same date.

alter table public.daily_briefings drop constraint if exists daily_briefings_pkey;
alter table public.daily_briefings add primary key (date, household_id);
