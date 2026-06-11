// Scanner: bills_due
// Daily 06:00 — emits an inbox item for each unpaid bill due within 5 days
// that hasn't already triggered an alert today.

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { persistIntake, createProposalsFromIntake } from "@/lib/server/intake";
import { hasRecentScannerItem, buildScannerAnalysis, type ScannerResult } from "./scanner-utils";

const LEAD_DAYS = 5;

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export async function runBillsDue(): Promise<ScannerResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { scanner: "bills_due", itemsFound: 0, itemsEmitted: 0, proposalsCreated: 0 };

  const now = new Date();
  const cutoff = new Date(now.getTime() + LEAD_DAYS * 86_400_000).toISOString();

  const { data: bills } = await supabase
    .from("bills")
    .select("id, name, amount, due_date, autopay, category")
    .lte("due_date", cutoff)
    .gte("due_date", now.toISOString().slice(0, 10))
    .in("status", ["due", "overdue"]);

  if (!bills?.length) return { scanner: "bills_due", itemsFound: 0, itemsEmitted: 0, proposalsCreated: 0 };

  let emitted = 0;
  let proposals = 0;

  for (const bill of bills as Array<Record<string, unknown>>) {
    const key = `scanner:bills_due:${bill.id as string}`;
    if (await hasRecentScannerItem(supabase, key, 24)) continue;

    const dueDate = new Date(bill.due_date as string);
    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000);
    const autopay = Boolean(bill.autopay);
    const name = bill.name as string;
    const amount = Number(bill.amount);

    const text = autopay
      ? `${name} autopays in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} (${fmt(amount)}) — no action needed, just a heads-up.`
      : `${name} is due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} (${fmt(amount)}) and needs manual payment.`;

    const analysis = buildScannerAnalysis({
      text,
      primary: "money",
      urgency: daysUntil <= 2 ? "high" : "medium",
      analysis: autopay
        ? `${name} will be charged automatically on ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Review if amount looks off.`
        : `${name} requires manual payment by ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — autopay is off.`,
      proposedTasks: autopay ? [] : [`Pay ${name} — ${fmt(amount)}`],
    });

    const persistence = await persistIntake(analysis, { origin: "scanner", rawInputOverride: key });
    if (!persistence.persisted) continue;

    const created = await createProposalsFromIntake(analysis);
    emitted++;
    proposals += created.length;
  }

  return { scanner: "bills_due", itemsFound: bills.length, itemsEmitted: emitted, proposalsCreated: proposals };
}
