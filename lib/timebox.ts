// Time boxing: fitting the day's personal priorities into the time that is
// actually free.
//
// Pure functions, no I/O, so the planner can be tested without a calendar or
// a database. Times are "HH:MM" strings in the household's timezone and are
// converted to minutes-since-midnight for the arithmetic.
//
// Deliberately simple. It places boxes in order, earliest gap first, and does
// not try to be clever about energy or context switching. A plan you can read
// at a glance and adjust beats an optimal one you have to trust.

export type Area = "home" | "work" | "self";

export const AREAS: { value: Area; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "work", label: "Work" },
  { value: "self", label: "Self" },
];

export interface Span {
  start: string; // "HH:MM"
  end: string; // "HH:MM", exclusive
  label?: string;
}

export interface PlanSettings {
  /** The part of the day boxes may use at all. */
  dayStart: string;
  dayEnd: string;
  /** Working hours, kept free of boxes on working days. */
  workStart: string;
  workEnd: string;
  /** 0 = Sunday … 6 = Saturday. */
  workDays: number[];
  /** Fixed family blocks, protected every day. */
  fixed: Span[];
  boxMinutes: number;
  /** Breathing room left after each box and around calendar events. */
  bufferMinutes: number;
}

/**
 * Cameron's defaults. Working hours 9–5 on weekdays; Charlie in bed by 8:30,
 * so the bedtime routine before it is protected.
 *
 * Kept in code for now; when these need changing often, they move to a
 * settings row.
 */
export const DEFAULT_PLAN_SETTINGS: PlanSettings = {
  dayStart: "06:30",
  dayEnd: "22:00",
  workStart: "09:00",
  workEnd: "17:00",
  workDays: [1, 2, 3, 4, 5],
  fixed: [{ start: "19:45", end: "20:30", label: "Charlie's bedtime" }],
  boxMinutes: 45,
  bufferMinutes: 15,
};

export interface PlanItem {
  priorityId?: string;
  title: string;
}

export interface PlannedBox {
  start: string;
  end: string;
  title: string;
  priorityId?: string;
}

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, min));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

type Range = [number, number];

/** Subtract `cut` from every range in `ranges`. */
function subtract(ranges: Range[], cut: Range): Range[] {
  const [cs, ce] = cut;
  if (ce <= cs) return ranges;
  const out: Range[] = [];
  for (const [s, e] of ranges) {
    if (ce <= s || cs >= e) {
      out.push([s, e]);
      continue;
    }
    if (cs > s) out.push([s, cs]);
    if (ce < e) out.push([ce, e]);
  }
  return out;
}

/**
 * The free windows in a day, after work, fixed blocks, calendar events and
 * the time already gone are taken out.
 *
 * `nowMin` is minutes since midnight when planning today, or null when
 * planning a day that has not started.
 */
export function freeWindows(
  weekday: number,
  events: Span[],
  settings: PlanSettings = DEFAULT_PLAN_SETTINGS,
  nowMin: number | null = null
): Span[] {
  let free: Range[] = [[toMin(settings.dayStart), toMin(settings.dayEnd)]];

  if (settings.workDays.includes(weekday)) {
    free = subtract(free, [toMin(settings.workStart), toMin(settings.workEnd)]);
  }
  for (const f of settings.fixed) free = subtract(free, [toMin(f.start), toMin(f.end)]);
  for (const e of events) {
    // Pad events so a box does not end the minute something else starts.
    free = subtract(free, [toMin(e.start) - settings.bufferMinutes, toMin(e.end) + settings.bufferMinutes]);
  }
  if (nowMin !== null) {
    // Start from the next quarter hour, not the current minute.
    const from = Math.ceil(nowMin / 15) * 15;
    free = subtract(free, [0, from]);
  }

  return free.filter(([s, e]) => e > s).map(([s, e]) => ({ start: toHHMM(s), end: toHHMM(e) }));
}

/**
 * Place one box per item, in order, in the earliest window with room for it.
 * Items that do not fit are returned in `unplaced` rather than squeezed in:
 * an honest "this will not happen today" is the point of time boxing.
 */
export function planBoxes(
  items: PlanItem[],
  windows: Span[],
  settings: PlanSettings = DEFAULT_PLAN_SETTINGS
): { boxes: PlannedBox[]; unplaced: PlanItem[] } {
  const free: Range[] = windows.map((w) => [toMin(w.start), toMin(w.end)]);
  const boxes: PlannedBox[] = [];
  const unplaced: PlanItem[] = [];

  for (const item of items) {
    const i = free.findIndex(([s, e]) => e - s >= settings.boxMinutes);
    if (i === -1) {
      unplaced.push(item);
      continue;
    }
    const [s, e] = free[i];
    const end = s + settings.boxMinutes;
    boxes.push({ start: toHHMM(s), end: toHHMM(end), title: item.title, priorityId: item.priorityId });
    free[i] = [Math.min(e, end + settings.bufferMinutes), e];
  }

  return { boxes, unplaced };
}

/** Two timed events that overlap, for the brief's conflict warnings. */
export function findConflicts<T extends Span>(events: T[]): [T, T][] {
  const sorted = [...events].sort((a, b) => toMin(a.start) - toMin(b.start));
  const out: [T, T][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (toMin(sorted[j].start) >= toMin(sorted[i].end)) break;
      out.push([sorted[i], sorted[j]]);
    }
  }
  return out;
}

export function formatSpan(start: string, end: string): string {
  const fmt = (hhmm: string) => {
    const m = toMin(hhmm);
    const h = Math.floor(m / 60) % 24;
    const mm = m % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return mm === 0 ? `${h12}` : `${h12}:${String(mm).padStart(2, "0")}`;
  };
  const suffix = (hhmm: string) => (toMin(hhmm) % (24 * 60) >= 12 * 60 ? "pm" : "am");
  const sameHalf = suffix(start) === suffix(end);
  return `${fmt(start)}${sameHalf ? "" : suffix(start)}–${fmt(end)}${suffix(end)}`;
}
