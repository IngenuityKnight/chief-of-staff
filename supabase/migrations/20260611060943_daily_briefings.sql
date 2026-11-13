-- Step 5: daily_briefings table (BACKEND-BRIEF.md §5)
-- Stores the LLM-generated morning brief so the UI can read it without
-- re-running the LLM on every page load.
create table if not exists daily_briefings (
  date        date primary key,
  content     jsonb not null,
  created_at  timestamptz not null default now()
);
