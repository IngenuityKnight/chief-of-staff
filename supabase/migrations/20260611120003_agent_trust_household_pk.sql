-- agent_trust was created with PK (agent, kind). Multi-tenancy requires the
-- composite PK to include household_id so each household can tune trust
-- independently.

alter table public.agent_trust drop constraint if exists agent_trust_pkey;
alter table public.agent_trust add primary key (household_id, agent, kind);
