ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS units_per_package NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS package_price     NUMERIC(10, 2);
