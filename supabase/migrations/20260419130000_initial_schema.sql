create table if not exists public.inbox_items (
  id text primary key,
  title text not null,
  raw_input text not null,
  analysis text not null,
  primary_agent text not null,
  secondary_agents jsonb not null default '[]'::jsonb,
  category text not null,
  needs_action boolean not null default true,
  proposed_tasks jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  source text not null default 'web',
  created_at timestamptz not null default timezone('utc', now()),
  urgency text not null default 'medium'
);

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  agent text not null,
  category text not null,
  status text not null default 'todo',
  due_date timestamptz,
  priority text not null default 'medium',
  inbox_item_id text references public.inbox_items(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.maintenance_items (
  id text primary key,
  item text not null,
  system text not null,
  frequency text not null,
  last_done timestamptz not null,
  next_due timestamptz not null,
  status text not null default 'ok',
  vendor text,
  last_cost numeric(12, 2),
  notes text
);

create table if not exists public.bills (
  id text primary key,
  name text not null,
  kind text not null,
  amount numeric(12, 2) not null,
  due_date timestamptz,
  frequency text not null,
  category text not null,
  status text not null default 'due',
  autopay boolean not null default false,
  last_paid timestamptz
);

create table if not exists public.calendar_events (
  id text primary key,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  type text not null,
  location text,
  notes text,
  agent text
);

create table if not exists public.household_members (
  id text primary key,
  name text not null,
  role text not null,
  notes text,
  avatar_color text not null default 'blue'
);

create table if not exists public.rules (
  id text primary key,
  category text not null,
  title text not null,
  description text not null,
  priority text not null,
  active boolean not null default true
);

create table if not exists public.meal_plan_days (
  date date primary key,
  label text not null,
  theme text,
  breakfast jsonb,
  lunch jsonb,
  dinner jsonb
);

create index if not exists inbox_items_created_at_idx on public.inbox_items (created_at desc);
create index if not exists inbox_items_primary_agent_idx on public.inbox_items (primary_agent);
create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists tasks_agent_idx on public.tasks (agent);
create index if not exists maintenance_items_next_due_idx on public.maintenance_items (next_due);
create index if not exists bills_due_date_idx on public.bills (due_date);
create index if not exists calendar_events_start_at_idx on public.calendar_events (start_at);

alter table public.inbox_items enable row level security;
alter table public.tasks enable row level security;
alter table public.maintenance_items enable row level security;
alter table public.bills enable row level security;
alter table public.calendar_events enable row level security;
alter table public.household_members enable row level security;
alter table public.rules enable row level security;
alter table public.meal_plan_days enable row level security;
