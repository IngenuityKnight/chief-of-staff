import { maintenance } from "@/lib/mock-data";
import { Panel, Stat, AgentBadge } from "@/components/ui";
import { formatMoney, relativeDay, daysUntil } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Wrench, Clock } from "lucide-react";

const STATUS_META = {
  ok:            { pillClass: "pill-green", label: "OK",           icon: CheckCircle2 },
  "due-soon":    { pillClass: "pill-amber", label: "Due Soon",     icon: Clock },
  overdue:       { pillClass: "pill-red",   label: "Overdue",      icon: AlertTriangle },
  "in-progress": { pillClass: "pill-blue",  label: "In Progress",  icon: Wrench },
};

const SYSTEM_COLORS: Record<string, string> = {
  HVAC: "bg-signal-blue/20 text-signal-blue",
  Plumbing: "bg-signal-cyan/20 text-signal-cyan",
  Electrical: "bg-signal-amber/20 text-signal-amber",
  Appliances: "bg-signal-green/20 text-signal-green",
  Exterior: "bg-signal-purple/20 text-signal-purple",
  Yard: "bg-signal-green/20 text-signal-green",
  Vehicle: "bg-signal-pink/20 text-signal-pink",
  Other: "bg-slate-500/20 text-slate-400",
};

export default function HomePage() {
  const ok = maintenance.filter((m) => m.status === "ok").length;
  const soon = maintenance.filter((m) => m.status === "due-soon").length;
  const overdue = maintenance.filter((m) => m.status === "overdue").length;
  const annualCost = maintenance.reduce((sum, m) => sum + (m.lastCost ?? 0), 0);

  // Sort: overdue → due-soon → ok
  const sorted = [...maintenance].sort((a, b) => {
    const order = { overdue: 0, "due-soon": 1, "in-progress": 2, ok: 3 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={maintenance.length} label="Tracked Items" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={soon} label="Due Soon" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={overdue} label="Overdue" tone="red" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={formatMoney(annualCost)} label="Lifetime Spend" tone="purple" /></div></Panel>
      </div>

      <Panel eyebrow="Systems" title="House health" action={<AgentBadge agent="home" size="md" />}>
        <div className="space-y-2">
          {sorted.map((m) => {
            const meta = STATUS_META[m.status];
            const Icon = meta.icon;
            const d = daysUntil(m.nextDue);
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-edge bg-ink-900/30 px-4 py-3 transition hover:bg-ink-900/60">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${SYSTEM_COLORS[m.system] ?? SYSTEM_COLORS.Other}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-100">{m.item}</span>
                      <span className="pill-ghost">{m.system}</span>
                      <span className={meta.pillClass}>{meta.label}</span>
                    </div>
                    {m.notes && <div className="mt-0.5 text-[11px] text-slate-500">{m.notes}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right text-[11px]">
                  <div>
                    <div className="text-slate-500">Frequency</div>
                    <div className="font-medium capitalize text-slate-200">{m.frequency}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Vendor</div>
                    <div className="font-medium text-slate-200">{m.vendor ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Last cost</div>
                    <div className="font-mono text-slate-200">{m.lastCost ? formatMoney(m.lastCost) : "—"}</div>
                  </div>
                  <div className="min-w-[80px]">
                    <div className="text-slate-500">Next due</div>
                    <div className={d < 0 ? "font-mono text-signal-red" : "font-mono text-slate-200"}>
                      {d < 0 ? `${-d}d ago` : relativeDay(m.nextDue)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Vendor book" title="Trusted providers">
          <ul className="space-y-2">
            {[
              { name: "Fixd Appliance", specialty: "Dishwashers, fridges",   last: "2024-05-02", rating: 4.5 },
              { name: "ClearGutter",    specialty: "Gutters, exterior wash", last: "2024-11-18", rating: 5.0 },
              { name: "GreenScape",     specialty: "Lawn + landscaping",     last: "2024-10-10", rating: 4.8 },
              { name: "Valvoline",      specialty: "Quick-service auto",     last: "2025-02-01", rating: 4.2 },
            ].map((v, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-edge bg-ink-900/30 p-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">{v.name}</div>
                  <div className="text-[11px] text-slate-500">{v.specialty} · last: {v.last}</div>
                </div>
                <span className="pill-amber">★ {v.rating}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel eyebrow="Home Agent insight" title="Proactive recommendations">
          <ul className="space-y-3 text-sm">
            <li className="rounded-md border border-signal-amber/20 bg-signal-amber/5 p-3">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-signal-amber" />
                <span className="text-xs font-semibold uppercase tracking-wider text-signal-amber">Action recommended</span>
              </div>
              <div className="text-slate-200">Refrigerator coils are 40 days overdue for cleaning. Estimated 5-8% efficiency loss.</div>
              <div className="mt-1 text-xs text-slate-400">Self-service · 20 min · $0. Want me to block time Saturday?</div>
            </li>
            <li className="rounded-md border border-edge bg-ink-900/30 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Wrench className="h-3.5 w-3.5 text-signal-blue" />
                <span className="text-xs font-semibold uppercase tracking-wider text-signal-blue">Bundling opportunity</span>
              </div>
              <div className="text-slate-200">Gutter cleaning (30d) and lawn aeration (21d) could both be scheduled when GreenScape is out.</div>
              <div className="mt-1 text-xs text-slate-400">Potential savings: $40 trip fee.</div>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
