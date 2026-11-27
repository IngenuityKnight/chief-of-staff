-- What the app did when nobody was watching.
--
-- The monthly backup, the completion log and the NFC taps all run without
-- anyone looking at a screen, and all of them were written to fail quietly:
-- record() swallows its errors so a log write can never block a tick, and
-- the backup only ever reported to the cron caller. That is the right call
-- for the moment of failure and the wrong one for the week after, because a
-- silent failure is indistinguishable from things being fine.
--
-- So each of those writes one row here: whether it worked and, if not, why.
-- The House page reads it back as a status card. Written only by the service
-- role; members can read their own household's rows.

create table if not exists public.system_events (
  household_id  uuid        not null references public.households (id) on delete cascade,
  id            uuid        primary key default gen_random_uuid(),
  kind          text        not null,  -- 'backup' | 'completion-write' | 'tap'
  ok            boolean     not null,
  detail        text,
  created_at    timestamptz not null default now()
);

create index if not exists system_events_household_kind_at_idx
  on public.system_events (household_id, kind, created_at desc);

alter table public.system_events enable row level security;

drop policy if exists system_events_read on public.system_events;
create policy system_events_read on public.system_events
  for select
  using (public.is_member_of(household_id));
