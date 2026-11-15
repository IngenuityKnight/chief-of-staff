-- Drop the intake, inventory and activity tables.
--
-- No application code reads any of the three: the UI covers tasks, meals,
-- routine, bills, upkeep and cars, and these were never wired to it. They held
-- real rows (112 inbox items, 54 inventory items, 190 activity entries, backed
-- up before this ran), but data nothing can display is a liability rather than
-- an asset, and keeping the schema honest about what the app actually does
-- makes the next feature cheaper to reason about.
--
-- CASCADE is required rather than incidental. inbox_items is referenced by
-- agent_runs, decisions, plays, proposals and tasks; inventory_items by
-- inventory_purchases and shopping_list_items. Every one of those dependants
-- is empty, so CASCADE drops foreign-key constraints, not rows.
--
-- tasks is the exception worth calling out: it is a live table behind the
-- To-dos section, so its orphaned column goes explicitly rather than being
-- left pointing at something that no longer exists.

alter table if exists public.tasks drop column if exists inbox_item_id;

drop table if exists public.inbox_items cascade;
drop table if exists public.inventory_items cascade;
drop table if exists public.activity_log cascade;
