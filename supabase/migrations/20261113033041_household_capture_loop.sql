-- Personal evidence ledger. Writes only through the authenticated server loop.
create table public.household_captures (
  id uuid primary key,
  household_id uuid not null references public.households(id),
  user_id uuid not null references auth.users(id),
  source text not null check (source in ('paste', 'email')),
  source_key text not null check (length(source_key) between 1 and 200),
  source_text text not null check (length(source_text) between 1 and 24000),
  received_at timestamptz not null default now(),
  processing text not null default 'pending' check (processing in ('pending', 'ready', 'needs_review')),
  processing_note text,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  revision integer not null default 0 check (revision >= 0),
  unique (household_id, user_id, source_key)
);
create index household_captures_owner_id_idx
  on public.household_captures (user_id, household_id, id);
alter table public.household_captures enable row level security;
revoke all on public.household_captures from anon, authenticated;
grant select on public.household_captures to authenticated;
grant select, insert, update on public.household_captures to service_role;
revoke delete on public.household_captures from service_role;
create policy captures_personal_read on public.household_captures
  for select to authenticated using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.household_memberships m
      where m.household_id = household_captures.household_id
        and m.user_id = (select auth.uid()) and m.role = 'owner'
    )
  );
