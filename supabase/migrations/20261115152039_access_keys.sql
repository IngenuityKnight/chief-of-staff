-- Physical keys: an NFC chip you tap to sign in, instead of waiting on an
-- email.
--
-- Modelled as API keys rather than as a signature over a shared secret, for
-- one reason: revocation. A token derived from TAP_SECRET could only be
-- withdrawn by rotating that secret, which would simultaneously kill every
-- sticker in the house. A row can be revoked on its own, and carries the two
-- facts you want when deciding whether to: what this chip is, and when it was
-- last used.
--
-- It must also not share TAP_SECRET. A sticker tag is low value — worst case
-- someone logs a fill-up. A key is the whole account. TAP_SECRET is
-- deliberately non-sensitive in Vercel so `npm run tap:urls` can read it, and
-- a credential that grants sign-in has no business behind that.
--
-- Only the SHA-256 of the token is stored. The raw token exists in the URL
-- written onto the chip and nowhere else: a copy of this table is not enough
-- to sign in as anyone.

create table if not exists public.access_keys (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  -- The member this chip signs in as. Dropping the user drops their keys.
  user_id       uuid not null references auth.users (id) on delete cascade,
  label         text not null,
  -- Hex SHA-256 of the raw token. Unique so a lookup is a single index hit
  -- and two chips can never collide.
  token_sha256  text not null unique,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

-- The sign-in path looks a chip up by hash on every tap and nothing else.
create index if not exists access_keys_household_idx
  on public.access_keys (household_id, created_at desc);

alter table public.access_keys enable row level security;

-- Same shape as every other household table. The sign-in route itself runs as
-- the service role, which bypasses this; the policy is what stops the
-- publishable key reaching the table, and an unqualified `using (true)` here
-- would hand out the household's key list.
drop policy if exists access_keys_membership on public.access_keys;
create policy access_keys_membership on public.access_keys
  for all
  using (public.is_member_of(household_id))
  with check (public.is_member_of(household_id));
