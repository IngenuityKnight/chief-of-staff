// Scanner: budget_drift
// Monday 06:30 — for each spending category whose month-to-date pace exceeds
// 115% of its monthly budget allocation, emits a money alert.
// Dedup: once per week per category (168-hour window).

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { persistIntake, createProposalsFromIntake } from "@/lib/server/intake";
import { hasRecentScannerItem, buildScannerAnalysis, type ScannerResult } from "./scanner-utils";

const DRIFT_THRESHOLD = 1.15; // 115%

export async function runBudgetDrift(): Promise<ScannerResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { scanner: "budget_drift", itemsFound: 0, itemsEmitted: 0, proposalsCreated: 0 };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthFraction = dayOfMonth / daysInMonth;

  // Sum transactions by category this month
  const { data: txns } = await supabase
    .from("transactions")
    .select("category, amount")
    .gte("date", monthStart)
    .lt("amount", 0); // expenses are negative in Plaid convention

  if (!txns?.length) return { scanner: "budget_drift", itemsFound: 0, itemsEmitted: 0, proposalsCreated: 0 };

  // Aggregate spend per category (absolute values)
  const spendByCategory: Record<string, number> = {};
  for (const txn of txns as Array<{ category: string; amount: number }>) {
    const cat = txn.category ?? "Other";
    spendByCategory[cat] = (spendByCategory[cat] ?? 0) + Math.abs(txn.amount);
  }

  // Get household budget
  const { data: ctxRow } = await supabase
    .from("household_context")
    .select("budget_monthly, preferences")
    .eq("id", "default")
    .maybeSingle();

  const monthlyBudget = Number((ctxRow as Record<string, unknown> | null)?.budget_monthly ?? 0);
  if (!monthlyBudget) return { scanner: "budget_drift", itemsFound: Object.keys(spendByCategory).length, itemsEmitted: 0, proposalsCreated: 0 };

  // Simple even split across categories (real version would use per-category budgets)
  const categoryCount = Object.keys(spendByCategory).length || 1;
  const budgetPerCategory = monthlyBudget / categoryCount;
  const expectedByNow = budgetPerCategory * monthFraction;

  let emitted = 0;
  let proposals = 0;

  for (const [category, spent] of Object.entries(spendByCategory)) {
    const pace = spent / expectedByNow;
    if (pace < DRIFT_THRESHOLD) continue;

    const key = `scanner:budget_drift:${category}`;
    if (await hasRecentScannerItem(supabase, key, 168)) continue;

    const overage = Math.round((pace - 1) * 100);
    const projected = Math.round(spent / monthFraction);
    const text = `${category} spending is running ${overage}% over pace — $${spent.toFixed(0)} spent so far vs $${expectedByNow.toFixed(0)} expected (projected month-end: $${projected}).`;

    const analysis = buildScannerAnalysis({
      text,
      primary: "money",
      urgency: overage > 30 ? "high" : "medium",
      analysis: `${category} spending at ${overage}% above budget pace. Review recent transactions and identify where to pull back.`,
      proposedTasks: [
        `Review ${category} transactions this month`,
        `Identify 1-2 expenses to cut or defer`,
      ],
    });

    const persistence = await persistIntake(analysis, { origin: "scanner", rawInputOverride: key });
    if (!persistence.persisted) continue;

    const created = await createProposalsFromIntake(analysis);
    emitted++;
    proposals += created.length;
  }

  return { scanner: "budget_drift", itemsFound: Object.keys(spendByCategory).length, itemsEmitted: emitted, proposalsCreated: proposals };
}
