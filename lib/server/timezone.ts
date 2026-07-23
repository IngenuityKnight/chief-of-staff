// Household-timezone date math (audit B5). Vercel functions run in UTC, so
// "block 6pm" must be computed against the household's wall clock, not the
// server's. No dependency needed — Intl.DateTimeFormat provides the offset.

import { getSupabaseAdmin } from "@/lib/server/supabase";

const FALLBACK_TZ = "America/Chicago";

export async function getHouseholdTimezone(householdId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return FALLBACK_TZ;
  try {
    const { data } = await supabase
      .from("household_context")
      .select("timezone")
      .eq("household_id", householdId)
      .maybeSingle();
    const tz = (data as { timezone?: string } | null)?.timezone;
    return tz && isValidTimeZone(tz) ? tz : FALLBACK_TZ;
  } catch {
    return FALLBACK_TZ;
  }
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Offset of `timeZone` from UTC at the given instant, in ms.
function tzOffsetMs(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The UTC instant at which `timeZone`'s wall clock reads the given
 * year/month/day hour:minute. Month is 1-12. Handles DST by refining once.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(timeZone, new Date(utcGuess));
  let ts = utcGuess - offset;
  const refined = tzOffsetMs(timeZone, new Date(ts));
  if (refined !== offset) ts = utcGuess - refined;
  return new Date(ts);
}

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0 = Sunday, matching Date#getDay()
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Today's calendar date as seen on the household's wall clock. */
export function todayInTz(timeZone: string, now = new Date()): DateParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(dtf.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

/** Pure calendar-date arithmetic on DateParts (no timezone effects). */
export function addDays(parts: DateParts, days: number): DateParts {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
    weekday: base.getUTCDay(),
  };
}
