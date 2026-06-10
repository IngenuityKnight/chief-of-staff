import { AgentBadge } from "@/components/ui";
import { formatTime, formatDate, relativeDay } from "@/lib/utils";
import { MapPin, Clock, CalendarDays } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import { getCalendarEvents } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { EditInline } from "@/components/edit-inline";

const TYPE_BORDER: Record<string, string> = {
  appointment: "border-l-signal-pink",
  event:       "border-l-signal-green",
  block:       "border-l-signal-blue",
  meeting:     "border-l-signal-purple",
};

export default async function SchedulePage() {
  const [calendar, calendarFields] = await Promise.all([
    getCalendarEvents(),
    Promise.resolve(getAdminFields("calendar")),
  ]);

  const now = Date.now();
  const byDay: Record<string, CalendarEvent[]> = {};
  calendar.forEach((e) => {
    const key = new Date(e.start).toDateString();
    byDay[key] ??= [];
    byDay[key].push(e);
  });
  Object.values(byDay).forEach((l) =>
    l.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  );
  const dayKeys = Object.keys(byDay).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  const upcoming = calendar.filter((e) => new Date(e.start).getTime() > now);

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Schedule</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {upcoming.length} upcoming event{upcoming.length !== 1 ? "s" : ""}
          </p>
        </div>
        <AgentBadge agent="schedule" size="md" />
      </div>

      {dayKeys.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dayKeys.slice(0, 4).map((key) => {
            const events = byDay[key];
            const date   = new Date(key);
            const isPast = date.getTime() < now - 86_400_000;
            return (
              <div key={key} className={`rounded-xl border border-edge ${isPast ? "opacity-50" : ""}`}>
                <header className="border-b border-edge px-3 py-2.5">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                    {date.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="mt-0.5 font-display text-lg font-semibold text-white">
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="text-[11px] text-slate-500">{relativeDay(events[0].start)}</div>
                </header>
                <div className="space-y-1.5 p-2">
                  {events.map((e) => (
                    <div key={e.id} className={`rounded-lg border border-edge border-l-[3px] bg-ink-950/60 px-2.5 py-2 ${TYPE_BORDER[e.type] ?? "border-l-edge"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTime(e.start)}
                          </div>
                          <div className="mt-0.5 text-sm font-medium leading-snug text-slate-100">{e.title}</div>
                          {e.location && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                              <MapPin className="h-2.5 w-2.5" />
                              {e.location}
                            </div>
                          )}
                        </div>
                        <EditInline resource="calendar" id={e.id} fields={calendarFields}
                          values={{ title: e.title, type: e.type, location: e.location ?? "", agent: e.agent ?? "", start: e.start, end: e.end, notes: e.notes ?? "" }}
                          label={`Edit ${e.title}`} />
                      </div>
                      {e.agent && <div className="mt-1.5"><AgentBadge agent={e.agent} /></div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-edge bg-ink-900/20 px-5 py-12 text-center">
          <CalendarDays className="mx-auto h-6 w-6 text-slate-600" />
          <div className="mt-2 text-sm text-slate-500">No events yet. Add one below or connect Google Calendar.</div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="rounded-xl border border-edge bg-ink-900/20">
          <div className="border-b border-edge px-4 py-3">
            <div className="text-xs font-semibold text-slate-400">Upcoming</div>
          </div>
          <ul className="divide-y divide-edge/60">
            {upcoming.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-20 shrink-0 font-mono text-xs">
                  <div className="font-semibold text-slate-200">{formatTime(e.start)}</div>
                  <div className="text-[10px] uppercase text-slate-500">{formatDate(e.start)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100">{e.title}</div>
                  {e.location && <div className="text-[11px] text-slate-500">{e.location}</div>}
                </div>
                {e.agent && <AgentBadge agent={e.agent} />}
                <EditInline resource="calendar" id={e.id} fields={calendarFields}
                  values={{ title: e.title, type: e.type, location: e.location ?? "", agent: e.agent ?? "", start: e.start, end: e.end, notes: e.notes ?? "" }}
                  label={`Edit ${e.title}`} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <InlineForm resource="calendar" fields={calendarFields}
        defaults={{ type: "event", agent: "schedule" }} label="Add event" />
    </div>
  );
}
