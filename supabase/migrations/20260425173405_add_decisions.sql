create table if not exists public.decisions (
  id text primary key,
  title text not null,
  context text,
  status text not null default 'open',
  priority text not null default 'medium',
  category text not null default 'Admin',
  recommendation text,
  options jsonb not null default '[]'::jsonb,
  cost_estimate numeric(12, 2),
  time_estimate_minutes integer,
  due_date timestamptz,
  source_inbox_item_id text references public.inbox_items(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index if not exists decisions_status_idx on public.decisions (status);
create index if not exists decisions_due_date_idx on public.decisions (due_date);
create index if not exists decisions_created_at_idx on public.decisions (created_at desc);

alter table public.decisions enable row level security;
