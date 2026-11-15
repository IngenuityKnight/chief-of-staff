-- Drop the Plaid tables and the local calendar mirror.
--
-- Unlike the previous two migrations, these are not empty: 1 bank connection,
-- 10 accounts, 32 transactions and 3 calendar events. All were exported to
-- JSON first. No application code reads any of them.
--
-- calendar_events duplicated a source the app already has. The wall reads
-- Google Calendar live through lib/server/wall.ts, so this table could only
-- ever be a second, staler answer to the same question.
--
-- The Plaid tables stopped syncing on 10 July and nothing replaced them.
-- plaid_connections.access_token in particular is a live bank credential
-- sitting in a table no code manages, which is a liability with no offsetting
-- benefit. Dropping the row does NOT revoke it: that has to be done at Plaid,
-- and is tracked separately.
--
-- Nothing outside this group holds a foreign key to any of them, so the order
-- below is the natural dependency order rather than a cascade.

drop table if exists public.transactions cascade;
drop table if exists public.plaid_accounts cascade;
drop table if exists public.plaid_connections cascade;
drop table if exists public.calendar_events cascade;
