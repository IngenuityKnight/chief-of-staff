-- Seed the inbound email token for the default household so /api/intake/email
-- can resolve house-<token>@in.chiefofstaff.app to a household_id.

update public.households
  set inbound_address_token = 'default'
  where id = '00000000-0000-0000-0000-000000000001'
    and inbound_address_token is null;
