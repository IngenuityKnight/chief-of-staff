-- ─── Household Inventory ─────────────────────────────────────────────────────
-- Tracks every consumable and stocked item in the house.
-- quantity <= min_quantity triggers a low-stock alert and auto-shopping-list entry.

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  category              TEXT        NOT NULL DEFAULT 'other',
  -- 'food' | 'hygiene' | 'cleaning' | 'paper' | 'garage' | 'laundry' | 'other'
  quantity              NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit                  TEXT        NOT NULL DEFAULT 'count',
  -- 'count' | 'rolls' | 'lbs' | 'oz' | 'gallons' | 'boxes' | 'bags' | 'bottles' | 'cans'
  min_quantity          NUMERIC(10, 2) NOT NULL DEFAULT 1,
  est_weekly_consumption NUMERIC(10, 2),           -- learned from restock history
  location              TEXT,                       -- 'pantry' | 'bathroom' | 'garage' | 'kitchen' | 'basement'
  price_per_unit        NUMERIC(10, 2),
  preferred_store       TEXT,
  last_restocked_at     TIMESTAMPTZ,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_items_all" ON public.inventory_items FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS inventory_items_category_idx ON public.inventory_items (category);
CREATE INDEX IF NOT EXISTS inventory_items_low_stock_idx ON public.inventory_items (quantity, min_quantity);

-- ─── Vehicles ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vehicles (
  id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  make                     TEXT    NOT NULL,
  model                    TEXT    NOT NULL,
  year                     INTEGER NOT NULL,
  color                    TEXT,
  vin                      TEXT,
  license_plate            TEXT,
  mileage                  INTEGER,
  last_oil_change_miles    INTEGER,
  oil_change_interval_miles INTEGER DEFAULT 5000,
  next_service_type        TEXT,   -- 'oil change' | 'tire rotation' | 'inspection' | 'brakes' | etc
  next_service_miles       INTEGER,
  insurance_expires        DATE,
  registration_expires     DATE,
  avg_mpg                  NUMERIC(5, 1),
  monthly_fuel_cost        NUMERIC(10, 2),
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_all" ON public.vehicles FOR ALL USING (true);

-- ─── Appliances ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appliances (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT    NOT NULL,   -- 'Dishwasher' | 'HVAC' | 'Water Heater' etc
  brand              TEXT,
  model_number       TEXT,
  location           TEXT,               -- 'kitchen' | 'laundry' | 'garage' | 'basement' | 'attic'
  purchase_date      DATE,
  purchase_price     NUMERIC(10, 2),
  warranty_expires   DATE,
  last_serviced      DATE,
  est_lifespan_years INTEGER,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appliances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appliances_all" ON public.appliances FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS appliances_warranty_expires_idx ON public.appliances (warranty_expires);

-- ─── Shopping List ─────────────────────────────────────────────────────────────
-- Items can be created manually, auto-promoted from low-stock inventory, or AI-generated.

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT    NOT NULL,
  quantity            NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit                TEXT    NOT NULL DEFAULT 'count',
  est_cost            NUMERIC(10, 2),
  store_preference    TEXT,
  source              TEXT    NOT NULL DEFAULT 'manual',
  -- 'manual' | 'auto' (low-stock promotion) | 'ai' (Claude-generated)
  inventory_item_id   UUID    REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  priority            TEXT    NOT NULL DEFAULT 'medium',
  -- 'low' | 'medium' | 'high' | 'critical'
  status              TEXT    NOT NULL DEFAULT 'needed',
  -- 'needed' | 'in-cart' | 'purchased' | 'skipped'
  category            TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shopping_list_all" ON public.shopping_list_items FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS shopping_list_status_idx  ON public.shopping_list_items (status);
CREATE INDEX IF NOT EXISTS shopping_list_created_idx ON public.shopping_list_items (created_at DESC);
