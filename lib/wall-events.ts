// Pure helpers for the /wall kiosk: calendar config parsing, privacy masking,
// timezone-correct day grouping, and label formatting. No framework or server
// imports, so they are unit-testable with `node --test`.

// Structural subset of googleapis' calendar_v3.Schema$Event.
export interface RawGCalEvent {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  location?: string | null;
  visibility?: string | null;
  transparency?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  attendees?: Array<{ self?: boolean | null; responseStatus?: string | null }> | null;
}

export interface WallCalendarConfig {
  id: string;
  label: string;
  busyOnly: boolean;
}

export interface WallEvent {
  id: string;
  calendarId: string;
  who: string;
  title: string;
  start: string; // ISO datetime, or YYYY-MM-DD for all-day
  end: string; // all-day end is exclusive (Google semantics)
  allDay: boolean;
  location?: string;
  masked: boolean;
}

function splitList(value?: string): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function defaultLabel(id: string): string {
  const local = id.split("@")[0]?.split(".")[0] ?? id;
  return local ? local[0].toUpperCase() + local.slice(1) : id;
}

/**
 * ids:       WALL_CALENDAR_IDS        "a@x.com,b@y.edu"
 * busyOnly:  WALL_BUSY_ONLY_IDS       calendars shown as "Busy" blocks only
 * labels:    WALL_CALENDAR_LABELS     "a@x.com=Cameron,b@y.edu=Corine"
 */
export function parseCalendarConfig(
  ids: string | undefined,
  busyOnly: string | undefined,
  labels: string | undefined,
  fallbackId?: string
): WallCalendarConfig[] {
  const listed = splitList(ids);
  const idList = listed.length ? listed : fallbackId ? [fallbackId] : [];
  const busy = new Set(splitList(busyOnly).map((s) => s.toLowerCase()));
  const labelMap = new Map<string, string>();
  for (const pair of splitList(labels)) {
    const eq = pair.indexOf("=");
    if (eq > 0) labelMap.set(pair.slice(0, eq).trim().toLowerCase(), pair.slice(eq + 1).trim());
  }
  const seen = new Set<string>();
  const out: WallCalendarConfig[] = [];
  for (const id of idList) {
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, label: labelMap.get(key) || defaultLabel(id), busyOnly: busy.has(key) });
  }
  return out;
}

/**
 * Convert a Google event into a wall event, applying privacy rules:
 *  - busy-only calendars never expose titles or locations, and skip "free" events
 *  - private/confidential events always show as "Private"
 *  - cancelled events and events you declined are dropped
 */
export function toWallEvent(raw: RawGCalEvent, cal: WallCalendarConfig): WallEvent | null {
  if (!raw.id || raw.status === "cancelled") return null;
  if (raw.attendees?.some((a) => a.self && a.responseStatus === "declined")) return null;

  const startDateTime = raw.start?.dateTime ?? null;
  const start = startDateTime ?? raw.start?.date ?? null;
  if (!start) return null;
  const end = raw.end?.dateTime ?? raw.end?.date ?? start;

  if (cal.busyOnly && raw.transparency === "transparent") return null;

  const isPrivate = raw.visibility === "private" || raw.visibility === "confidential";
  const masked = cal.busyOnly || isPrivate;
  const title = masked ? (cal.busyOnly ? "Busy" : "Private") : raw.summary?.trim() || "(No title)";

  return {
    id: `${cal.id}:${raw.id}`,
    calendarId: cal.id,
    who: cal.label,
    title,
    start,
    end,
    allDay: !startDateTime,
    location: masked ? undefined : raw.location?.trim() || undefined,
    masked,
  };
}

/** YYYY-MM-DD for an instant, as seen on the wall clock in `tz`. */
export function ymdInTz(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Bucket events into `days` consecutive days starting at todayYmd.
 * Timed events land on their start day in `tz`; all-day events span every day
 * in [start, end). Within a day: all-day first, then by start time.
 */
export function groupEventsByDay(
  events: WallEvent[],
  tz: string,
  todayYmd: string,
  days: number
): Array<{ ymd: string; events: WallEvent[] }> {
  const buckets = new Map<string, WallEvent[]>();
  for (let i = 0; i < days; i++) buckets.set(addDaysYmd(todayYmd, i), []);

  for (const ev of events) {
    if (ev.allDay) {
      const endYmd = ev.end.slice(0, 10);
      let cur = ev.start.slice(0, 10);
      let guard = 0;
      do {
        buckets.get(cur)?.push(ev);
        cur = addDaysYmd(cur, 1);
        guard++;
      } while (cur < endYmd && guard < 31);
    } else {
      buckets.get(ymdInTz(ev.start, tz))?.push(ev);
    }
  }

  return [...buckets.entries()].map(([ymd, evs]) => ({
    ymd,
    events: [...evs].sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      return a.title.localeCompare(b.title);
    }),
  }));
}

export function dayLabel(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return "Today";
  if (ymd === addDaysYmd(todayYmd, 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${ymd}T12:00:00Z`));
}

export function shortDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${ymd}T12:00:00Z`));
}

export function timeLabel(ev: Pick<WallEvent, "allDay" | "start">, tz: string): string {
  if (ev.allDay) return "All day";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ev.start));
}

export function relativeAgo(thenIso: string, now: Date): string {
  const mins = Math.floor((now.getTime() - new Date(thenIso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
