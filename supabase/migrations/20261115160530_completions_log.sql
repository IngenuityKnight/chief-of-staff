-- Every completion, kept.
--
-- The state tables answer "what is true now" and overwrite themselves doing
-- it: marking an upkeep job done replaces last_done and reschedules, so the
-- previous completion is gone the moment the next one happens. That is fine
-- for a screen and fatal for a question like "how often do we really change
-- the filter" or "did the bins go out this week" — which is the question a
-- weekly chore is entirely made of.
--
-- So: state tables stay exactly as they are, and every completion also writes
-- one row here that is never updated or deleted. Same shape as tap_events and
-- vehicle_logs, which are the only two things in this app that could already
-- answer a question about the past.
--
-- label is denormalised on purpose. A completion has to outlive the thing it
-- completed: delete an upkeep job and "we flushed the water heater in March"
-- should still be true and still be readable.
--
-- subject_id is text rather than uuid because the subjects disagree —
-- maintenance_items.id is text like 'mnt_05' while tasks are uuids — and
-- there is deliberately no foreign key, for the same reason as the label.
--
-- This is not a second tap log. tap_events records that a chip was tapped,
-- which is true even when the tap completes nothing; this records that a job
-- was done, whoever did it and from wherever. A tap that completes an upkeep
-- job writes one of each, because those are two different facts.

create table if not exists public.completions (
  household_id  uuid        not null references public.households (id) on delete cascade,
  id            uuid        primary key default gen_random_uuid(),
  subject_kind  text        not null,  -- 'upkeep' | 'task' | 'chore'
  subject_id    text        not null,
  label         text        not null,
  completed_at  timestamptz not null default now(),
  actor         text,                  -- who, when we know; null is honest
  source        text        not null default 'phone',  -- 'phone' | 'wall' | 'nfc'
  value         text
);

-- "What has been done lately" and "every time this one thing was done".
create index if not exists completions_household_at_idx
  on public.completions (household_id, completed_at desc);
create index if not exists completions_subject_idx
  on public.completions (household_id, subject_kind, subject_id, completed_at desc);

alter table public.completions enable row level security;

drop policy if exists completions_membership on public.completions;
create policy completions_membership on public.completions
  for all
  using (public.is_member_of(household_id))
  with check (public.is_member_of(household_id));
