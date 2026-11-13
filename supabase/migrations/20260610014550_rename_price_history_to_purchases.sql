-- Drop old trigger and function
drop trigger if exists trg_inventory_price_history on public.inventory_items;
drop function if exists public.record_inventory_price_change();

-- Rename table and update the index
alter table public.inventory_price_history rename to inventory_purchases;
alter index inventory_price_history_inventory_item_id_recorded_at_idx
  rename to inventory_purchases_inventory_item_id_recorded_at_idx;

-- Add new columns
alter table public.inventory_purchases
  add column quantity numeric,
  add column notes text;

-- Trigger function: on purchase insert, sync item's price, quantity, and last_restocked_at
create or replace function public.sync_inventory_on_purchase()
returns trigger language plpgsql as $$
begin
  update public.inventory_items
  set
    price_per_unit    = new.price,
    last_restocked_at = new.recorded_at,
    quantity          = quantity + coalesce(new.quantity, 0)
  where id = new.inventory_item_id;
  return new;
end;
$$;

create trigger trg_sync_inventory_on_purchase
  after insert on public.inventory_purchases
  for each row execute function public.sync_inventory_on_purchase();
