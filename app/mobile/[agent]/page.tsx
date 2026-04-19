import { notFound } from "next/navigation";
import { AGENTS, TASK_STATUS, PRIORITY } from "@/lib/agents";
import { getTasks, getBills, getMaintenanceItems, getCalendarEvents } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { formatMoney, relativeDay, formatTime } from "@/lib/utils";
import type { AgentId } from "@/lib/types";
import { Clock, Flag, AlertCircle } from "lucide-react";

const VALID_AGENTS: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];

export default async function MobileAgentPage({
  params,
}: {
  params: Promise<{ agent: string }>;
}) {
  const { agent } = await params;

  if (!VALID_AGENTS.includes(agent as AgentId)) notFound();
  const agentId = agent as AgentId;
  const a = AGENTS[agentId];

  const [tasks, bills, maintenance, events, taskFields] = await Promise.all([
    getTasks(),
    getBills(),
    getMaintenanceItems(),
    getCalendarEvents(),
    Promise.resolve(getAdminFields("tasks")),
  ]);

  const agentTasks = tasks
    .filter((t) => t.agent === agentId && t.status !== "done")
    .slice(0, 8);

  const now = Date.now();

  return (
    <div className="space-y-4">
      {/* Agent header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${a.accent}20`, border: `1px solid ${a.accent}40` }}
        >
          <div className="h-3 w-3 rounded-full" style={{ background: a.accent }} />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold text-white">{a.name}</h1>
          <p className="text-xs text-slate-500">{a.role}</p>
        </div>
      </div>

      {/* Agent-specific content */}
      {agentId === "money" && (
        <div className="space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bills</div>
          {bills.slice(0, 6).map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-edge bg-ink-900/50 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-100">{b.name}</div>
                <div className="text-xs text-slate-500">{b.category} · {b.frequency}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-slate-100">{formatMoney(b.amount)}</div>
                {b.status === "overdue" && (
                  <div className="flex items-center gap-1 text-[11px] text-signal-red">
                    <AlertCircle className="h-3 w-3" />overdue
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {agentId === "home" && (
        <div className="space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500">Maintenance</div>
          {maintenance.slice(0, 6).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-edge bg-ink-900/50 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-100">{m.item}</div>
                <div className="text-xs text-slate-500">{m.system} · {m.frequency}</div>
              </div>
              <div className={`text-xs ${m.status === "overdue" ? "text-signal-red" : "text-slate-500"}`}>
                {m.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {agentId === "schedule" && (
        <div className="space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500">Upcoming Events</div>
          {events
            .filter((e) => new Date(e.start).getTime() > now)
            .slice(0, 6)
            .map((e) => (
              <div key={e.id} className="rounded-lg border border-edge bg-ink-900/50 px-4 py-3">
                <div className="text-sm font-medium text-slate-100">{e.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {formatTime(e.start)} · {relativeDay(e.start)}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Tasks for this agent */}
      {agentTasks.length > 0 && (
        <div className="space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open Tasks</div>
          {agentTasks.map((t) => {
            const isOverdue = t.dueDate && new Date(t.dueDate).getTime() < now;
            return (
              <div key={t.id} className="rounded-lg border border-edge bg-ink-900/50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    defaultChecked={false}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-edge bg-ink-800 accent-signal-blue"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100">{t.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={TASK_STATUS[t.status].pillClass}>{TASK_STATUS[t.status].label}</span>
                      {t.priority !== "low" && (
                        <span className={PRIORITY[t.priority].pillClass}>
                          <Flag className="h-2.5 w-2.5" />
                          {PRIORITY[t.priority].label}
                        </span>
                      )}
                      {t.dueDate && (
                        <span className={isOverdue ? "pill-red" : "pill-ghost"}>
                          <Clock className="h-2.5 w-2.5" />
                          {relativeDay(t.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick add task */}
      <InlineForm
        resource="tasks"
        fields={taskFields}
        defaults={{ agent: agentId, status: "todo", priority: "medium" }}
        label={`Add ${a.shortName} task`}
      />
    </div>
  );
}
