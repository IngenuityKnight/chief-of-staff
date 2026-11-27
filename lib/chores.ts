// Chore cadence: when is this chore next due?
//
// Pure functions on "YYYY-MM-DD" strings, so the rules can be tested without
// a database or a clock. Dates are calendar days in the household's timezone;
// there is no time of day anywhere in here on purpose.
//
// A chore only ever has one next due date. Missing a week of a daily chore
// does not pile up seven overdue copies; it leaves one overdue chore, and
// completing, skipping or rescheduling it moves that one date forward.

export type CadenceKind = "days" | "weekdays" | "weeks" | "months";

/** How the next due date is worked out after a completion. */
export type Anchor = "scheduled" | "completion";

export type ChoreStatus = "active" | "paused" | "archived";

export interface Cadence {
  kind: CadenceKind;
  /** Every N days, weeks or months. Ignored for weekdays. */
  interval: number;
  /** 0 = Sunday … 6 = Saturday. Only used for weekdays. */
  weekdays: number[];
}

export interface Chore {
  id: string;
  name: string;
  room: string;
  assignee?: string;
  cadence: Cadence;
  anchor: Anchor;
  /**
   * The date the calendar rhythm counts from. With a scheduled anchor every
   * occurrence is start + k intervals, which is what keeps "the 1st of every
   * month" on the 1st even after a late completion or a one-off reschedule.
   */
  startDate: string;
  nextDue: string;
  estimateMinutes?: number;
  notes?: string;
  status: ChoreStatus;
}

export type EventKind = "completed" | "skipped" | "rescheduled";

export interface ChoreEvent {
  id: string;
  choreId: string;
  choreName: string;
  room?: string;
  kind: EventKind;
  /** The day it was done or skipped, or the day the reschedule was made. */
  onDate: string;
  /** What the chore was due on before this event. */
  dueDate?: string;
  /** What it is due on after this event. */
  newDue?: string;
  actor?: string;
  createdAt: string;
}

// ─── date arithmetic ─────────────────────────────────────────────────────────

const toDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
const fromDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(ymd: string, n: number): string {
  const d = toDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

export function weekday(ymd: string): number {
  return toDate(ymd).getUTCDay();
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** Add months, keeping the start's day where it exists and clamping where it does not (Jan 31 → Feb 28). */
export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = total % 12; // 0-based
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

const maxYmd = (a: string, b: string) => (a > b ? a : b);

// ─── cadence ─────────────────────────────────────────────────────────────────

function cleanInterval(n: number): number {
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** The first matching weekday strictly after a date. */
function nextWeekdayAfter(after: string, weekdays: number[]): string {
  const days = weekdays.length ? weekdays : [weekday(after)];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(after, i);
    if (days.includes(weekday(d))) return d;
  }
  return addDays(after, 7);
}

/** One interval on from a date — the completion-date rule. */
export function advance(c: Cadence, from: string): string {
  const n = cleanInterval(c.interval);
  switch (c.kind) {
    case "days":
      return addDays(from, n);
    case "weeks":
      return addDays(from, 7 * n);
    case "months":
      return addMonths(from, n);
    case "weekdays":
      return nextWeekdayAfter(from, c.weekdays);
  }
}

/**
 * The first occurrence on the chore's calendar rhythm strictly after a date —
 * the scheduled-date rule. Occurrences are start, start + 1 interval, …
 */
export function occurrenceAfter(c: Cadence, start: string, after: string): string {
  if (start > after) return start;
  const n = cleanInterval(c.interval);
  switch (c.kind) {
    case "days":
    case "weeks": {
      const step = c.kind === "days" ? n : 7 * n;
      const k = Math.floor(daysBetween(start, after) / step) + 1;
      return addDays(start, k * step);
    }
    case "months": {
      const [sy, sm] = start.split("-").map(Number);
      const [ay, am] = after.split("-").map(Number);
      let k = Math.max(0, Math.floor(((ay - sy) * 12 + (am - sm)) / n));
      while (addMonths(start, k * n) <= after) k++;
      return addMonths(start, k * n);
    }
    case "weekdays":
      return nextWeekdayAfter(after, c.weekdays);
  }
}

/**
 * Next due date after marking a chore done on `doneOn`.
 *
 * Scheduled: the next slot on the calendar after both the due date and the
 * day it was done, so finishing early does not leave it due again on the same
 * date, and finishing late does not create a backlog of missed slots.
 *
 * Completion: one interval from the day it was actually done.
 */
export function nextDueAfterComplete(chore: Chore, doneOn: string): string {
  if (chore.anchor === "completion") return advance(chore.cadence, doneOn);
  return occurrenceAfter(chore.cadence, chore.startDate, maxYmd(chore.nextDue, doneOn));
}

/**
 * Next due date after skipping the current one on `today`.
 *
 * Skipping passes over this occurrence only. If it was already overdue, the
 * next slot is the first one from today, so skipping an old miss never jumps
 * straight past something due today.
 */
export function nextDueAfterSkip(chore: Chore, today: string): string {
  if (chore.anchor === "completion") return advance(chore.cadence, maxYmd(chore.nextDue, today));
  return occurrenceAfter(chore.cadence, chore.startDate, maxYmd(chore.nextDue, addDays(today, -1)));
}

// ─── labels ──────────────────────────────────────────────────────────────────

export const DUE_SOON_DAYS = 3;

export type DueState = "overdue" | "today" | "soon" | "later" | "paused" | "archived";

export function dueState(chore: Pick<Chore, "status" | "nextDue">, today: string): DueState {
  if (chore.status === "archived") return "archived";
  if (chore.status === "paused") return "paused";
  if (chore.nextDue < today) return "overdue";
  if (chore.nextDue === today) return "today";
  if (daysBetween(today, chore.nextDue) <= DUE_SOON_DAYS) return "soon";
  return "later";
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeCadence(c: Cadence): string {
  const n = cleanInterval(c.interval);
  switch (c.kind) {
    case "days":
      return n === 1 ? "Every day" : `Every ${n} days`;
    case "weeks":
      return n === 1 ? "Every week" : `Every ${n} weeks`;
    case "months":
      return n === 1 ? "Every month" : `Every ${n} months`;
    case "weekdays": {
      const days = [...c.weekdays].sort((a, b) => a - b);
      if (days.length === 7) return "Every day";
      if (days.join() === "1,2,3,4,5") return "Weekdays";
      if (days.join() === "0,6") return "Weekends";
      return days.map((d) => WEEKDAY_SHORT[d]).join(", ") || "Pick days";
    }
  }
}

/** "Today", "Tomorrow", "Sat, Nov 28", or "3 days ago". */
export function describeDue(nextDue: string, today: string): string {
  const diff = daysBetween(today, nextDue);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days ago`;
  const opts: Intl.DateTimeFormatOptions =
    diff < 7
      ? { timeZone: "UTC", weekday: "long" }
      : { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" };
  return new Intl.DateTimeFormat("en-US", opts).format(toDate(nextDue));
}

export function formatDay(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(
    toDate(ymd)
  );
}

export const isYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Validate cadence input from a form. Returns a usable cadence or a reason it is not. */
export function parseCadence(kind: string, interval: unknown, weekdays: unknown[]): Cadence | string {
  if (kind === "daily") return { kind: "days", interval: 1, weekdays: [] };
  if (!["days", "weekdays", "weeks", "months"].includes(kind)) return "Pick how often it repeats.";
  const n = Number(interval);
  if (kind !== "weekdays" && (!Number.isInteger(n) || n < 1 || n > 365)) return "Use a whole number from 1 to 365.";
  const days = [...new Set(weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  if (kind === "weekdays" && days.length === 0) return "Pick at least one day of the week.";
  return { kind: kind as CadenceKind, interval: kind === "weekdays" ? 1 : n, weekdays: kind === "weekdays" ? days : [] };
}

/**
 * For a days-of-week chore, the first due date should land on one of its
 * days. If the date someone picked is not one, move to the next one that is.
 */
export function alignFirstDue(c: Cadence, date: string): string {
  if (c.kind !== "weekdays" || c.weekdays.includes(weekday(date))) return date;
  return nextWeekdayAfter(date, c.weekdays);
}
