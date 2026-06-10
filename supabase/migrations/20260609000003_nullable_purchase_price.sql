-- Allow logging a purchase without knowing the price
alter table public.inventory_purchases
  alter column price drop not null;

-- Update trigger: only overwrite price_per_unit when price is supplied
create or replace function public.sync_inventory_on_purchase()
returns trigger language plpgsql as $$
begin
  update public.inventory_items
  set
    price_per_unit    = coalesce(new.price, price_per_unit),
    last_restocked_at = new.recorded_at,
    quantity          = quantity + coalesce(new.quantity, 0)
  where id = new.inventory_item_id;
  return new;
end;
$$;
