-- Let a tap record what, not only that.
--
-- tap_events has been slug + label + timestamp, which can answer "how often"
-- and nothing else. Two things need more than that:
--
--   * A toggle tag has a state. The dishwasher is clean or it is dirty, and
--     the answer to "did someone already run it" is the most recent value
--     rather than the fact that a tap happened.
--   * A reading tag will want a number — a meter, a weight, a count.
--
-- One nullable text column covers both and keeps the table append-only, which
-- is the property that makes it able to answer historical questions at all.
-- Current state is the latest row; the history is every row before it. Nothing
-- is ever updated in place, so no tap overwrites an earlier one.
--
-- Consumers ship with this migration rather than after it: the dishwasher
-- state on the home page, and the /records view that answers "when did we last
-- flush the water heater" from the same column.

alter table public.tap_events add column if not exists value text;

-- Both consumers read the newest row for one slug in one household, and
-- /records walks that list backwards to measure intervals.
create index if not exists tap_events_household_slug_created_idx
  on public.tap_events (household_id, slug, created_at desc);
