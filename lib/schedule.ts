// Pure date and scheduling rules for the wall. No server or framework imports
// so everything here is unit-tested with `node --test`.

import type { Frequency, RoutineItem, Vehicle } from "./types";

export const FREQUENCIES: Frequency[] = ["one-time", "weekly", "monthly", "quarterly", "semi-annual", "annual", "seasonal"];

export function isYmd(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Add calendar months, clamping to the last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

/** The next due date after `from` for a recurring item; null for one-time. */
export function nextDue(frequency: Frequency, from: string): string | null {
  switch (frequency) {
    case "one-time": return null;
    case "weekly": return addDays(from, 7);
    case "monthly": return addMonths(from, 1);
    case "quarterly":
    case "seasonal": return addMonths(from, 3);
    case "semi-annual": return addMonths(from, 6);
    case "annual": return addMonths(from, 12);
  }
}

/**
 * Paying a recurring bill moves it to its next cycle, stepping from the old
 * due date so a bill due the 1st stays on the 1st.
 */
export function nextBillDue(frequency: Frequency, currentDue: string | undefined, today: string): string | null {
  if (frequency === "one-time") return null;
  // Always move at least one cycle (a bill paid early is still paid), then
  // keep going if a stale date is still in the past.
  let due = nextDue(frequency, currentDue ?? today)!;
  for (let i = 0; i < 600 && due <= today; i++) due = nextDue(frequency, due)!;
  return due;
}

export type DueTone = "overdue" | "today" | "soon" | "later";

export function dueTone(due: string, today: string, soonDays = 7): DueTone {
  if (due < today) return "overdue";
  if (due === today) return "today";
  return due <= addDays(today, soonDays) ? "soon" : "later";
}

export function dueLabel(due: string, today: string): string {
  if (due === today) return "Today";
  if (due === addDays(today, 1)) return "Tomorrow";
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "numeric", day: "numeric" })
    .format(new Date(`${due}T12:00:00Z`));
  return due < today ? `Overdue · ${short}` : short;
}

export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Today's routine in time order. */
export function routineFor(items: RoutineItem[], weekday: number): RoutineItem[] {
  return items.filter((i) => i.days.includes(weekday)).sort((a, b) => a.time.localeCompare(b.time));
}

/** Index of the first routine item at or after `now` ("HH:MM"); -1 when the day is done. */
export function nextRoutineIndex(items: RoutineItem[], now: string): number {
  return items.findIndex((i) => i.time >= now);
}

export interface VehicleAlert {
  id: string;
  label: string;
  detail: string;
}

/** Reminders derived from vehicle facts, so nobody has to schedule them. */
export function vehicleAlerts(vehicles: Vehicle[], today: string): VehicleAlert[] {
  const out: VehicleAlert[] = [];
  for (const v of vehicles) {
    const name = `${v.year} ${v.make} ${v.model}`;
    if (v.mileage != null && v.lastOilChangeMiles != null) {
      const since = v.mileage - v.lastOilChangeMiles;
      if (since >= v.oilChangeIntervalMiles - 500) {
        out.push({ id: `oil:${v.id}`, label: `Oil change — ${name}`, detail: `${since.toLocaleString("en-US")} mi since last` });
      }
    }
    if (v.registrationExpires && v.registrationExpires <= addDays(today, 45)) {
      out.push({
        id: `reg:${v.id}`,
        label: `Registration — ${name}`,
        detail: v.registrationExpires < today ? "Expired" : `Expires ${dueLabel(v.registrationExpires, today)}`,
      });
    }
  }
  return out;
}

// WMO weather interpretation codes (Open-Meteo).
export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "—";
}
