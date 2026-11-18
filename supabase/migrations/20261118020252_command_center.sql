-- Personal command centre: goals, the day's three, the weekly review, what is
-- being read, and the daily note.
--
-- Household tables answer "what does this house need". These answer "what am
-- I doing with my time", which is a different question with a different owner,
-- so they carry user_id as well as household_id. RLS still scopes by
-- household — this is a two-adult house, not a tenancy boundary — but the
-- user_id is what lets the dashboard show one person's three things rather
-- than six.

create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  why          text,
  target_date  date,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create table if not exists public.milestones (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references public.goals (id) on delete cascade,
  title      text not null,
  due_date   date,
  done_at    timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- The day's three. A row per pick rather than three columns on a day: the
-- rank changes, picks get dropped, and a row carries its own completion.
create table if not exists public.priorities (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  on_date      date not null,
  rank         int  not null check (rank between 1 and 3),
  title        text not null,
  goal_id      uuid references public.goals (id) on delete set null,
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, on_date, rank)
);

create table if not exists public.week_reviews (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  week_start   date not null,
  went_well    text,
  did_not      text,
  focus_next   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.readings (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  author       text,
  kind         text not null default 'book',
  status       text not null default 'reading',
  progress     int  not null default 0 check (progress between 0 and 100),
  rating       int  check (rating between 1 and 5),
  notes        text,
  started_on   date,
  finished_on  date,
  created_at   timestamptz not null default now()
);

-- One entry per day. Upserted rather than appended: a journal you can only
-- add to is a journal you stop keeping the first time you want to fix a typo.
create table if not exists public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  on_date      date not null,
  body         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, on_date)
);

create index if not exists goals_user_idx        on public.goals (user_id, status, created_at desc);
create index if not exists milestones_goal_idx   on public.milestones (goal_id, sort_order);
create index if not exists priorities_day_idx    on public.priorities (user_id, on_date, rank);
create index if not exists week_reviews_idx      on public.week_reviews (user_id, week_start desc);
create index if not exists readings_user_idx     on public.readings (user_id, status, created_at desc);
create index if not exists journal_day_idx       on public.journal_entries (user_id, on_date desc);

alter table public.goals            enable row level security;
alter table public.milestones       enable row level security;
alter table public.priorities       enable row level security;
alter table public.week_reviews     enable row level security;
alter table public.readings         enable row level security;
alter table public.journal_entries  enable row level security;

drop policy if exists goals_membership on public.goals;
create policy goals_membership on public.goals for all
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

-- Milestones have no household_id of their own; they inherit their goal's.
drop policy if exists milestones_membership on public.milestones;
create policy milestones_membership on public.milestones for all
  using (exists (select 1 from public.goals g where g.id = goal_id and public.is_member_of(g.household_id)))
  with check (exists (select 1 from public.goals g where g.id = goal_id and public.is_member_of(g.household_id)));

drop policy if exists priorities_membership on public.priorities;
create policy priorities_membership on public.priorities for all
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

drop policy if exists week_reviews_membership on public.week_reviews;
create policy week_reviews_membership on public.week_reviews for all
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

drop policy if exists readings_membership on public.readings;
create policy readings_membership on public.readings for all
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));

drop policy if exists journal_membership on public.journal_entries;
create policy journal_membership on public.journal_entries for all
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));
