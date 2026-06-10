import { AgentBadge } from "@/components/ui";
import { formatMoney, relativeDay, daysUntil } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Wrench, Clock } from "lucide-react";
import { getMaintenanceItems } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { EditInline } from "@/components/edit-inline";

const BORDER: Record<string, string> = {
  overdue:     "border-l-signal-red",
  "due-soon":  "border-l-signal-amber",
  "in-progress":"border-l-signal-blue",
  ok:          "border-l-edge",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  ok:           CheckCircle2,
  "due-soon":   Clock,
  overdue:      AlertTriangle,
  "in-progress":Wrench,
};

const STATUS_COLOR: Record<string, string> = {
  ok:           "text-signal-green",
  "due-soon":   "text-signal-amber",
  overdue:      "text-signal-red",
  "in-progress":"text-signal-blue",
};

export default async function HomePage() {
  const [maintenance, fields] = await Promise.all([
    getMaintenanceItems(),
    Promise.resolve(getAdminFields("maintenance")),
  ]);

  const alerts  = maintenance.filter((m) => m.status === "overdue" || m.status === "due-soon");
  const active  = maintenance.filter((m) => m.status === "in-progress");
  const ok      = maintenance.filter((m) => m.status === "ok");

  const sorted = [...maintenance].sort((a, b) => {
    const r = { overdue: 0, "due-soon": 1, "in-progress": 2, ok: 3 };
    return r[a.status] - r[b.status];
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">

      {/* Header */}
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">House Health</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {maintenance.length} items tracked
            {alerts.length > 0 && (
              <span className="ml-2 font-semibold text-signal-amber">{alerts.length} need attention</span>
            )}
            {alerts.length === 0 && (
              <span className="ml-2 font-semibold text-signal-green">all systems OK</span>
            )}
          </p>
        </div>
        <AgentBadge agent="home" size="md" />
      </div>

      {/* All clear */}
      {alerts.length === 0 && active.length === 0 && (
        <div className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-8 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-signal-green/60" />
          <div className="mt-2 text-sm font-semibold text-signal-green">All systems nominal</div>
          <div className="mt-1 text-xs text-slate-500">{ok.length} items on schedule.</div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {sorted.map((m) => {
          const d  = daysUntil(m.nextDue);
          const Icon = STATUS_ICON[m.status];
          return (
            <div
              key={m.id}
              className={`flex items-center gap-4 rounded-xl border border-edge border-l-[3px] px-4 py-3.5 transition hover:bg-ink-900/40 ${BORDER[m.status]} ${m.status === "ok" ? "opacity-70" : ""}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${STATUS_COLOR[m.status]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100">{m.item}</span>
                  <span className="text-[11px] text-slate-600">{m.system}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  {m.vendor && <span>{m.vendor}</span>}
                  {m.lastCost ? <span>{formatMoney(m.lastCost)}</span> : null}
                  {m.notes && <span className="italic">{m.notes}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-sm font-medium ${STATUS_COLOR[m.status]}`}>
                  {d !== null && d < 0 ? `${-d}d overdue` : relativeDay(m.nextDue)}
                </div>
                <div className="text-[11px] text-slate-600 capitalize">{m.frequency}</div>
              </div>
              <EditInline
                resource="maintenance" id={m.id} fields={fields}
                values={{
                  item: m.item, system: m.system, frequency: m.frequency,
                  status: m.status, vendor: m.vendor ?? "", lastCost: m.lastCost ?? "",
                  lastDone: m.lastDone, nextDue: m.nextDue, notes: m.notes ?? "",
                }}
                label={`Edit ${m.item}`}
              />
            </div>
          );
        })}
      </div>

      <InlineForm
        resource="maintenance" fields={fields}
        defaults={{ status: "ok", frequency: "annual" }}
        label="Add maintenance item"
      />
    </div>
  );
}
