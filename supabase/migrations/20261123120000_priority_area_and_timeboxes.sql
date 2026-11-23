-- Time boxing and the morning brief.
--
-- priorities.area says what part of life a priority belongs to. Only Home and
-- Self priorities get boxed: boxes live outside working hours, and work has
-- its own calendar. Nullable, because every existing row predates the idea.
--
-- timeboxes holds a day's accepted plan and how each box went. Times are
-- "HH:MM" text in the household's timezone, the same convention routine_items
-- uses, because a box is a slot in a local day, not an instant.

alter table public.priorities
  add column if not exists area text check (area in ('home', 'work', 'self'));

create table if not exists public.timeboxes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  on_date      date not null,
  start_time   text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time     text not null check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  title        text not null,
  priority_id  uuid references public.priorities (id) on delete set null,
  status       text not null default 'planned'
               check (status in ('planned', 'done', 'partial', 'slipped')),
  created_at   timestamptz not null default now()
);

create index if not exists timeboxes_user_day_idx
  on public.timeboxes (user_id, on_date);

alter table public.timeboxes enable row level security;

drop policy if exists timeboxes_membership on public.timeboxes;
create policy timeboxes_membership on public.timeboxes for all
  using (public.is_member_of(household_id)) with check (public.is_member_of(household_id));
