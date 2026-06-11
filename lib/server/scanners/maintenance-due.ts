// Scanner: maintenance_due
// Daily 06:00 — emits an inbox item for each maintenance item whose next_due
// date falls within the lead window and hasn't been alerted today.

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { persistIntake, createProposalsFromIntake } from "@/lib/server/intake";
import { hasRecentScannerItem, buildScannerAnalysis, type ScannerResult } from "./scanner-utils";

// How many days ahead to alert for each frequency
const LEAD_WINDOWS: Record<string, number> = {
  monthly:    5,
  quarterly:  14,
  "semi-annual": 21,
  annual:     30,
  seasonal:   30,
};
const DEFAULT_LEAD = 14;

export async function runMaintenanceDue(): Promise<ScannerResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { scanner: "maintenance_due", itemsFound: 0, itemsEmitted: 0, proposalsCreated: 0 };

  const now = new Date();
  const maxLead = Math.max(...Object.values(LEAD_WINDOWS));
  const cutoff = new Date(now.getTime() + maxLead * 86_400_000).toISOString().slice(0, 10);

  const { data: items } = await supabase
    .from("maintenance_items")
    .select("id, item, system, frequency, next_due, vendor, last_cost")
    .lte("next_due", cutoff)
    .not("status", "eq", "in-progress");

  if (!items?.length) return { scanner: "maintenance_due", itemsFound: 0, itemsEmitted: 0, proposalsCreated: 0 };

  let emitted = 0;
  let proposals = 0;

  for (const item of items as Array<Record<string, unknown>>) {
    const frequency = (item.frequency as string) ?? "annual";
    const leadDays = LEAD_WINDOWS[frequency] ?? DEFAULT_LEAD;
    const nextDue = new Date(item.next_due as string);
    const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / 86_400_000);
    if (daysUntil > leadDays) continue;

    const key = `scanner:maintenance_due:${item.id as string}`;
    if (await hasRecentScannerItem(supabase, key, 24)) continue;

    const name = item.item as string;
    const system = item.system as string;
    const costHint = item.last_cost ? ` (last cost: $${Number(item.last_cost).toFixed(0)})` : "";
    const vendor = item.vendor ? ` — usual vendor: ${item.vendor as string}` : "";

    const text = `${name} (${system}) maintenance is due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}${costHint}${vendor}.`;

    const analysis = buildScannerAnalysis({
      text,
      primary: "home",
      urgency: daysUntil <= 3 ? "high" : "medium",
      analysis: `${name} ${frequency} maintenance coming up on ${nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Schedule before the due date.`,
      proposedTasks: [
        `Schedule ${name} maintenance`,
        item.vendor ? `Contact ${item.vendor as string} to book` : "Find and book a service provider",
      ],
    });

    const persistence = await persistIntake(analysis, { origin: "scanner", rawInputOverride: key });
    if (!persistence.persisted) continue;

    const created = await createProposalsFromIntake(analysis);
    emitted++;
    proposals += created.length;
  }

  return { scanner: "maintenance_due", itemsFound: items.length, itemsEmitted: emitted, proposalsCreated: proposals };
}
