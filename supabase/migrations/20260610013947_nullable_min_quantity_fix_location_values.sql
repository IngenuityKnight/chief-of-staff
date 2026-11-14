alter table public.inventory_items alter column min_quantity drop not null;
alter table public.inventory_items alter column min_quantity drop default;

update public.inventory_items set location = 'refrigerator' where location = 'kitchen';
