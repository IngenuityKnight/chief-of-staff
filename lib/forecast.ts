// Twelve-month maintenance cost forecast. Pure: no I/O, so it is easy to test.
//
// A car service recurs by miles and/or months, whichever comes first. Miles are
// projected from the odometer at a steady yearly rate. Services with no recorded
// history are assumed to have been done on schedule at the last mileage milestone.

import { addDays, addMonths, nextDue } from "./schedule.ts";
import type { UpkeepItem, Vehicle, VehicleService } from "./types.ts";

export interface ForecastLine {
  id: string;
  label: string;
  group: "car" | "home";
  date: string; // YYYY-MM-DD
  cost: number;
  noHistory?: boolean; // car service with no recorded last-done
}

export interface Forecast {
  lines: ForecastLine[];
  total: number;
  byMonth: { month: string; total: number }[]; // 12 entries starting this month
  byGroup: { car: number; home: number };
}

const DAY_MS = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS);
const ym = (d: string) => d.slice(0, 7);

/** Dates one service falls due within [today, today + 365 days]. */
export function serviceDates(
  s: VehicleService,
  odometer: number,
  annualMiles: number,
  today: string,
): { date: string; noHistory: boolean }[] {
  const perDay = Math.max(annualMiles, 1) / 365;
  const end = addDays(today, 365);
  const milesAt = (date: string) => odometer + perDay * Math.max(days(today, date), 0);
  const dateAtMiles = (miles: number) => (miles <= odometer ? today : addDays(today, Math.ceil((miles - odometer) / perDay)));

  const nextFrom = (miles: number | undefined, date: string | undefined): string | undefined => {
    const options: string[] = [];
    if (s.intervalMiles && miles != null) options.push(dateAtMiles(miles + s.intervalMiles));
    if (s.intervalMonths && date) options.push(addMonths(date, s.intervalMonths));
    return options.sort()[0];
  };

  const out: { date: string; noHistory: boolean }[] = [];
  let first = nextFrom(s.lastDoneMiles, s.lastDoneDate);
  let noHistory = false;
  if (!first) {
    noHistory = true;
    // Never recorded: assume it was done on schedule at the last mileage
    // milestone, so a 60k item is not shown as due at 50k. Month-only items
    // have nothing to anchor on and are treated as due now.
    first = s.intervalMiles
      ? dateAtMiles((Math.floor(odometer / s.intervalMiles) + 1) * s.intervalMiles)
      : today;
  }
  if (first < today) first = today; // overdue: do it now
  for (let i = 0, d = first; d <= end && i < 60; i++) {
    out.push({ date: d, noHistory: i === 0 && noHistory });
    const following = nextFrom(milesAt(d), d);
    if (!following || following <= d) break;
    d = following;
  }
  return out;
}

/** Dates a home upkeep job falls due within the year, stepping by its frequency. */
export function upkeepDates(u: UpkeepItem, today: string): string[] {
  const end = addDays(today, 365);
  const out: string[] = [];
  let d = u.nextDue < today ? today : u.nextDue;
  for (let i = 0; d <= end && i < 60; i++) {
    out.push(d);
    const n = nextDue(u.frequency, d);
    if (!n) break;
    d = n;
  }
  return out;
}

export function buildForecast(input: {
  today: string;
  annualMiles: number;
  vehicles: Vehicle[];
  services: VehicleService[];
  upkeep: UpkeepItem[];
}): Forecast {
  const { today, annualMiles, vehicles, services, upkeep } = input;
  const lines: ForecastLine[] = [];
  const byVehicle = new Map(vehicles.map((v) => [v.id, v]));

  for (const s of services) {
    const v = byVehicle.get(s.vehicleId);
    if (!v) continue;
    const odo = v.mileage ?? s.lastDoneMiles ?? 0;
    for (const { date, noHistory } of serviceDates(s, odo, annualMiles, today)) {
      lines.push({ id: `${s.id}:${date}`, label: `${s.item} — ${v.year} ${v.model}`, group: "car", date, cost: s.estCost, noHistory });
    }
  }
  for (const u of upkeep) {
    if (!u.estCost) continue;
    for (const date of upkeepDates(u, today)) {
      lines.push({ id: `${u.id}:${date}`, label: u.item, group: "home", date, cost: u.estCost });
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  const months: { month: string; total: number }[] = [];
  for (let i = 0; i < 12; i++) months.push({ month: ym(addMonths(`${ym(today)}-01`, i)), total: 0 });
  const byGroup = { car: 0, home: 0 };
  for (const l of lines) {
    byGroup[l.group] += l.cost;
    const m = months.find((x) => x.month === ym(l.date));
    if (m) m.total += l.cost;
    else months[months.length - 1].total += l.cost; // the 13th-month tail lands in the last bucket
  }
  const total = byGroup.car + byGroup.home;
  return { lines, total, byMonth: months, byGroup };
}
