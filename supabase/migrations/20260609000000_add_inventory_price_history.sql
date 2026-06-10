create table public.inventory_price_history (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  price numeric not null,
  store text,
  recorded_at timestamptz not null default now()
);

alter table public.inventory_price_history enable row level security;

create policy "Allow all" on public.inventory_price_history for all using (true);

create index on public.inventory_price_history (inventory_item_id, recorded_at desc);

-- Trigger function: insert a history row whenever price_per_unit changes
create or replace function public.record_inventory_price_change()
returns trigger language plpgsql as $$
begin
  if (new.price_per_unit is distinct from old.price_per_unit) and new.price_per_unit is not null then
    insert into public.inventory_price_history (inventory_item_id, price, store, recorded_at)
    values (new.id, new.price_per_unit, new.preferred_store, now());
  end if;
  return new;
end;
$$;

create trigger trg_inventory_price_history
  after update on public.inventory_items
  for each row execute function public.record_inventory_price_change();

-- Backfill current prices so history isn't empty for existing items
insert into public.inventory_price_history (inventory_item_id, price, store, recorded_at)
select id, price_per_unit, preferred_store, created_at
from public.inventory_items
where price_per_unit is not null;
