import { AGENTS, PRIORITY, TASK_STATUS } from "@/lib/agents";
import { AgentBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { AgentId } from "@/lib/types";
import { getTasks } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { TaskRow } from "./task-row";
import { Clock, Flag, CheckCircle2 } from "lucide-react";

export default async function TasksPage() {
  const [tasks, taskFields] = await Promise.all([
    getTasks(),
    Promise.resolve(getAdminFields("tasks")),
  ]);

  const open     = tasks.filter((t) => t.status !== "done");
  const done     = tasks.filter((t) => t.status === "done");
  const overdue  = open.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now());
  const blocked  = open.filter((t) => t.status === "blocked");

  const byAgent: Record<string, typeof tasks> = {};
  open.forEach((t) => { byAgent[t.agent] ??= []; byAgent[t.agent].push(t); });
  const agentOrder: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];

  const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const mobileSorted = [...open].sort((a, b) => {
    const ao = a.dueDate && new Date(a.dueDate).getTime() < Date.now() ? 0 : 1;
    const bo = b.dueDate && new Date(b.dueDate).getTime() < Date.now() ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
  });

  return (
    <div className="space-y-6 py-2">

      {/* Header */}
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {open.length} open
            {overdue.length > 0 && <span className="ml-2 font-semibold text-signal-red">{overdue.length} overdue</span>}
            {blocked.length > 0 && <span className="ml-2 font-semibold text-signal-amber">{blocked.length} blocked</span>}
            {done.length > 0 && <span className="ml-2 text-slate-600">{done.length} done</span>}
          </p>
        </div>
      </div>

      {/* Empty */}
      {open.length === 0 && (
        <div className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-signal-green/60" />
          <div className="mt-2 text-sm font-semibold text-signal-green">All caught up</div>
          <div className="mt-1 text-xs text-slate-500">No open tasks.</div>
        </div>
      )}

      {/* Mobile: flat list */}
      {open.length > 0 && (
        <div className="block lg:hidden">
          <div className="rounded-xl border border-edge bg-ink-900/20 py-1">
            <ul className="divide-y divide-edge/40">
              {mobileSorted.map((task) => {
                const isOverdue = Boolean(task.dueDate && new Date(task.dueDate).getTime() < Date.now());
                return (
                  <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: AGENTS[task.agent].accent }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-100">{task.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={TASK_STATUS[task.status].pillClass}>{TASK_STATUS[task.status].label}</span>
                        {task.priority !== "low" && (
                          <span className={PRIORITY[task.priority].pillClass}>
                            <Flag className="h-2.5 w-2.5" />{PRIORITY[task.priority].label}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={isOverdue ? "pill-red" : "pill-ghost"}>
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        <AgentBadge agent={task.agent} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-4 pb-3 pt-2">
              <InlineForm resource="tasks" fields={taskFields}
                defaults={{ agent: "chief", status: "todo", priority: "medium" }} label="Add task" />
            </div>
          </div>
        </div>
      )}

      {/* Desktop: kanban */}
      {open.length > 0 && (
        <div className="hidden gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {agentOrder.map((agentId) => {
            const list = byAgent[agentId] ?? [];
            const a    = AGENTS[agentId];
            return (
              <section key={agentId} className="overflow-hidden rounded-xl border border-edge">
                <header className="flex items-center justify-between border-b border-edge px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: a.accent }} />
                    <span className="font-display text-sm font-semibold text-white">{a.name}</span>
                    {list.length > 0 && (
                      <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{list.length}</span>
                    )}
                  </div>
                  <span className="text-2xs uppercase tracking-wider text-slate-600">{a.role}</span>
                </header>
                {list.length > 0 && (
                  <ul className="divide-y divide-edge/60">
                    {list.map((task) => (
                      <TaskRow key={task.id} task={task} fields={taskFields} />
                    ))}
                  </ul>
                )}
                <div className="px-4 pb-4 pt-2">
                  <InlineForm resource="tasks" fields={taskFields}
                    defaults={{ agent: agentId, status: "todo", priority: "medium" }}
                    label={`Add ${a.shortName} task`} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-edge/60" />
            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-600">Done · {done.length}</span>
            <div className="h-px flex-1 bg-edge/60" />
          </div>
          {done.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-edge/50 bg-ink-900/20 px-4 py-2.5 opacity-50">
              <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-edge bg-ink-800 text-signal-green" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-500 line-through">{t.title}</span>
              <span className="text-[11px] text-slate-600">{formatDate(t.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
