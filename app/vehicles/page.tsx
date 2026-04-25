import { Car, AlertTriangle, CheckCircle2, Clock, Fuel, Shield } from "lucide-react";
import { Panel, Stat } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { getVehicles } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import type { Vehicle } from "@/lib/types";

function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function MilesProgress({ vehicle }: { vehicle: Vehicle }) {
  if (!vehicle.mileage || !vehicle.lastOilChangeMiles) return null;
  const interval = vehicle.oilChangeIntervalMiles;
  const milesSince = vehicle.mileage - vehicle.lastOilChangeMiles;
  const pct = Math.min(1, milesSince / interval);
  const isDue = pct >= 0.9;
  const isOverdue = milesSince >= interval;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Oil change</span>
        <span className={`font-mono font-medium ${isOverdue ? "text-signal-red" : isDue ? "text-signal-amber" : "text-slate-400"}`}>
          {milesSince.toLocaleString()} / {interval.toLocaleString()} mi
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full rounded-full transition-all ${isOverdue ? "bg-signal-red" : isDue ? "bg-signal-amber" : "bg-signal-green"}`}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      {isOverdue && (
        <p className="mt-1 text-[11px] font-medium text-signal-red">
          Overdue by {(milesSince - interval).toLocaleString()} miles
        </p>
      )}
    </div>
  );
}

function ExpiryBadge({ label, dateStr }: { label: string; dateStr?: string }) {
  const days = daysUntil(dateStr);
  if (days === null) return null;

  const color = days < 0
    ? "border-signal-red/30 bg-signal-red/10 text-signal-red"
    : days <= 30
      ? "border-signal-amber/30 bg-signal-amber/10 text-signal-amber"
      : days <= 90
        ? "border-signal-blue/20 bg-signal-blue/10 text-signal-blue"
        : "border-edge bg-ink-900/40 text-slate-400";

  const display = days < 0
    ? `${-days}d ago`
    : days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : `${days}d`;

  return (
    <div className={`rounded-md border px-2.5 py-1.5 text-center text-[11px] ${color}`}>
      <div className="font-semibold uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 font-mono font-bold">{display}</div>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const insuranceDays = daysUntil(vehicle.insuranceExpires);
  const registrationDays = daysUntil(vehicle.registrationExpires);
  const hasAlert =
    (vehicle.mileage && vehicle.lastOilChangeMiles &&
      vehicle.mileage - vehicle.lastOilChangeMiles >= vehicle.oilChangeIntervalMiles * 0.9) ||
    (insuranceDays !== null && insuranceDays <= 30) ||
    (registrationDays !== null && registrationDays <= 30);

  return (
    <div className={`rounded-xl border ${hasAlert ? "border-signal-amber/30 bg-signal-amber/5" : "border-edge bg-ink-900/30"} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-signal-blue/20">
          <Car className="h-6 w-6 text-signal-blue" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-white">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            {vehicle.color && (
              <span className="pill-ghost">{vehicle.color}</span>
            )}
            {hasAlert && (
              <span className="flex items-center gap-1 rounded-md bg-signal-amber/20 px-2 py-0.5 text-[11px] font-semibold text-signal-amber">
                <AlertTriangle className="h-3 w-3" />
                Action needed
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
            {vehicle.licensePlate && <span>{vehicle.licensePlate}</span>}
            {vehicle.mileage && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {vehicle.mileage.toLocaleString()} mi
              </span>
            )}
            {vehicle.avgMpg && (
              <span className="flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                {vehicle.avgMpg} mpg
              </span>
            )}
            {vehicle.monthlyFuelCost && (
              <span className="flex items-center gap-1">
                <Fuel className="h-3 w-3" />
                {formatMoney(vehicle.monthlyFuelCost)}/mo fuel
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Oil change progress */}
      <MilesProgress vehicle={vehicle} />

      {/* Next service */}
      {vehicle.nextServiceType && (
        <div className="rounded-lg border border-edge bg-ink-900/40 px-3 py-2.5">
          <div className="text-[11px] text-slate-500">Upcoming service</div>
          <div className="mt-0.5 text-sm font-medium text-slate-200">{vehicle.nextServiceType}</div>
          {vehicle.nextServiceMiles && (
            <div className="mt-0.5 text-[11px] text-slate-400">
              At {vehicle.nextServiceMiles.toLocaleString()} mi
              {vehicle.mileage && (
                <span className="text-slate-500">
                  {" "}— {Math.max(0, vehicle.nextServiceMiles - vehicle.mileage).toLocaleString()} mi away
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expiry badges */}
      {(vehicle.insuranceExpires || vehicle.registrationExpires) && (
        <div className="flex gap-3">
          <ExpiryBadge label="Insurance" dateStr={vehicle.insuranceExpires} />
          <ExpiryBadge label="Registration" dateStr={vehicle.registrationExpires} />
        </div>
      )}

      {vehicle.notes && (
        <p className="text-xs text-slate-500">{vehicle.notes}</p>
      )}
    </div>
  );
}

export default async function VehiclesPage() {
  const [vehicles, fields] = await Promise.all([
    getVehicles(),
    Promise.resolve(getAdminFields("vehicles")),
  ]);

  const alerts = vehicles.filter((v) => {
    const ins = daysUntil(v.insuranceExpires);
    const reg = daysUntil(v.registrationExpires);
    const oilOverdue = v.mileage && v.lastOilChangeMiles &&
      v.mileage - v.lastOilChangeMiles >= v.oilChangeIntervalMiles;
    return oilOverdue || (ins !== null && ins <= 30) || (reg !== null && reg <= 30);
  }).length;

  const totalFuelCost = vehicles.reduce((sum, v) => sum + (v.monthlyFuelCost ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={vehicles.length} label="Vehicles" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={alerts} label="Need Attention" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={formatMoney(totalFuelCost)} label="Monthly Fuel" tone="purple" /></div></Panel>
        <Panel className="!px-0 !py-0">
          <div className="px-5 py-4">
            <Stat
              value={vehicles.every((v) => !v.insuranceExpires || daysUntil(v.insuranceExpires)! > 30) ? "OK" : "Review"}
              label="Insurance"
              tone={vehicles.some((v) => v.insuranceExpires && daysUntil(v.insuranceExpires)! <= 30) ? "red" : "green"}
            />
          </div>
        </Panel>
      </div>

      {/* Vehicle cards */}
      <Panel
        eyebrow="Fleet"
        title="Your Vehicles"
        action={
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Shield className="h-3.5 w-3.5 text-signal-green" />
            {vehicles.length - alerts} nominal
          </div>
        }
      >
        {vehicles.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No vehicles added yet. Add your first vehicle below.
          </div>
        ) : (
          <div className="space-y-4">
            {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
          </div>
        )}
        <InlineForm
          resource="vehicles"
          fields={fields}
          defaults={{ oilChangeIntervalMiles: "5000" }}
          label="Add vehicle"
        />
      </Panel>
    </div>
  );
}
