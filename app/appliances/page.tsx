import { Zap, AlertTriangle, ShieldCheck, Clock, DollarSign, Wrench } from "lucide-react";
import { Panel, Stat } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { getAppliances } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import type { Appliance } from "@/lib/types";

function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function ageYears(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / (365.25 * 86_400_000);
}

type ApplianceStatus = "new" | "good" | "aging" | "replace-soon" | "unknown";

function getApplianceStatus(appliance: Appliance): ApplianceStatus {
  const age = ageYears(appliance.purchaseDate);
  const lifespan = appliance.estLifespanYears;
  if (!age || !lifespan) return "unknown";
  const pct = age / lifespan;
  if (pct < 0.3) return "new";
  if (pct < 0.6) return "good";
  if (pct < 0.85) return "aging";
  return "replace-soon";
}

const STATUS_META: Record<ApplianceStatus, { label: string; pillClass: string; barColor: string }> = {
  "new":          { label: "New",          pillClass: "pill-green", barColor: "bg-signal-green" },
  "good":         { label: "Good",         pillClass: "pill-blue",  barColor: "bg-signal-blue" },
  "aging":        { label: "Aging",        pillClass: "pill-amber", barColor: "bg-signal-amber" },
  "replace-soon": { label: "Replace Soon", pillClass: "pill-red",   barColor: "bg-signal-red" },
  "unknown":      { label: "Unknown",      pillClass: "pill-ghost", barColor: "bg-slate-600" },
};

function AgeBar({ appliance }: { appliance: Appliance }) {
  const age = ageYears(appliance.purchaseDate);
  const lifespan = appliance.estLifespanYears;
  if (!age || !lifespan) return null;
  const pct = Math.min(1, age / lifespan);
  const status = getApplianceStatus(appliance);
  const meta = STATUS_META[status];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Age vs lifespan</span>
        <span className="font-mono text-slate-400">
          {age.toFixed(1)} / {lifespan} yrs ({Math.round(pct * 100)}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-full rounded-full transition-all ${meta.barColor}`}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  );
}

function RepairReplaceAdvisor({ appliance }: { appliance: Appliance }) {
  const status = getApplianceStatus(appliance);
  if (status !== "replace-soon" && status !== "aging") return null;

  const replacementCost = appliance.purchasePrice;
  const age = ageYears(appliance.purchaseDate);
  const lifespan = appliance.estLifespanYears;

  if (!replacementCost || !age || !lifespan) return null;

  // Rule of thumb: if repair cost > 50% of replacement and age > 75% of lifespan, replace
  const threshold = replacementCost * 0.5;

  return (
    <div className="rounded-lg border border-signal-amber/20 bg-signal-amber/5 p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-signal-amber" />
        <span className="text-xs font-semibold text-signal-amber">Repair vs. Replace</span>
      </div>
      <p className="text-xs text-slate-300">
        At {age.toFixed(1)} yrs old ({Math.round((age / lifespan) * 100)}% of lifespan), repair jobs over{" "}
        <span className="font-mono font-medium text-signal-amber">{formatMoney(threshold)}</span> should
        be weighed against a new unit (~{formatMoney(replacementCost)}).
      </p>
    </div>
  );
}

function ApplianceCard({ appliance }: { appliance: Appliance }) {
  const status = getApplianceStatus(appliance);
  const meta = STATUS_META[status];
  const warrantyDays = daysUntil(appliance.warrantyExpires);
  const warrantyExpired = warrantyDays !== null && warrantyDays < 0;
  const warrantyExpiringSoon = warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= 60;

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${
      status === "replace-soon"
        ? "border-signal-red/30 bg-signal-red/5"
        : status === "aging"
          ? "border-signal-amber/20 bg-signal-amber/5"
          : "border-edge bg-ink-900/30"
    }`}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
          status === "replace-soon" ? "bg-signal-red/20" :
          status === "aging" ? "bg-signal-amber/20" :
          "bg-signal-green/20"
        }`}>
          <Zap className={`h-6 w-6 ${
            status === "replace-soon" ? "text-signal-red" :
            status === "aging" ? "text-signal-amber" :
            "text-signal-green"
          }`} />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-white">{appliance.name}</h3>
            <span className={meta.pillClass}>{meta.label}</span>
            {appliance.location && <span className="pill-ghost">{appliance.location}</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
            {appliance.brand && <span>{appliance.brand}</span>}
            {appliance.modelNumber && <span className="font-mono">{appliance.modelNumber}</span>}
            {appliance.purchaseDate && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Purchased {new Date(appliance.purchaseDate).getFullYear()}
              </span>
            )}
            {appliance.purchasePrice && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatMoney(appliance.purchasePrice)}
              </span>
            )}
          </div>
        </div>
      </div>

      <AgeBar appliance={appliance} />

      {/* Warranty & service row */}
      <div className="flex flex-wrap gap-3">
        {appliance.warrantyExpires && (
          <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
            warrantyExpired
              ? "border-signal-red/30 bg-signal-red/10 text-signal-red"
              : warrantyExpiringSoon
                ? "border-signal-amber/30 bg-signal-amber/10 text-signal-amber"
                : "border-signal-green/30 bg-signal-green/10 text-signal-green"
          }`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              Warranty: {warrantyExpired
                ? `expired ${Math.abs(warrantyDays!)}d ago`
                : warrantyDays === 0 ? "expires today"
                : `${warrantyDays}d left`}
            </span>
          </div>
        )}
        {appliance.lastServiced && (
          <div className="flex items-center gap-1.5 rounded-md border border-edge px-2.5 py-1.5 text-xs text-slate-400">
            <Wrench className="h-3.5 w-3.5" />
            Last serviced: {new Date(appliance.lastServiced).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </div>
        )}
      </div>

      <RepairReplaceAdvisor appliance={appliance} />

      {appliance.notes && (
        <p className="text-xs text-slate-500">{appliance.notes}</p>
      )}
    </div>
  );
}

export default async function AppliancesPage() {
  const [appliances, fields] = await Promise.all([
    getAppliances(),
    Promise.resolve(getAdminFields("appliances")),
  ]);

  const needsAttention = appliances.filter((a) => {
    const s = getApplianceStatus(a);
    return s === "replace-soon" || s === "aging";
  }).length;

  const totalValue = appliances.reduce((sum, a) => sum + (a.purchasePrice ?? 0), 0);

  const warrantyExpiringSoon = appliances.filter((a) => {
    const d = daysUntil(a.warrantyExpires);
    return d !== null && d >= 0 && d <= 60;
  }).length;

  // Sort: replace-soon → aging → good → new → unknown
  const sorted = [...appliances].sort((a, b) => {
    const order: Record<ApplianceStatus, number> = { "replace-soon": 0, aging: 1, good: 2, new: 3, unknown: 4 };
    return order[getApplianceStatus(a)] - order[getApplianceStatus(b)];
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={appliances.length} label="Appliances" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={needsAttention} label="Need Attention" tone="amber" /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={warrantyExpiringSoon} label="Warranty Expiring" tone={warrantyExpiringSoon > 0 ? "amber" : "green"} /></div></Panel>
        <Panel className="!px-0 !py-0"><div className="px-5 py-4"><Stat value={formatMoney(totalValue)} label="Est. Replacement Value" tone="purple" /></div></Panel>
      </div>

      {/* Cards */}
      <Panel
        eyebrow="Household Appliances"
        title="Tracked Equipment"
        action={
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-signal-green" />
            {appliances.length - needsAttention} in good shape
          </div>
        }
      >
        {appliances.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No appliances tracked yet. Add your first appliance below.
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((a) => <ApplianceCard key={a.id} appliance={a} />)}
          </div>
        )}
        <InlineForm
          resource="appliances"
          fields={fields}
          defaults={{ location: "kitchen" }}
          label="Add appliance"
        />
      </Panel>
    </div>
  );
}
