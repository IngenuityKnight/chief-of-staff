-- preferred_store is replaced by last purchase store (inventory_purchases.store)
alter table public.inventory_items drop column if exists preferred_store;
