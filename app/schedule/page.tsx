import { Panel, Stat, AgentBadge } from "@/components/ui";
import { formatTime, formatDate, relativeDay } from "@/lib/utils";
import { AGENTS } from "@/lib/agents";
import { MapPin, Clock } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import { getCalendarEvents } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { EditInline } from "@/components/edit-inline";

const TYPE_META = {
  appointment: { pillClass: "pill-pink",   label: "Appt" },
  event:       { pillClass: "pill-green",  label: "Event" },
  block:       { pillClass: "pill-blue",   label: "Block" },
  meeting:     { pillClass: "pill-purple", label: "Meeting" },
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
  Object.values(byDay).forEach((list) =>
    list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  );
  const dayKeys = Object.keys(byDay).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const upcoming = calendar.filter((e) => new Date(e.start).getTime() > now).length;
  const appts = calendar.filter((e) => e.type === "appointment").length;
  const blocks = calendar.filter((e) => e.type === "block").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={calendar.length} label="This Week" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={upcoming} label="Upcoming" tone="cyan" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={appts} label="Appointments" tone="pink" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={blocks} label="Time Blocks" tone="blue" /></div></Panel>
      </div>

      <Panel eyebrow="Week View" title="Calendar" action={<AgentBadge agent="schedule" size="md" />}>
        <div className="grid gap-3 md:grid-cols-4">
          {dayKeys.slice(0, 4).map((key) => {
            const events = byDay[key];
            const date = new Date(key);
            return (
              <div key={key} className="rounded-lg border border-edge bg-ink-900/20">
                <header className="border-b border-edge px-3 py-2.5">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                    {date.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="mt-0.5 font-display text-lg font-semibold text-white">
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="text-[11px] text-slate-500">{relativeDay(events[0].start)}</div>
                </header>
                <div className="space-y-2 p-3">
                  {events.map((e) => {
                    const M = TYPE_META[e.type];
                    return (
                      <div
                        key={e.id}
                        className="rounded-md border-l-2 bg-ink-950/60 p-2.5"
                        style={{ borderLeftColor: e.agent ? AGENTS[e.agent].accent : "#60a5fa" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                              <Clock className="h-2.5 w-2.5" />
                              {formatTime(e.start)} — {formatTime(e.end)}
                            </div>
                            <div className="mt-1 text-sm font-medium text-slate-100">{e.title}</div>
                          </div>
                          <EditInline
                            resource="calendar"
                            id={e.id}
                            fields={calendarFields}
                            values={{
                              title: e.title,
                              type: e.type,
                              location: e.location ?? "",
                              agent: e.agent ?? "",
                              start: e.start,
                              end: e.end,
                              notes: e.notes ?? "",
                            }}
                            label={`Edit ${e.title}`}
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={M.pillClass}>{M.label}</span>
                          {e.agent && <AgentBadge agent={e.agent} />}
                        </div>
                        {e.location && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="h-2.5 w-2.5" />
                            {e.location}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Upcoming" title="Next 5">
          <ul className="divide-y divide-edge/60">
            {calendar
              .filter((e) => new Date(e.start).getTime() > now)
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .slice(0, 5)
              .map((e) => (
                <li key={e.id} className="flex items-center gap-4 py-3">
                  <div className="w-20 shrink-0 font-mono text-xs">
                    <div className="font-semibold text-slate-200">{formatTime(e.start)}</div>
                    <div className="text-[10px] uppercase text-slate-500">{formatDate(e.start)}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-100">{e.title}</div>
                    {e.location && <div className="text-[11px] text-slate-500">{e.location}</div>}
                  </div>
                  {e.agent && <AgentBadge agent={e.agent} />}
                  <EditInline
                    resource="calendar"
                    id={e.id}
                    fields={calendarFields}
                    values={{
                      title: e.title,
                      type: e.type,
                      location: e.location ?? "",
                      agent: e.agent ?? "",
                      start: e.start,
                      end: e.end,
                      notes: e.notes ?? "",
                    }}
                    label={`Edit ${e.title}`}
                  />
                </li>
              ))}
          </ul>
          <InlineForm
            resource="calendar"
            fields={calendarFields}
            defaults={{ type: "event", agent: "schedule" }}
            label="Add event"
          />
        </Panel>

        <Panel eyebrow="Schedule Agent" title="Time protection">
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-edge bg-ink-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">No meetings before 9am</span>
                <span className="pill-red">must</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">Mornings are family time. 3 proposed meetings auto-rejected this week.</div>
            </div>
            <div className="rounded-md border border-edge bg-ink-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">Protect Friday afternoons</span>
                <span className="pill-blue">prefer</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">Fri 1-5pm reserved for deep work. No conflicts this week.</div>
            </div>
            <div className="rounded-md border border-signal-cyan/20 bg-signal-cyan/5 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-signal-cyan">Proactive</span>
              </div>
              <div className="mt-1 text-slate-200">Two Thursday practice drop-offs could be consolidated — Sam and Maya both leave 4:45pm.</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
