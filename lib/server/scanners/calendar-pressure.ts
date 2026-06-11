// Scanner: calendar_pressure
// Sunday 16:00 — if the upcoming week has ≥3 busy evenings, emits a meals
// nudge so the Meals specialist can plan simpler dinners.
// Dedup: once per week (168-hour window).

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { persistIntake, createProposalsFromIntake } from "@/lib/server/intake";
import { hasRecentScannerItem, buildScannerAnalysis, type ScannerResult } from "./scanner-utils";

const BUSY_EVENING_THRESHOLD = 3;

export async function runCalendarPressure(): Promise<ScannerResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { scanner: "calendar_pressure", itemsFound: 0, itemsEmitted: 0, proposalsCreated: 0 };

  const now = new Date();
  const weekStart = now.toISOString();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000).toISOString();

  const { data: events } = await supabase
    .from("calendar_events")
    .select("title, start_at, end_at")
    .gte("start_at", weekStart)
    .lte("start_at", weekEnd);

  const allEvents = (events ?? []) as Array<{ title: string; start_at: string }>;
  const eveningEvents = allEvents.filter((e) => {
    const hour = new Date(e.start_at).getHours();
    return hour >= 17 && hour < 23;
  });

  if (eveningEvents.length < BUSY_EVENING_THRESHOLD) {
    return { scanner: "calendar_pressure", itemsFound: allEvents.length, itemsEmitted: 0, proposalsCreated: 0 };
  }

  const weekLabel = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const key = `scanner:calendar_pressure:week-${weekLabel}`;
  if (await hasRecentScannerItem(supabase, key, 168)) {
    return { scanner: "calendar_pressure", itemsFound: allEvents.length, itemsEmitted: 0, proposalsCreated: 0 };
  }

  const eventNames = eveningEvents.slice(0, 3).map((e) => e.title).join(", ");
  const text = `This week looks busy — ${eveningEvents.length} evenings are committed (${eventNames}${eveningEvents.length > 3 ? "…" : ""}). Let's plan simple, low-prep dinners so the week stays manageable.`;

  const analysis = buildScannerAnalysis({
    text,
    primary: "meals",
    urgency: "medium",
    analysis: `Calendar pressure detected: ${eveningEvents.length} evening events this week. Meals specialist should plan quick dinners and consider a Sunday prep block.`,
    proposedTasks: ["Plan simple weeknight dinners", "Block Sunday prep time"],
  });

  const persistence = await persistIntake(analysis, { origin: "scanner", rawInputOverride: key });
  if (!persistence.persisted) return { scanner: "calendar_pressure", itemsFound: allEvents.length, itemsEmitted: 0, proposalsCreated: 0 };

  const created = await createProposalsFromIntake(analysis);

  return { scanner: "calendar_pressure", itemsFound: allEvents.length, itemsEmitted: 1, proposalsCreated: created.length };
}
