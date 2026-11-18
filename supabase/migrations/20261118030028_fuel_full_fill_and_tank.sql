-- Two fields the fuel history needs before it can predict anything.
--
-- is_full_fill: MPG is miles-since-last-fill divided by gallons-pumped, which
-- is only true when both ends of that interval finished at the top of the
-- tank. A splash-and-dash pumps less than was burned, so the car reads as more
-- efficient than it is and the gap to the next fill reads short — and nothing
-- warns you, the numbers just drift. An average is where that error hides
-- best, because no single figure looks wrong.
--
-- It cannot be backfilled. A log from three months ago cannot be asked later
-- whether it was a full tank, which is the whole reason this lands now rather
-- than when the prediction gets built: the data collected between now and then
-- is the data the feature will run on.
--
-- Defaults true because filling to the click is what almost every stop is. The
-- flag exists for the exception, so the common path costs no attention at the
-- pump.
--
-- tank_gallons: one number per car, from the manual. It does little for
-- timing, but it is the only way to answer "I typically refill with 11 of 14.5
-- gallons, so I run it to about a quarter" — which is what tells you whether
-- you can stretch to the cheaper station or are cutting it fine.

alter table public.vehicle_logs
  add column if not exists is_full_fill boolean not null default true;

alter table public.vehicles
  add column if not exists tank_gallons numeric;

comment on column public.vehicle_logs.is_full_fill is
  'False only for a deliberate partial fill. MPG and interval maths exclude these.';
