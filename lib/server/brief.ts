// The morning brief's planning step, shared by the page that previews a plan
// and the action that accepts it, so the two can never disagree about what
// "the plan" was.

import type { WallData } from "@/lib/wall-types";
import type { Priority, Timebox } from "@/lib/server/command";
import { weekdayOf } from "@/lib/schedule";
import {
  DEFAULT_PLAN_SETTINGS,
  freeWindows,
  planBoxes,
  type PlanItem,
  type PlannedBox,
  type Span,
} from "@/lib/timebox";

/** Minutes since midnight in the household's timezone. */
export function nowMinutesIn(tz: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Today's timed calendar events as spans. All-day events do not block time. */
export function todaysEventSpans(wall: WallData | null): Span[] {
  const today = wall?.days.find((d) => d.isToday);
  return (today?.events ?? [])
    .filter((e) => e.time && e.endTime)
    .map((e) => ({ start: e.time!, end: e.endTime!, label: e.title }));
}

export interface DayPlan {
  boxes: PlannedBox[];
  unplaced: PlanItem[];
  /** Priorities left out because they are Work or untagged. */
  skipped: Priority[];
  windows: Span[];
}

/**
 * What the planner would propose right now. Only open Home and Self
 * priorities are boxed, and ones that already have a finished box today are
 * not boxed again.
 */
export function proposePlan(
  today: string,
  tz: string,
  wall: WallData | null,
  priorities: Priority[],
  existing: Timebox[],
  now = new Date()
): DayPlan {
  const settled = new Set(existing.filter((b) => b.status !== "planned" && b.priorityId).map((b) => b.priorityId));
  const open = priorities.filter((p) => !p.doneAt && !settled.has(p.id));
  const boxable = open.filter((p) => p.area === "home" || p.area === "self");
  const skipped = open.filter((p) => p.area !== "home" && p.area !== "self");

  // Boxes already settled today still occupy their time.
  const taken: Span[] = existing
    .filter((b) => b.status !== "planned")
    .map((b) => ({ start: b.start, end: b.end }));

  const windows = freeWindows(
    weekdayOf(today),
    [...todaysEventSpans(wall), ...taken],
    DEFAULT_PLAN_SETTINGS,
    nowMinutesIn(tz, now)
  );
  const { boxes, unplaced } = planBoxes(
    boxable.map((p) => ({ priorityId: p.id, title: p.title })),
    windows
  );
  return { boxes, unplaced, skipped, windows };
}
