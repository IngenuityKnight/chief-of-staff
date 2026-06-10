import { HelpCircle, Clock, DollarSign, CheckCircle2 } from "lucide-react";
import { EditInline } from "@/components/edit-inline";
import { InlineForm } from "@/components/inline-form";
import { ResolveDecision } from "@/components/resolve-decision";
import { PRIORITY } from "@/lib/agents";
import { getAdminFields } from "@/lib/server/admin";
import { getDecisions } from "@/lib/server/data";
import { formatMoney, relativeDay } from "@/lib/utils";

const STATUS_BORDER: Record<string, string> = {
  open:      "border-l-signal-blue",
  approved:  "border-l-signal-green",
  deferred:  "border-l-signal-amber",
  dismissed: "border-l-edge",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open", approved: "Approved", deferred: "Deferred", dismissed: "Dismissed",
};

export default async function DecisionsPage() {
  const [decisions, fields] = await Promise.all([
    getDecisions(),
    Promise.resolve(getAdminFields("decisions")),
  ]);

  const open     = decisions.filter((d) => d.status === "open");
  const resolved = decisions.filter((d) => d.status !== "open");

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">

      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Decisions</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {open.length} open{open.length !== 1 ? "" : ""}
            {open.length === 0 && <span className="ml-2 font-semibold text-signal-green">all resolved</span>}
          </p>
        </div>
      </div>

      {open.length === 0 ? (
        <div className="rounded-xl border border-signal-green/20 bg-signal-green/5 px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-signal-green/60" />
          <div className="mt-2 text-sm font-semibold text-signal-green">No open decisions</div>
          <div className="mt-1 text-xs text-slate-500">Captures that need a choice will land here.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {open.map((d) => (
            <div key={d.id} className={`rounded-xl border border-edge border-l-[3px] bg-ink-900/30 p-4 ${STATUS_BORDER[d.status]}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={PRIORITY[d.priority].pillClass}>{d.priority}</span>
                    <span className="text-[11px] text-slate-500">{d.category}</span>
                  </div>
                  <h3 className="mt-1.5 text-base font-semibold text-slate-100">{d.title}</h3>
                  {d.context && <p className="mt-1 text-sm text-slate-400">{d.context}</p>}
                </div>
                <EditInline resource="decisions" id={d.id} fields={fields}
                  values={{
                    title: d.title, context: d.context ?? "", status: d.status,
                    priority: d.priority, category: d.category, recommendation: d.recommendation ?? "",
                    options: d.options, costEstimate: d.costEstimate ?? "",
                    timeEstimateMinutes: d.timeEstimateMinutes ?? "", dueDate: d.dueDate ?? "",
                  }}
                  label={`Edit ${d.title}`} />
              </div>

              {d.recommendation && (
                <div className="mt-3 rounded-lg border border-signal-green/20 bg-signal-green/5 px-3 py-2 text-sm">
                  <span className="font-semibold text-signal-green">Rec: </span>
                  <span className="text-slate-200">{d.recommendation}</span>
                </div>
              )}

              {d.options.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.options.map((o) => (
                    <div key={o} className="rounded-lg border border-edge bg-ink-950/50 px-3 py-1.5 text-xs text-slate-300">{o}</div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                {d.dueDate && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{relativeDay(d.dueDate)}</span>
                )}
                {d.costEstimate !== undefined && (
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatMoney(d.costEstimate)}</span>
                )}
              </div>

              <ResolveDecision id={d.id} options={d.options} />
            </div>
          ))}
        </div>
      )}

      <InlineForm resource="decisions" fields={fields}
        defaults={{ status: "open", priority: "medium", category: "Admin", options: "[]" }}
        label="Add decision" />

      {resolved.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-edge/60" />
            <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-slate-600">Resolved · {resolved.length}</span>
            <div className="h-px flex-1 bg-edge/60" />
          </div>
          {resolved.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-edge/50 bg-ink-900/20 px-4 py-3 opacity-60">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-400">{d.title}</div>
                {d.chosenOption && <div className="text-[11px] text-signal-green">{d.chosenOption}</div>}
              </div>
              <span className="text-[11px] text-slate-500">{STATUS_LABEL[d.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
