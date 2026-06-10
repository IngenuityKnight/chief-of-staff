import { Zap, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatMoney, relativeDay, daysUntil } from "@/lib/utils";
import { getAppliances } from "@/lib/server/data";
import { getAdminFields } from "@/lib/server/admin";
import { InlineForm } from "@/components/inline-form";
import { EditInline } from "@/components/edit-inline";
import type { AdminField } from "@/lib/server/admin";
import type { Appliance } from "@/lib/types";

function ageYears(d: string | undefined): number | null {
  if (!d) return null;
  return (Date.now() - new Date(d).getTime()) / (365.25 * 86_400_000);
}

type Status = "new" | "good" | "aging" | "replace";
function getStatus(a: Appliance): Status {
  const age = ageYears(a.purchaseDate);
  const life = a.estLifespanYears;
  if (!age || !life) return "good";
  const pct = age / life;
  if (pct < 0.3) return "new";
  if (pct < 0.6) return "good";
  if (pct < 0.85) return "aging";
  return "replace";
}

const STATUS_COLOR: Record<Status, string> = {
  new:     "text-signal-green",
  good:    "text-signal-blue",
  aging:   "text-signal-amber",
  replace: "text-signal-red",
};
const STATUS_BAR: Record<Status, string> = {
  new:     "bg-signal-green",
  good:    "bg-signal-blue",
  aging:   "bg-signal-amber",
  replace: "bg-signal-red",
};

function ApplianceCard({ appliance, fields }: { appliance: Appliance; fields: AdminField[] }) {
  const status       = getStatus(appliance);
  const age          = ageYears(appliance.purchaseDate);
  const warrantyDays = appliance.warrantyExpires ? daysUntil(appliance.warrantyExpires) : null;
  const warrantyAlert = warrantyDays !== null && warrantyDays <= 30;
  const pct = age && appliance.estLifespanYears ? Math.min(1, age / appliance.estLifespanYears) : null;

  return (
    <div className={`rounded-xl border ${warrantyAlert || status === "replace" ? "border-signal-amber/30" : "border-edge"} bg-ink-900/30 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid h-9 w-9 place-items-center rounded-lg ${warrantyAlert ? "bg-signal-amber/10 text-signal-amber" : "bg-ink-800 text-slate-400"}`}>
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-slate-100">{appliance.name}</div>
            <div className="text-[11px] text-slate-500">
              {appliance.brand && `${appliance.brand} · `}
              {appliance.location ?? ""}
            </div>
          </div>
        </div>
        <EditInline resource="appliances" id={appliance.id} fields={fields}
          values={{
            name: appliance.name, brand: appliance.brand ?? "", modelNumber: appliance.modelNumber ?? "",
            location: appliance.location ?? "", purchaseDate: appliance.purchaseDate ?? "",
            purchasePrice: appliance.purchasePrice ?? "", warrantyExpires: appliance.warrantyExpires ?? "",
            lastServiced: appliance.lastServiced ?? "", estLifespanYears: appliance.estLifespanYears ?? "",
            notes: appliance.notes ?? "",
          }}
          label={`Edit ${appliance.name}`} />
      </div>

      <div className="mt-3 space-y-2">
        {pct !== null && (
          <div>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-slate-500">Age vs lifespan</span>
              <span className={STATUS_COLOR[status]}>
                {age!.toFixed(1)} / {appliance.estLifespanYears} yr
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div className={`h-full rounded-full ${STATUS_BAR[status]}`} style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {appliance.warrantyExpires && (
            <div className={`flex items-center gap-1 ${warrantyAlert ? "text-signal-amber" : "text-slate-500"}`}>
              {warrantyAlert ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              <span>Warranty {warrantyDays !== null && warrantyDays < 0 ? "expired" : `expires ${relativeDay(appliance.warrantyExpires)}`}</span>
            </div>
          )}
          {appliance.purchasePrice && (
            <span className="text-slate-500">Paid {formatMoney(appliance.purchasePrice)}</span>
          )}
          {status === "replace" && (
            <span className="font-semibold text-signal-red">Consider replacing</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function AppliancesPage() {
  const [appliances, fields] = await Promise.all([
    getAppliances(),
    Promise.resolve(getAdminFields("appliances")),
  ]);

  const alerts = appliances.filter((a) => {
    const wd = a.warrantyExpires ? daysUntil(a.warrantyExpires) : null;
    return (wd !== null && wd <= 30) || getStatus(a) === "replace";
  });

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Appliances</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {appliances.length} tracked
            {alerts.length > 0 && (
              <span className="ml-2 font-semibold text-signal-amber">{alerts.length} need attention</span>
            )}
            {alerts.length === 0 && appliances.length > 0 && (
              <span className="ml-2 font-semibold text-signal-green">all good</span>
            )}
          </p>
        </div>
        {alerts.length === 0 && appliances.length > 0
          ? <CheckCircle2 className="h-5 w-5 text-signal-green/60" />
          : alerts.length > 0 && <AlertTriangle className="h-5 w-5 text-signal-amber/60" />}
      </div>

      {appliances.length === 0 ? (
        <div className="rounded-xl border border-edge bg-ink-900/20 px-5 py-12 text-center">
          <Zap className="mx-auto h-6 w-6 text-slate-600" />
          <div className="mt-2 text-sm text-slate-500">No appliances tracked yet.</div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {appliances.map((a) => <ApplianceCard key={a.id} appliance={a} fields={fields} />)}
        </div>
      )}

      <InlineForm resource="appliances" fields={fields} label="Add appliance" />
    </div>
  );
}
