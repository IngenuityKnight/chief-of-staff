-- Drop the agent layer's empty skeleton.
--
-- These nine tables describe an intake-and-approval pipeline that was designed
-- but never run: raw captures became inbox items, agents produced proposals
-- grouped into plays, humans recorded decisions, and agent_runs logged the
-- model calls. Not one of them ever held a row, and no application code reads
-- any of them. Their parent, inbox_items, has already gone.
--
-- Deliberately NOT dropped, despite looking similar: appliances, vendors,
-- rules, household_members, calendar_events, shopping_list_items and the three
-- Plaid tables all contain real household data.
--
-- tasks is live, behind the To-dos section, so its orphaned foreign key to
-- proposals is removed explicitly rather than by cascade.

alter table if exists public.tasks drop column if exists proposal_id;

drop table if exists public.agent_runs cascade;
drop table if exists public.agent_trust cascade;
drop table if exists public.daily_briefings cascade;
drop table if exists public.decisions cascade;
drop table if exists public.events cascade;
drop table if exists public.household_captures cascade;
drop table if exists public.inventory_purchases cascade;
drop table if exists public.plays cascade;
drop table if exists public.proposals cascade;
