-- Atomic increment for rules.times_consulted.
-- Called from createProposalsFromIntake each time the chief cites a rule.
create or replace function increment_rule_consulted(rule_id text, consulted_at timestamptz)
returns void language sql security definer as $$
  update rules
  set times_consulted   = times_consulted + 1,
      last_consulted_at = consulted_at
  where id = rule_id;
$$;
