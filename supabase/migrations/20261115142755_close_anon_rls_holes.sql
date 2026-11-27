-- Close row level security holes that exposed household data to anyone.
--
-- Eight policies granted the `anon` role (or `public`, which includes it)
-- unrestricted access with `using (true)`. The anon/publishable key is not a
-- secret — it ships in the browser bundle of every page — so these were
-- readable, and in five cases writable and deletable, by anyone who viewed
-- the page source. Confirmed against production before this change:
--
--   GET /rest/v1/inbox_items?select=title,category,urgency&limit=3
--   with only the publishable key  ->  200, three rows of household finances
--
-- Every affected table except `vendors` already carries a correct
-- `<table>_membership` policy scoped by `is_member_of(household_id)`, so
-- dropping the permissive twin leaves the right rule in place rather than no
-- rule. `vendors` has no household_id to scope by and is empty and unused, so
-- it is left with RLS on and no policy — deny by default. The application is
-- unaffected either way: all of its table access runs through the service
-- role, which bypasses RLS, and no client-side code talks to Supabase.

-- ── Replay prerequisites ───────────────────────────────────────────────────
-- vendors and set_updated_at() were created by hand in production, never in a
-- migration, so a fresh database (supabase start, a branch, a restore) had
-- nothing for the statements below to act on. Both definitions are copied
-- from production's schema. On production itself these are no-ops: this
-- version was applied long ago and is never re-run.

create or replace function public.set_updated_at() returns trigger
  language plpgsql
  set search_path to ''
  as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.vendors (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  category       text,
  contact_name   text,
  email          text,
  phone          text,
  website        text,
  rating         integer     constraint vendors_rating_check check (rating is null or (rating >= 1 and rating <= 5)),
  notes          text,
  last_used_date date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists vendors_category_idx on public.vendors (category);
create index if not exists vendors_name_idx on public.vendors (name);
drop trigger if exists set_vendors_updated_at on public.vendors;
create trigger set_vendors_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();
alter table public.vendors enable row level security;

drop policy if exists "public can read daily briefings"     on public.daily_briefings;
drop policy if exists decisions_all                          on public.decisions;
drop policy if exists household_os_household_members_read    on public.household_members;
drop policy if exists household_os_maintenance_items_read    on public.maintenance_items;
drop policy if exists household_os_rules_all                 on public.rules;
drop policy if exists household_os_tasks_all                 on public.tasks;
drop policy if exists vendors_all                            on public.vendors;

-- Pin search_path on the trigger functions. Both already qualify their table
-- references (or touch none), so an empty path is safe and removes the
-- possibility of a shadowing object being resolved ahead of the real one.
alter function public.set_updated_at()             set search_path = '';
-- sync_inventory_on_purchase was dropped with inventory_items by migration
-- 20261115142605, so there is nothing left to pin.

-- increment_rule_consulted is the one that actually mattered: SECURITY DEFINER
-- with a mutable search_path is a privilege-escalation shape, and it was
-- callable by anon over /rest/v1/rpc. It referenced `rules` unqualified, which
-- is why the path could not simply be pinned — qualify it, then pin, then take
-- away the grant. Nothing in the application calls it.
create or replace function public.increment_rule_consulted(
  rule_id text,
  consulted_at timestamp with time zone
) returns void
language sql
security definer
set search_path = ''
as $function$
  update public.rules
  set times_consulted   = times_consulted + 1,
      last_consulted_at = consulted_at
  where id = rule_id;
$function$;

revoke execute on function public.increment_rule_consulted(text, timestamp with time zone)
  from anon, authenticated;
