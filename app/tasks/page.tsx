import { AGENTS, PRIORITY, TASK_STATUS } from "@/lib/agents";
import { Panel, Stat, AgentBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { AgentId } from "@/lib/types";
import { getTasks } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { TaskRow } from "./task-row";
import { Clock, Flag } from "lucide-react";

export default async function TasksPage() {
  const [tasks, taskFields] = await Promise.all([getTasks(), Promise.resolve(getAdminFields("tasks"))]);
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== "done").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;

  // Group open tasks by agent (desktop kanban)
  const byAgent: Record<string, typeof tasks> = {};
  open.forEach((t) => {
    byAgent[t.agent] ??= [];
    byAgent[t.agent].push(t);
  });

  const agentOrder: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];

  // Mobile: flat list sorted by overdue → priority → title
  const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const mobileSorted = [...open].sort((a, b) => {
    const aOverdue = a.dueDate && new Date(a.dueDate).getTime() < Date.now() ? 0 : 1;
    const bOverdue = b.dueDate && new Date(b.dueDate).getTime() < Date.now() ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const pr = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (pr !== 0) return pr;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={open.length} label="Open" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={overdue} label="Overdue" tone="red" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={blocked} label="Blocked" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={done} label="Done" tone="green" /></div></Panel>
      </div>

      {/* Mobile: flat priority list */}
      <div className="block lg:hidden">
        <Panel eyebrow="Open Tasks" title={`${open.length} remaining`}>
          {mobileSorted.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">All caught up.</div>
          ) : (
            <ul className="divide-y divide-edge/60">
              {mobileSorted.map((task) => {
                const isOverdue = Boolean(task.dueDate && new Date(task.dueDate).getTime() < Date.now());
                return (
                  <li key={task.id} className="flex items-start gap-3 px-1 py-3">
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: AGENTS[task.agent].accent }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-100">{task.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={TASK_STATUS[task.status].pillClass}>{TASK_STATUS[task.status].label}</span>
                        {task.priority !== "low" && (
                          <span className={PRIORITY[task.priority].pillClass}>
                            <Flag className="h-2.5 w-2.5" />
                            {PRIORITY[task.priority].label}
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
          )}
          <InlineForm
            resource="tasks"
            fields={taskFields}
            defaults={{ agent: "chief", status: "todo", priority: "medium" }}
            label="Add task"
          />
        </Panel>
      </div>

      {/* Desktop: kanban-by-agent */}
      <div className="hidden lg:grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {agentOrder.map((agentId) => {
          const list = byAgent[agentId] ?? [];
          const a = AGENTS[agentId];
          return (
            <section key={agentId} className="panel overflow-hidden">
              <header className="flex items-center justify-between border-b border-edge px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: a.accent }} />
                  <span className="font-display text-sm font-semibold text-white">{a.name}</span>
                  {list.length > 0 && (
                    <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {list.length}
                    </span>
                  )}
                </div>
                <span className="text-2xs uppercase tracking-wider text-slate-500">{a.role}</span>
              </header>
              {list.length > 0 && (
                <ul className="divide-y divide-edge/60">
                  {list.map((task) => (
                    <TaskRow key={task.id} task={task} fields={taskFields} />
                  ))}
                </ul>
              )}
              <div className="px-4 pb-4">
                <InlineForm
                  resource="tasks"
                  fields={taskFields}
                  defaults={{ agent: agentId, status: "todo", priority: "medium" }}
                  label={`Add ${a.shortName} task`}
                />
              </div>
            </section>
          );
        })}
      </div>

      {/* Completed */}
      {done > 0 && (
        <Panel eyebrow="Archive" title="Recently completed">
          <ul className="divide-y divide-edge/60">
            {tasks
              .filter((t) => t.status === "done")
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-edge bg-ink-800 text-signal-green" />
                    <span className="text-sm text-slate-500 line-through">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <AgentBadge agent={t.agent} />
                    <span>{formatDate(t.createdAt)}</span>
                  </div>
                </li>
              ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
