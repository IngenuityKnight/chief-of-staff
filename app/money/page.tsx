import { bills } from "@/lib/mock-data";
import { Panel, Stat, AgentBadge } from "@/components/ui";
import { formatMoney, relativeDay, daysUntil } from "@/lib/utils";
import { Zap, Tv, CreditCard, AlertCircle } from "lucide-react";

export default function MoneyPage() {
  const due = bills.filter((b) => b.status === "due");
  const overdue = bills.filter((b) => b.status === "overdue");
  const subs = bills.filter((b) => b.kind === "subscription");
  const monthlyTotal = bills
    .filter((b) => b.frequency === "monthly")
    .reduce((s, b) => s + b.amount, 0);
  const subsTotal = subs.reduce((s, b) => s + b.amount, 0);
  const utilityTotal = bills.filter((b) => b.category === "Utilities").reduce((s, b) => s + b.amount, 0);

  const sortedBills = [...bills]
    .filter((b) => b.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  // Category breakdown for the bar
  const categoryTotals = bills.reduce((acc, b) => {
    if (b.frequency === "monthly") {
      acc[b.category] = (acc[b.category] ?? 0) + b.amount;
    }
    return acc;
  }, {} as Record<string, number>);
  const categoryBars = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1]);

  const CAT_COLORS: Record<string, string> = {
    Housing: "bg-signal-blue",
    Utilities: "bg-signal-amber",
    Food: "bg-signal-green",
    Streaming: "bg-signal-purple",
    Health: "bg-signal-pink",
    Media: "bg-signal-cyan",
    Cloud: "bg-slate-400",
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={formatMoney(monthlyTotal)} label="Monthly Baseline" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={due.length} label="Due This Month" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={overdue.length} label="Overdue" tone="red" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={formatMoney(subsTotal)} label="Subs /mo" tone="purple" /></div></Panel>
      </div>

      <Panel eyebrow="Budget Allocation" title="Monthly flow" action={<AgentBadge agent="money" size="md" />}>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-800">
          {categoryBars.map(([cat, amt]) => {
            const pct = (amt / monthlyTotal) * 100;
            return (
              <div
                key={cat}
                className={CAT_COLORS[cat] ?? "bg-slate-500"}
                style={{ width: `${pct}%` }}
                title={`${cat}: ${formatMoney(amt)}`}
              />
            );
          })}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {categoryBars.map(([cat, amt]) => (
            <div key={cat} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-sm ${CAT_COLORS[cat] ?? "bg-slate-500"}`} />
              <span className="text-xs text-slate-400">{cat}</span>
              <span className="ml-auto font-mono text-xs tabular-nums text-slate-200">{formatMoney(amt)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel eyebrow="Upcoming" title="Bills on deck" className="lg:col-span-3">
          <ul className="divide-y divide-edge/60">
            {sortedBills.map((b) => {
              const d = b.dueDate ? daysUntil(b.dueDate) : 999;
              const isOver = b.status === "overdue";
              const Icon = b.category === "Utilities" ? Zap : b.kind === "subscription" ? Tv : CreditCard;
              return (
                <li key={b.id} className="flex items-center gap-4 py-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${isOver ? "bg-signal-red/20 text-signal-red" : "bg-ink-800 text-slate-400"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100">{b.name}</span>
                      {b.autopay && <span className="pill-cyan">Autopay</span>}
                      {isOver && <span className="pill-red"><AlertCircle className="h-2.5 w-2.5" />Overdue</span>}
                    </div>
                    <div className="text-[11px] text-slate-500">{b.category} · {b.frequency}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm tabular-nums text-slate-100">{formatMoney(b.amount)}</div>
                    <div className={isOver ? "text-[11px] text-signal-red" : "text-[11px] text-slate-500"}>
                      {isOver && d < 0 ? `${-d}d overdue` : `due ${relativeDay(b.dueDate!)}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="space-y-4 lg:col-span-2">
          <Panel eyebrow="Subscriptions" title={`${subs.length} active`}>
            <ul className="space-y-1.5">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-ink-900/40">
                  <span className="text-slate-200">{s.name}</span>
                  <span className="font-mono text-xs tabular-nums text-slate-400">{formatMoney(s.amount)}/mo</span>
                </li>
              ))}
              <li className="mt-2 flex items-center justify-between border-t border-edge pt-2 text-sm font-semibold">
                <span className="text-slate-300">Total</span>
                <span className="font-mono tabular-nums text-white">{formatMoney(subsTotal)}/mo</span>
              </li>
            </ul>
          </Panel>

          <Panel eyebrow="Money Agent" title="Flagged">
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-signal-purple/20 bg-signal-purple/5 p-3">
                <div className="font-medium text-slate-100">Spotify Family — 2 dormant seats</div>
                <div className="mt-1 text-xs text-slate-400">Potential save: $84/yr. Pending household review.</div>
              </div>
              <div className="rounded-md border border-signal-amber/20 bg-signal-amber/5 p-3">
                <div className="font-medium text-slate-100">Gas bill — autopay off</div>
                <div className="mt-1 text-xs text-slate-400">Last 3 bills paid manually. Enable autopay to avoid recurring lateness.</div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
