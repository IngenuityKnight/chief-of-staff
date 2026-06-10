import { Car, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatMoney, daysUntil, relativeDay } from "@/lib/utils";
import { getVehicles } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { EditInline } from "@/components/edit-inline";
import { VehicleMaintenanceLookup } from "@/components/vehicle-maintenance-lookup";
import type { AdminField } from "@/lib/server/admin";
import type { Vehicle } from "@/lib/types";

function OilBar({ vehicle }: { vehicle: Vehicle }) {
  if (!vehicle.mileage || !vehicle.lastOilChangeMiles) return null;
  const since    = (vehicle.mileage as number) - (vehicle.lastOilChangeMiles as number);
  const interval = vehicle.oilChangeIntervalMiles;
  const pct      = Math.min(1, since / interval);
  const over     = since >= interval;
  const due      = pct >= 0.9;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-slate-500">Oil change</span>
        <span className={`font-mono ${over ? "text-signal-red" : due ? "text-signal-amber" : "text-slate-400"}`}>
          {since.toLocaleString()} / {interval.toLocaleString()} mi
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className={`h-full rounded-full ${over ? "bg-signal-red" : due ? "bg-signal-amber" : "bg-signal-green"}`}
          style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      {over && <p className="mt-1 text-[11px] text-signal-red">Overdue by {(since - interval).toLocaleString()} miles</p>}
    </div>
  );
}

function ExpiryRow({ label, dateStr }: { label: string; dateStr?: string }) {
  const d = dateStr ? daysUntil(dateStr) : null;
  if (d === null) return null;
  const color = d < 0 ? "text-signal-red" : d <= 30 ? "text-signal-amber" : d <= 90 ? "text-signal-blue" : "text-slate-400";
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${color}`}>
        {d < 0 ? `Expired ${-d}d ago` : d === 0 ? "Today" : relativeDay(dateStr!)}
      </span>
    </div>
  );
}

function VehicleCard({ vehicle, fields }: { vehicle: Vehicle; fields: AdminField[] }) {
  const d    = vehicle.insuranceExpires ? daysUntil(vehicle.insuranceExpires) : null;
  const hasAlert =
    (vehicle.mileage && vehicle.lastOilChangeMiles && vehicle.mileage - vehicle.lastOilChangeMiles >= vehicle.oilChangeIntervalMiles) ||
    (d !== null && d <= 30);

  return (
    <div className={`rounded-xl border ${hasAlert ? "border-signal-amber/30" : "border-edge"} bg-ink-900/30 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${hasAlert ? "bg-signal-amber/10 text-signal-amber" : "bg-ink-800 text-slate-400"}`}>
            {hasAlert ? <AlertTriangle className="h-5 w-5" /> : <Car className="h-5 w-5" />}
          </div>
          <div>
            <div className="font-display text-base font-semibold text-white">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </div>
            <div className="text-[11px] text-slate-500">
              {vehicle.color && `${vehicle.color} · `}
              {vehicle.licensePlate && vehicle.licensePlate}
              {vehicle.mileage && ` · ${vehicle.mileage.toLocaleString()} mi`}
            </div>
          </div>
        </div>
        <EditInline resource="vehicles" id={vehicle.id} fields={fields}
          values={{
            make: vehicle.make, model: vehicle.model, year: vehicle.year,
            color: vehicle.color ?? "", licensePlate: vehicle.licensePlate ?? "",
            mileage: vehicle.mileage ?? "", lastOilChangeMiles: vehicle.lastOilChangeMiles ?? "",
            oilChangeIntervalMiles: vehicle.oilChangeIntervalMiles,
            insuranceExpires: vehicle.insuranceExpires ?? "",
            registrationExpires: vehicle.registrationExpires ?? "",
            avgMpg: vehicle.avgMpg ?? "", monthlyFuelCost: vehicle.monthlyFuelCost ?? "",
            notes: vehicle.notes ?? "",
          }}
          label={`Edit ${vehicle.make} ${vehicle.model}`} />
      </div>

      <div className="mt-4 space-y-3">
        <OilBar vehicle={vehicle} />
        <div className="space-y-1.5">
          <ExpiryRow label="Insurance" dateStr={vehicle.insuranceExpires} />
          <ExpiryRow label="Registration" dateStr={vehicle.registrationExpires} />
          {vehicle.nextServiceType && vehicle.nextServiceMiles && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">{vehicle.nextServiceType}</span>
              <span className="font-mono text-slate-400">at {vehicle.nextServiceMiles.toLocaleString()} mi</span>
            </div>
          )}
        </div>
        {vehicle.monthlyFuelCost && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Monthly fuel</span>
            <span className="font-mono text-slate-400">{formatMoney(vehicle.monthlyFuelCost)}</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        <VehicleMaintenanceLookup make={vehicle.make} model={vehicle.model} year={vehicle.year} mileage={vehicle.mileage} />
      </div>
    </div>
  );
}

export default async function VehiclesPage() {
  const [vehicles, fields] = await Promise.all([
    getVehicles(),
    Promise.resolve(getAdminFields("vehicles")),
  ]);

  const alerts = vehicles.filter((v) => {
    const d = v.insuranceExpires ? daysUntil(v.insuranceExpires) : null;
    const oilOver = v.mileage && v.lastOilChangeMiles && v.mileage - v.lastOilChangeMiles >= v.oilChangeIntervalMiles;
    return oilOver || (d !== null && d <= 30);
  });

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Vehicles</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""}
            {alerts.length > 0 && (
              <span className="ml-2 font-semibold text-signal-amber">{alerts.length} need attention</span>
            )}
            {alerts.length === 0 && vehicles.length > 0 && (
              <span className="ml-2 font-semibold text-signal-green">all up to date</span>
            )}
          </p>
        </div>
        {alerts.length === 0 && vehicles.length > 0 && (
          <CheckCircle2 className="h-5 w-5 text-signal-green/60" />
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-edge bg-ink-900/20 px-5 py-12 text-center">
          <Car className="mx-auto h-6 w-6 text-slate-600" />
          <div className="mt-2 text-sm text-slate-500">No vehicles added yet.</div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} fields={fields} />)}
        </div>
      )}

      <InlineForm resource="vehicles" fields={fields} label="Add vehicle" />
    </div>
  );
}
