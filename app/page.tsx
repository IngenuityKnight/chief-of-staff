import Link from "next/link";
import { ArrowRight, AlertTriangle, Sparkles, Clock, DollarSign, Wrench, CalendarDays, Package, TrendingUp } from "lucide-react";
import { AGENTS, TASK_STATUS } from "@/lib/agents";
import { Panel, Stat, AgentBadge, SectionHeading } from "@/components/ui";
import { formatMoney, formatTime, relativeDay, daysUntil } from "@/lib/utils";
import { getBills, getBriefingSummary, getCalendarEvents, getInventoryItems, getMaintenanceItems, getTasks } from "@/lib/server/data";

export default async function BriefingPage() {
  const [briefing, tasks, bills, maintenance, calendar, inventory] = await Promise.all([
    getBriefingSummary(),
    getTasks(),
    getBills(),
    getMaintenanceItems(),
    getCalendarEvents(),
    getInventoryItems(),
  ]);

  const lowStockItems = inventory.filter((i) => i.quantity <= i.minQuantity);

  const topTasks = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 5);

  const upcomingEvents = calendar
    .filter((e) => new Date(e.start).getTime() > Date.now() - 3600000)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 5);

  const billsSoon = bills
    .filter((b) => b.dueDate && b.status !== "paid")
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);

  const maintAlerts = maintenance
    .filter((m) => m.status === "due-soon" || m.status === "overdue")
    .sort((a, b) => new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime());

  return (
    <div className="space-y-6">
      {/* Hero / Situation */}
      <section className="panel relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-signal-blue/10 via-transparent to-signal-purple/10" />
        <div className="relative grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_1fr] md:px-8 md:py-7">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-signal-blue">
              Situation Report · {briefing.date}
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white md:text-4xl">
              {briefing.greeting}.
            </h2>
            <p className="mt-2 max-w-xl text-base text-slate-300">{briefing.headline}</p>

            <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-6">
              <Stat value={briefing.tasksOpen} label="Open Tasks" />
              <Stat value={briefing.tasksDue} label="Due ≤3d" tone="amber" />
              <Stat value={briefing.tasksOverdue} label="Overdue" tone="red" />
              <Stat value={briefing.upcomingEvents} label="On Calendar" tone="cyan" />
              <Stat value={briefing.lowStockItems} label="Low Stock" tone={briefing.lowStockItems > 0 ? "amber" : "green"} />
              {briefing.savingsRatePercent !== null && (
                <Stat value={`${briefing.savingsRatePercent}%`} label="Net Equity" tone="purple" />
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            <SectionHeading>Top Priorities</SectionHeading>
            {briefing.priorities.map((p) => (
              <div key={p.id} className="rounded-lg border border-edge bg-ink-900/60 p-3">
                <div className="flex items-start gap-3">
                  <AgentBadge agent={p.agent} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-100">{p.title}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{p.why}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-agent insights */}
      <Panel eyebrow="Synthesis" title="Cross-Agent Insights" action={<AgentBadge agent="chief" size="md" />}>
        <div className="grid gap-3 md:grid-cols-3">
          {briefing.crossAgentInsights.map((x) => (
            <div key={x.id} className="rounded-lg border border-edge bg-ink-900/40 p-4">
              <div className="mb-2 flex gap-1.5">
                {x.agents.map((a) => (
                  <AgentBadge key={a} agent={a} />
                ))}
              </div>
              <div className="flex gap-2 text-sm text-slate-300">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-blue" />
                <span>{x.insight}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Inventory low-stock alert */}
      {lowStockItems.length > 0 && (
        <Panel eyebrow="Inventory" title="Low Stock Alert" action={
          <Link href="/shopping" className="flex items-center gap-1 text-xs font-semibold text-signal-amber hover:underline">
            Shopping list <ArrowRight className="h-3 w-3" />
          </Link>
        }>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.slice(0, 12).map((item) => (
              <Link key={item.id} href="/inventory" className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition hover:bg-ink-900/60 border-signal-amber/20 bg-signal-amber/5 text-signal-amber">
                <Package className="h-3 w-3" />
                <span className="font-medium">{item.name}</span>
                <span className="font-mono text-signal-amber/60">{item.quantity}/{item.minQuantity} {item.unit}</span>
              </Link>
            ))}
            {lowStockItems.length > 12 && (
              <Link href="/inventory" className="flex items-center rounded-md border border-edge px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200">
                +{lowStockItems.length - 12} more →
              </Link>
            )}
          </div>
          {briefing.savingsRatePercent !== null && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-signal-green/20 bg-signal-green/5 px-4 py-2.5">
              <TrendingUp className="h-4 w-4 text-signal-green" />
              <div className="text-sm text-slate-300">
                Net equity position: <span className="font-semibold text-signal-green">{briefing.savingsRatePercent}%</span>
                <span className="ml-2 text-xs text-slate-500">assets vs. liabilities from linked accounts</span>
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* Grid: tasks + events + bills + maintenance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          eyebrow="Active Queue"
          title="Top tasks"
          action={
            <Link href="/tasks" className="flex items-center gap-1 text-xs font-semibold text-signal-blue hover:underline">
              All tasks <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {topTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 rounded-md border border-transparent px-2 py-2 transition hover:border-edge hover:bg-ink-900/60">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: AGENTS[t.agent].accent }} />
                <div className="flex-1">
                  <div className="text-sm text-slate-100">{t.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <AgentBadge agent={t.agent} />
                    <span className={TASK_STATUS[t.status].pillClass}>{TASK_STATUS[t.status].label}</span>
                    {t.dueDate && (
                      <span className="text-[11px] text-slate-500">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {relativeDay(t.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          eyebrow="Next 72h"
          title="Calendar"
          action={
            <Link href="/schedule" className="flex items-center gap-1 text-xs font-semibold text-signal-blue hover:underline">
              Full calendar <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {upcomingEvents.map((e) => (
              <li key={e.id} className="flex items-start gap-3 rounded-md px-2 py-2">
                <div className="w-16 shrink-0 font-mono text-xs text-slate-400">
                  <div className="font-semibold text-slate-200">{formatTime(e.start)}</div>
                  <div className="text-[10px] uppercase tracking-wider">{relativeDay(e.start)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-100">{e.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                    {e.location && <span><CalendarDays className="mr-1 inline h-3 w-3" />{e.location}</span>}
                    {e.agent && <AgentBadge agent={e.agent} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          eyebrow="Money"
          title="Bills on deck"
          action={
            <Link href="/money" className="flex items-center gap-1 text-xs font-semibold text-signal-blue hover:underline">
              Ledger <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <ul className="space-y-2">
            {billsSoon.map((b) => {
              const d = daysUntil(b.dueDate!);
              const overdue = d < 0;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2">
                  <div className="flex items-center gap-3">
                    <DollarSign className={overdue ? "h-4 w-4 text-signal-red" : "h-4 w-4 text-slate-500"} />
                    <div>
                      <div className="text-sm text-slate-100">{b.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {b.category} · {b.autopay ? "autopay" : "manual"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm tabular-nums text-slate-100">{formatMoney(b.amount)}</div>
                    <div className={overdue ? "text-[11px] text-signal-red" : "text-[11px] text-slate-500"}>
                      {overdue ? `${-d}d overdue` : `due ${relativeDay(b.dueDate!)}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          eyebrow="Home"
          title="Maintenance alerts"
          action={
            <Link href="/home" className="flex items-center gap-1 text-xs font-semibold text-signal-blue hover:underline">
              All maintenance <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {maintAlerts.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">All systems nominal.</div>
          ) : (
            <ul className="space-y-2">
              {maintAlerts.map((m) => {
                const d = daysUntil(m.nextDue);
                const overdue = m.status === "overdue";
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2">
                    <div className="flex items-start gap-3">
                      {overdue ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-signal-red" />
                      ) : (
                        <Wrench className="mt-0.5 h-4 w-4 text-signal-amber" />
                      )}
                      <div>
                        <div className="text-sm text-slate-100">{m.item}</div>
                        <div className="text-[11px] text-slate-500">
                          {m.system} · {m.frequency}
                        </div>
                      </div>
                    </div>
                    <span className={overdue ? "pill-red" : "pill-amber"}>
                      {overdue ? `${-d}d overdue` : relativeDay(m.nextDue)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
