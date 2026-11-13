// Server-side assembly of everything the /wall kiosk shows. Each section
// loads independently, so one failure (database, Google, weather) becomes a
// small notice instead of a blank wall.

import { google } from "googleapis";
import { getHouseholdForJob } from "@/lib/server/household";
import { listBills, listMeals, listRoutine, listTaps, listTasks, listUpkeep, listVehicles } from "@/lib/server/store";
import { getHouseholdTimezone, todayInTz, zonedTimeToUtc } from "@/lib/server/timezone";
import { getWeather } from "@/lib/server/weather";
import { addDays, dueLabel, dueTone, formatTime, routineFor, vehicleAlerts, weekdayOf } from "@/lib/schedule";
import { dayLabel, groupEventsByDay, parseCalendarConfig, relativeAgo, timeLabel, toWallEvent, type WallEvent } from "@/lib/wall-events";
import type { WallData, WallDay, WallTodo } from "@/lib/wall-types";

const DAYS_SHOWN = 3;
const TODO_HORIZON_DAYS = 7;
const TODO_MAX = 9;

export function wallHouseholdId(): string {
  return getHouseholdForJob(process.env.WALL_HOUSEHOLD_ID);
}

export async function wallToday(householdId: string, now = new Date()) {
  const tz = await getHouseholdTimezone(householdId);
  const t = todayInTz(tz, now);
  const today = `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  const dayStart = zonedTimeToUtc(t.year, t.month, t.day, 0, 0, tz).toISOString();
  return { tz, today, dayStart };
}

function getOAuthClient() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, GOOGLE_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) return null;
  const client = new google.auth.OAuth2(id, secret);
  client.setCredentials({ refresh_token: refresh });
  return client;
}

async function loadEvents(tz: string, today: string, notices: string[]): Promise<WallEvent[]> {
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
  // Pad the window a day each side; exact bucketing happens in groupEventsByDay.
  const timeMin = new Date(`${addDays(today, -1)}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${addDays(today, DAYS_SHOWN + 1)}T00:00:00Z`).toISOString();
  const results = await Promise.all(
    configs.map(async (cal) => {
      try {
        const { data } = await calendar.events.list({
          calendarId: cal.id, timeMin, timeMax, singleEvents: true, orderBy: "startTime", maxResults: 50, timeZone: tz,
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

async function safe<T>(label: string, notices: string[], fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    notices.push(`${label} unavailable`);
    return fallback;
  }
}

const TONE_ORDER = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 } as const;

export async function getWallData(now = new Date()): Promise<WallData> {
  const hh = wallHouseholdId();
  const notices: string[] = [];
  const { tz, today, dayStart } = await wallToday(hh, now);
  const horizon = addDays(today, TODO_HORIZON_DAYS);

  const [events, weather, tasks, bills, upkeep, meals, routine, vehicles, taps] = await Promise.all([
    loadEvents(tz, today, notices),
    getWeather(tz),
    safe("Tasks", notices, [], () => listTasks(hh, today, dayStart)),
    safe("Bills", notices, [], () => listBills(hh, today)),
    safe("Upkeep", notices, [], () => listUpkeep(hh, today)),
    safe("Meals", notices, [], () => listMeals(hh, today, addDays(today, 6))),
    safe("Routine", notices, [], () => listRoutine(hh, today)),
    safe("Vehicles", notices, [], () => listVehicles(hh, today)),
    safe("Taps", notices, [], () => listTaps(hh, today)),
  ]);

  const days: WallDay[] = groupEventsByDay(events, tz, today, DAYS_SHOWN).map((d) => ({
    ymd: d.ymd,
    label: dayLabel(d.ymd, today),
    isToday: d.ymd === today,
    events: d.events.map((e) => ({ id: e.id, who: e.who, title: e.title, timeLabel: timeLabel(e, tz), masked: e.masked })),
  }));

  // One checklist: tasks, upkeep and bills that need a person this week.
  const todo: WallTodo[] = [];
  for (const t of tasks) {
    if (!t.done && t.dueDate && t.dueDate > horizon) continue;
    todo.push({
      key: `task:${t.id}`, kind: "task", id: t.id, title: t.title, done: t.done,
      detail: t.done ? "Done" : t.dueDate ? dueLabel(t.dueDate, today) : undefined,
      tone: t.done || !t.dueDate ? "none" : dueTone(t.dueDate, today),
    });
  }
  for (const u of upkeep) {
    if (u.nextDue > horizon) continue;
    todo.push({ key: `upkeep:${u.id}`, kind: "upkeep", id: u.id, title: u.item, done: false, detail: dueLabel(u.nextDue, today), tone: dueTone(u.nextDue, today) });
  }
  for (const b of bills) {
    // Autopay bills need nobody; amounts stay off a wall that guests can see.
    if (b.autopay || !b.dueDate || b.dueDate > horizon) continue;
    todo.push({ key: `bill:${b.id}`, kind: "bill", id: b.id, title: `Pay ${b.name}`, done: false, detail: dueLabel(b.dueDate, today), tone: dueTone(b.dueDate, today) });
  }
  for (const a of vehicleAlerts(vehicles, today)) {
    todo.push({ key: a.id, kind: "info", id: a.id, title: a.label, detail: a.detail, done: false, tone: "soon" });
  }
  todo.sort((a, b) => Number(a.done) - Number(b.done) || TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.title.localeCompare(b.title));

  const mealByDate = new Map(meals.map((m) => [m.date, m]));
  const tonight = mealByDate.get(today);
  const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

  return {
    timeZone: tz,
    todayLabel: new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(now),
    weather,
    days,
    dinner: tonight?.dinner ? { name: tonight.dinner, notes: tonight.notes } : null,
    meals: Array.from({ length: 6 }, (_, i) => {
      const ymd = addDays(today, i + 1);
      return { ymd, label: weekdayFmt.format(new Date(`${ymd}T12:00:00Z`)), dinner: mealByDate.get(ymd)?.dinner };
    }),
    routine: routineFor(routine, weekdayOf(today)).map((r) => ({ id: r.id, time: r.time, timeLabel: formatTime(r.time), label: r.label, who: r.who })),
    todo: todo.slice(0, TODO_MAX),
    todoHidden: Math.max(0, todo.length - TODO_MAX),
    taps: taps.map((t) => ({ key: `${t.slug}:${t.at}`, label: t.label, agoLabel: relativeAgo(t.at, now) })),
    notices: [...new Set(notices)],
  };
}
