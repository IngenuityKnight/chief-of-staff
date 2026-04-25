import { ArrowRight, Clock, DollarSign, HelpCircle } from "lucide-react";
import { EditInline } from "@/components/edit-inline";
import { InlineForm } from "@/components/inline-form";
import { Panel, Stat } from "@/components/ui";
import { PRIORITY } from "@/lib/agents";
import { getAdminFields } from "@/lib/server/admin";
import { getDecisions } from "@/lib/server/data";
import { formatMoney, relativeDay } from "@/lib/utils";

const STATUS_META = {
  open: { label: "Open", pillClass: "pill-blue" },
  approved: { label: "Approved", pillClass: "pill-green" },
  deferred: { label: "Deferred", pillClass: "pill-amber" },
  dismissed: { label: "Dismissed", pillClass: "pill-ghost" },
};

export default async function DecisionsPage() {
  const [decisions, fields] = await Promise.all([
    getDecisions(),
    Promise.resolve(getAdminFields("decisions")),
  ]);

  const open = decisions.filter((decision) => decision.status === "open");
  const urgent = open.filter((decision) => decision.priority === "critical" || decision.priority === "high");
  const dueSoon = open.filter((decision) => {
    if (!decision.dueDate) return false;
    return new Date(decision.dueDate).getTime() <= Date.now() + 3 * 86_400_000;
  });
  const savings = open.reduce((sum, decision) => sum + (decision.costEstimate ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={open.length} label="Open Decisions" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={urgent.length} label="High Impact" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={dueSoon.length} label="Due ≤3d" tone="red" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={savings > 0 ? formatMoney(savings) : "—"} label="Money in Play" tone="green" /></div></Panel>
      </div>

      <Panel
        eyebrow="Decision Queue"
        title="Choices Waiting On You"
        action={<span className="text-xs text-slate-500">Approve, defer, or dismiss from the edit control</span>}
      >
        <div className="space-y-3">
          {open.map((decision) => (
            <div key={decision.id} className="rounded-lg border border-edge bg-ink-900/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-white">{decision.title}</h3>
                    <span className={STATUS_META[decision.status].pillClass}>{STATUS_META[decision.status].label}</span>
                    <span className={PRIORITY[decision.priority].pillClass}>{PRIORITY[decision.priority].label}</span>
                  </div>
                  {decision.context && <p className="mt-2 text-sm text-slate-400">{decision.context}</p>}
                </div>
                <EditInline
                  resource="decisions"
                  id={decision.id}
                  fields={fields}
                  values={{
                    title: decision.title,
                    context: decision.context ?? "",
                    status: decision.status,
                    priority: decision.priority,
                    category: decision.category,
                    recommendation: decision.recommendation ?? "",
                    options: decision.options,
                    costEstimate: decision.costEstimate ?? "",
                    timeEstimateMinutes: decision.timeEstimateMinutes ?? "",
                    dueDate: decision.dueDate ?? "",
                  }}
                  label={`Edit ${decision.title}`}
                />
              </div>

              {decision.recommendation && (
                <div className="mt-3 rounded-md border border-signal-green/20 bg-signal-green/5 px-3 py-2 text-sm text-slate-200">
                  <span className="font-semibold text-signal-green">Recommendation: </span>
                  {decision.recommendation}
                </div>
              )}

              {decision.options.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {decision.options.map((option) => (
                    <div key={option} className="flex items-start gap-2 rounded-md border border-edge bg-ink-950/50 px-3 py-2 text-sm text-slate-300">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <span>{option}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{decision.category}</span>
                {decision.dueDate && (
                  <span><Clock className="mr-1 inline h-3 w-3" />{relativeDay(decision.dueDate)}</span>
                )}
                {decision.costEstimate !== undefined && (
                  <span><DollarSign className="mr-1 inline h-3 w-3" />{formatMoney(decision.costEstimate)} in play</span>
                )}
                {decision.timeEstimateMinutes !== undefined && (
                  <span>{decision.timeEstimateMinutes} min estimate</span>
                )}
              </div>
            </div>
          ))}

          {open.length === 0 && (
            <div className="grid place-items-center rounded-lg border border-dashed border-edge px-6 py-12 text-center">
              <HelpCircle className="mb-2 h-6 w-6 text-slate-600" />
              <div className="text-sm text-slate-400">No open decisions. Captures that need a choice will land here.</div>
            </div>
          )}
        </div>

        <InlineForm
          resource="decisions"
          fields={fields}
          defaults={{ status: "open", priority: "medium", category: "Admin", options: "[]" }}
          label="Add decision"
        />
      </Panel>

      {decisions.some((decision) => decision.status !== "open") && (
        <Panel eyebrow="Archive" title="Resolved Decisions">
          <ul className="divide-y divide-edge/60">
            {decisions
              .filter((decision) => decision.status !== "open")
              .map((decision) => (
                <li key={decision.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-200">{decision.title}</div>
                    {decision.recommendation && <div className="text-xs text-slate-500">{decision.recommendation}</div>}
                  </div>
                  <span className={STATUS_META[decision.status].pillClass}>{STATUS_META[decision.status].label}</span>
                </li>
              ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
