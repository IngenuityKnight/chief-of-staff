-- Tenant isolation hardening (audit S5, B3, B4).
--
-- 1. inventory_purchases was created after the multitenancy pass and never got
--    a household_id — add it, backfill from the owning inventory item, and
--    replace its "Allow all" policy with the membership gate.
-- 2. shopping_list_items kept its legacy permissive policy because its name
--    ("shopping_list_all") didn't match the drop pattern in 20260611120000.
-- 3. plaid_accounts kept a permissive anon SELECT policy from the Plaid
--    migration; policies are OR'd, so it must be dropped explicitly.
-- 4. meal_plan_days was keyed on date alone — two households could not both
--    have a plan for the same day, and upserts crossed tenants. Re-key on
--    (household_id, date).
-- 5. household_context was keyed on id = 'default' — one row for the whole
--    product. Key it per household instead.

-- ─── 1. inventory_purchases: household_id + membership policy ────────────────

alter table public.inventory_purchases add column if not exists household_id uuid;

update public.inventory_purchases p
set household_id = coalesce(
  (select i.household_id from public.inventory_items i where i.id = p.inventory_item_id),
  '00000000-0000-0000-0000-000000000001'
)
where p.household_id is null;

alter table public.inventory_purchases alter column household_id set not null;

do $$
begin
  alter table public.inventory_purchases
    add constraint inventory_purchases_household_id_fk
    foreign key (household_id) references public.households(id) on delete cascade
    not valid;
exception when duplicate_object then null;
end$$;

create index if not exists inventory_purchases_household_idx
  on public.inventory_purchases(household_id, recorded_at desc);

drop policy if exists "Allow all" on public.inventory_purchases;
drop policy if exists "inventory_purchases_membership" on public.inventory_purchases;
create policy "inventory_purchases_membership" on public.inventory_purchases
  for all
  using (public.is_member_of(household_id))
  with check (public.is_member_of(household_id));

-- ─── 2. shopping_list_items: drop the surviving permissive policy ────────────

drop policy if exists "shopping_list_all" on public.shopping_list_items;

-- ─── 3. plaid_accounts: drop the anon-readable policy ────────────────────────

drop policy if exists "plaid_accounts_read" on public.plaid_accounts;

-- ─── 4. meal_plan_days: per-household primary key ────────────────────────────

alter table public.meal_plan_days drop constraint if exists meal_plan_days_pkey;
alter table public.meal_plan_days add primary key (household_id, date);

-- ─── 5. household_context: one row per household ─────────────────────────────

-- New rows get a unique id instead of colliding on 'default'.
alter table public.household_context alter column id set default gen_random_uuid()::text;

create unique index if not exists household_context_household_uidx
  on public.household_context(household_id);
