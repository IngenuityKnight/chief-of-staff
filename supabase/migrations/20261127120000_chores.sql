-- Chores: recurring housework with a cadence, and a history of what was done.
--
-- A chore holds exactly one next_due date. Missed occurrences are never
-- materialised as rows, so a week away leaves one overdue chore rather than
-- seven. chore_events is the history: every completion, skip and reschedule,
-- with the due date before and after, so nothing that happened is lost when
-- next_due moves.
--
-- Separate from upkeep on purpose. Upkeep is maintenance on things (filters,
-- detectors, the water heater) on fixed long frequencies; chores are the
-- weekly rhythm of keeping a house, with days of the week, assignees and a
-- choice of how lateness carries forward.

create table if not exists public.chores (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  name              text not null check (length(name) between 1 and 120),
  room              text not null default '',
  assignee          text,
  cadence_kind      text not null check (cadence_kind in ('days', 'weekdays', 'weeks', 'months')),
  cadence_interval  int  not null default 1 check (cadence_interval between 1 and 365),
  cadence_weekdays  int[] not null default '{}',
  -- scheduled: keep the calendar rhythm from start_date.
  -- completion: the next interval starts when it is actually done.
  anchor            text not null default 'scheduled' check (anchor in ('scheduled', 'completion')),
  start_date        date not null,
  next_due          date not null,
  estimate_minutes  int check (estimate_minutes between 1 and 1440),
  notes             text,
  status            text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists chores_household_due_idx on public.chores (household_id, status, next_due);

create table if not exists public.chore_events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  chore_id      uuid not null references public.chores (id) on delete cascade,
  kind          text not null check (kind in ('completed', 'skipped', 'rescheduled')),
  on_date       date not null,
  due_date      date,
  new_due       date,
  actor         text,
  created_at    timestamptz not null default now()
);

create index if not exists chore_events_household_idx on public.chore_events (household_id, created_at desc);
create index if not exists chore_events_chore_idx on public.chore_events (chore_id, created_at desc);

alter table public.chores enable row level security;
alter table public.chore_events enable row level security;

drop policy if exists chores_membership on public.chores;
create policy chores_membership on public.chores for all
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

drop policy if exists chore_events_membership on public.chore_events;
create policy chore_events_membership on public.chore_events for all
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

-- A few sample chores so the screen is useful on first open, for any
-- household that has none yet. Dates are relative to the day this runs: a
-- couple already due, a couple soon, one paused. Edit or archive freely.
insert into public.chores
  (household_id, name, room, assignee, cadence_kind, cadence_interval, cadence_weekdays,
   anchor, start_date, next_due, estimate_minutes, notes, status)
select h.id, s.name, s.room, s.assignee, s.kind, s.n, s.wd, s.anchor, s.due, s.due, s.mins, s.notes, s.status
from public.households h
cross join lateral (
  with d as (select current_date as t, extract(dow from current_date)::int as dow)
  select * from (values
    ('Wipe kitchen counters', 'Kitchen', null, 'days', 1, '{}'::int[], 'scheduled', (select t from d), 5, null, 'active'),
    ('Run and empty dishwasher', 'Kitchen', null, 'days', 1, '{}'::int[], 'scheduled', (select t - 1 from d), 10, null, 'active'),
    ('Take out trash and recycling', 'Outside', 'Cameron', 'weekdays', 1, '{2}'::int[], 'scheduled',
       (select t + ((2 - dow + 7) % 7) from d), 10, 'Recycling goes out every week with the trash.', 'active'),
    ('Laundry', 'Laundry room', 'Corine', 'weekdays', 1, '{1,4}'::int[], 'scheduled',
       (select least(t + ((1 - dow + 7) % 7), t + ((4 - dow + 7) % 7)) from d), 45, null, 'active'),
    ('Vacuum living room', 'Living room', null, 'weeks', 1, '{}'::int[], 'completion', (select t - 2 from d), 20, null, 'active'),
    ('Water plants', 'Living room', null, 'days', 4, '{}'::int[], 'completion', (select t + 1 from d), 5, null, 'active'),
    ('Sanitize Charlie''s toys', 'Nursery', null, 'weeks', 1, '{}'::int[], 'scheduled', (select t + 2 from d), 15, null, 'active'),
    ('Clean bathrooms', 'Bathroom', null, 'weeks', 2, '{}'::int[], 'scheduled', (select t + 3 from d), 30, null, 'active'),
    ('Change bed sheets', 'Bedroom', null, 'weeks', 2, '{}'::int[], 'completion', (select t + 5 from d), 15, null, 'active'),
    ('Clear out the fridge', 'Kitchen', null, 'months', 1, '{}'::int[], 'scheduled', (select t + 9 from d), 20, 'Toss leftovers, wipe the shelves.', 'active'),
    ('Deep clean the oven', 'Kitchen', null, 'months', 3, '{}'::int[], 'scheduled', (select t + 20 from d), 60, null, 'paused')
  ) as v(name, room, assignee, kind, n, wd, anchor, due, mins, notes, status)
) s
where not exists (select 1 from public.chores c where c.household_id = h.id);
