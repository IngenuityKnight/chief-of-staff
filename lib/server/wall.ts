// Server-side data assembly for the /wall kiosk. Read-only.
// Each section is fetched independently so one failure (paused DB, Google
// error) degrades to a notice instead of blanking the whole wall.

import { google } from "googleapis";
import { getOAuthClient } from "@/lib/server/google-calendar";
import { getBills, getMaintenanceItems, getMealPlan, getTasks } from "@/lib/server/data";
import { getHouseholdForJob } from "@/lib/server/household";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getHouseholdTimezone, todayInTz } from "@/lib/server/timezone";
import { TAP_TAGS } from "@/lib/tap-tags";
import {
  addDaysYmd,
  dayLabel,
  groupEventsByDay,
  parseCalendarConfig,
  relativeAgo,
  shortDate,
  timeLabel,
  toWallEvent,
  type WallEvent,
} from "@/lib/wall-events";
import type { WallData, WallDay, WallDueItem, WallTapItem, WallTaskItem } from "@/lib/wall-types";

const DAYS_SHOWN = 4;

export function wallHouseholdId(): string {
  return getHouseholdForJob(process.env.WALL_HOUSEHOLD_ID);
}

async function loadEvents(tz: string, todayYmd: string, notices: string[]): Promise<WallEvent[]> {
  const configs = parseCalendarConfig(
    process.env.WALL_CALENDAR_IDS,
    process.env.WALL_BUSY_ONLY_IDS,
    process.env.WALL_CALENDAR_LABELS,
    process.env.GOOGLE_CALENDAR_ID
  );
  const auth = getOAuthClient();
  if (!configs.length || !auth) {
    notices.push("Calendar not connected");
    return [];
  }
  const calendar = google.calendar({ version: "v3", auth });
  // Pad the window by a day each side; exact bucketing happens in groupEventsByDay.
  const timeMin = new Date(`${addDaysYmd(todayYmd, -1)}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${addDaysYmd(todayYmd, DAYS_SHOWN + 1)}T00:00:00Z`).toISOString();

  const results = await Promise.all(
    configs.map(async (cal) => {
      try {
        const { data } = await calendar.events.list({
          calendarId: cal.id,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 50,
          timeZone: tz,
        });
        return (data.items ?? []).map((e) => toWallEvent(e, cal)).filter((e): e is WallEvent => e !== null);
      } catch {
        notices.push(`Couldn't read ${cal.label}'s calendar`);
        return [];
      }
    })
  );
  return results.flat();
}

async function loadTaps(householdId: string, now: Date): Promise<WallTapItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tap_events")
    .select("slug,label,created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []).map((r: { slug: string; label: string; created_at: string }) => ({
    slug: r.slug,
    label: r.label,
    place: TAP_TAGS[r.slug]?.place ?? "",
    at: r.created_at,
    agoLabel: relativeAgo(r.created_at, now),
  }));
}

async function safe<T>(label: string, notices: string[], fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    notices.push(`${label} unavailable`);
    return fallback;
  }
}

export async function getWallData(now = new Date()): Promise<WallData> {
  const householdId = wallHouseholdId();
  const notices: string[] = [];
  const tz = await getHouseholdTimezone(householdId);
  const t = todayInTz(tz, now);
  const todayYmd = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  const horizonYmd = addDaysYmd(todayYmd, 7);

  const [events, meals, maintenance, bills, tasks, taps] = await Promise.all([
    loadEvents(tz, todayYmd, notices),
    safe("Meals", notices, [], () => getMealPlan(householdId)),
    safe("Maintenance", notices, [], () => getMaintenanceItems(householdId)),
    safe("Bills", notices, [], () => getBills(householdId)),
    safe("Tasks", notices, [], () => getTasks(householdId)),
    safe("Taps", notices, [] as WallTapItem[], () => loadTaps(householdId, now)),
  ]);

  const days: WallDay[] = groupEventsByDay(events, tz, todayYmd, DAYS_SHOWN).map((d) => ({
    ymd: d.ymd,
    label: dayLabel(d.ymd, todayYmd),
    isToday: d.ymd === todayYmd,
    events: d.events.map((e) => ({
      id: e.id,
      who: e.who,
      title: e.title,
      timeLabel: timeLabel(e, tz),
      location: e.location,
      masked: e.masked,
    })),
  }));

  const dinnerDay = meals.find((m) => m.date?.slice(0, 10) === todayYmd);
  const dinner = dinnerDay?.dinner
    ? { name: dinnerDay.dinner.name, kind: dinnerDay.dinner.kind, notes: dinnerDay.dinner.notes }
    : null;

  const dueSoon: WallDueItem[] = [];
  for (const m of maintenance) {
    const due = m.nextDue?.slice(0, 10);
    if (!due || due > horizonYmd) continue;
    dueSoon.push({
      id: `m:${m.id}`,
      label: m.item,
      detail: due < todayYmd ? `Overdue (${shortDate(due)})` : `Due ${shortDate(due)}`,
      tone: due < todayYmd ? "overdue" : "soon",
    });
  }
  for (const b of bills) {
    if (b.status === "paid" || b.status === "canceled" || !b.dueDate) continue;
    const due = b.dueDate.slice(0, 10);
    if (due > horizonYmd) continue;
    dueSoon.push({
      id: `b:${b.id}`,
      label: `${b.name} · $${Math.round(b.amount)}${b.autopay ? " (autopay)" : ""}`,
      detail: due < todayYmd ? `Overdue (${shortDate(due)})` : `Due ${shortDate(due)}`,
      tone: due < todayYmd ? "overdue" : "soon",
    });
  }
  dueSoon.sort((a, b) => (a.tone === b.tone ? a.detail.localeCompare(b.detail) : a.tone === "overdue" ? -1 : 1));

  const openTasks: WallTaskItem[] = tasks
    .filter((tk) => tk.status !== "done" && !tk.completedAt)
    .map((tk) => {
      const due = tk.dueDate?.slice(0, 10);
      return {
        id: tk.id,
        title: tk.title,
        detail: due ? `Due ${shortDate(due)}` : undefined,
        overdue: Boolean(due && due < todayYmd),
        _due: due ?? "9999-12-31",
      };
    })
    .sort((a, b) => a._due.localeCompare(b._due))
    .slice(0, 6)
    .map(({ _due, ...rest }) => rest);

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  return {
    generatedAt: now.toISOString(),
    timeZone: tz,
    todayLabel,
    days,
    dinner,
    dueSoon: dueSoon.slice(0, 6),
    tasks: openTasks,
    taps,
    notices: [...new Set(notices)],
  };
}
