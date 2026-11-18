-- Milestones inherited their household through their goal, which was tidy and
-- wrong in two places: the export scopes every table by household_id and would
-- have skipped this one entirely — a backup with a hole in it — and the RLS
-- policy had to run a subquery for every row it checked.
--
-- Denormalising one uuid is the cheaper answer than special-casing both.

alter table public.milestones
  add column if not exists household_id uuid references public.households (id) on delete cascade;

update public.milestones m
   set household_id = g.household_id
  from public.goals g
 where g.id = m.goal_id and m.household_id is null;

alter table public.milestones alter column household_id set not null;

create index if not exists milestones_household_idx on public.milestones (household_id);

drop policy if exists milestones_membership on public.milestones;
create policy milestones_membership on public.milestones for all
  using (public.is_member_of(household_id))
  with check (public.is_member_of(household_id));
