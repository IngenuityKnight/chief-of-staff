// Payday scheduler — runs on household payday cadence
// Callable via POST /api/jobs/payday or n8n workflow
//
// For each household with an active payday_settings, on the scheduled date:
// 1. Query approved but unpaid gigs since last payday
// 2. Group by member, sum bounties
// 3. Emit a payday_disbursement Proposal per member
// 4. Proposal goes through policy gate (always asks by default)

import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { PaydayDisbursementPayload } from "@/lib/server/agents/schemas";

export interface PaydayRunResult {
  householdId: string;
  memberId: string;
  gigCount: number;
  totalCents: number;
  proposalId?: string;
  error?: string;
}

export async function runPaydayForHousehold(householdId: string): Promise<PaydayRunResult[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const results: PaydayRunResult[] = [];

  // 1. Get payday_settings for this household
  const { data: settings } = await supabase
    .from("payday_settings")
    .select("*")
    .eq("household_id", householdId)
    .eq("active", true)
    .maybeSingle();

  if (!settings) {
    return results; // No active payday for this household
  }

  const now = new Date();

  // 2. Get all approved gigs not yet linked to a payday_run (unpaid this period)
  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, claimed_by, title, bounty_cents")
    .eq("household_id", householdId)
    .eq("status", "approved")
    .is("payday_run_id", null);

  if (!gigs || gigs.length === 0) {
    return results; // No gigs to pay
  }

  // 3. Group by member
  const byMember = new Map<
    string,
    {
      gigs: Array<{ id: string; title: string; bounty_cents: number }>;
      totalCents: number;
    }
  >();

  for (const gig of gigs as Array<{
    id: string;
    claimed_by?: string;
    title: string;
    bounty_cents: number;
  }>) {
    if (!gig.claimed_by) continue; // Only count gigs that were claimed

    const m = byMember.get(gig.claimed_by) ?? { gigs: [], totalCents: 0 };
    m.gigs.push({ id: gig.id, title: gig.title, bounty_cents: gig.bounty_cents });
    m.totalCents += gig.bounty_cents;
    byMember.set(gig.claimed_by, m);
  }

  // 4. Get household rules for split percentages (default 30% save, 70% spend)
  const { data: rules } = await supabase
    .from("rules")
    .select("id, title, description")
    .eq("household_id", householdId)
    .eq("category", "economy")
    .ilike("title", "%split%");

  // Parse split percentages from rule description (naive; real parsing TBD)
  // For now, use defaults
  const defaultSplits = [
    { bucketType: "save" as const, percentOfTotal: 30 },
    { bucketType: "spend" as const, percentOfTotal: 70 },
  ];

  // 5. For each member, create a payday_disbursement proposal
  for (const [memberId, { gigs: memberGigs, totalCents }] of byMember) {
    const payload: PaydayDisbursementPayload = {
      memberId,
      gigIds: memberGigs.map((g) => g.id),
      totalCents,
      paydayRunId: "", // Will be filled by executor
      splits: defaultSplits.map((split) => ({
        ...split,
        amountCents: Math.round((totalCents * split.percentOfTotal) / 100),
      })),
    };

    // Create proposal
    const { data: proposal, error } = await supabase
      .from("proposals")
      .insert({
        id: crypto.randomUUID(),
        household_id: householdId,
        inbox_item_id: null,
        agent: "economy",
        kind: "payday_disbursement",
        title: `Payday: ${memberGigs.length} gig(s), ${formatCents(totalCents)} owed`,
        rationale: memberGigs.map((g) => g.title).join(", "),
        payload,
        estimated_cost_cents: totalCents,
        rules_consulted: (rules ?? []).map((r) => r.id),
        rules_conflicts: [],
        status: "awaiting_approval",
        created_at: now.toISOString(),
      })
      .select("id")
      .maybeSingle();

    results.push({
      householdId,
      memberId,
      gigCount: memberGigs.length,
      totalCents,
      proposalId: proposal?.id,
      error: error?.message,
    });
  }

  // 6. Update payday_settings.next_run_at (move to next scheduled date)
  const nextRun = calculateNextPayday(settings.frequency, settings.anchor_day);
  await supabase
    .from("payday_settings")
    .update({ next_run_at: nextRun.toISOString() })
    .eq("household_id", householdId);

  return results;
}

export async function runPaydayForAllHouseholds(): Promise<
  Array<{ householdId: string; results: PaydayRunResult[] }>
> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const results: Array<{ householdId: string; results: PaydayRunResult[] }> = [];
  const now = new Date();

  // Get all households with active payday settings due today or overdue
  const { data: households } = await supabase
    .from("payday_settings")
    .select("household_id, next_run_at")
    .eq("active", true)
    .lte("next_run_at", now.toISOString())
    .select("household_id");

  if (!households) return results;

  const householdIds = Array.from(new Set((households as Array<any>).map((h) => h.household_id)));

  for (const householdId of householdIds) {
    const paydayResults = await runPaydayForHousehold(householdId);
    results.push({ householdId, results: paydayResults });
  }

  return results;
}

function calculateNextPayday(frequency: string, anchorDay: string): Date {
  const now = new Date();
  const dayOfWeek = getDayOfWeekNumber(anchorDay); // 0 = Mon, 6 = Sun

  if (frequency === "weekly") {
    // Next occurrence of anchorDay
    const today = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const todayMondayBased = today === 0 ? 6 : today - 1;
    let daysUntil = dayOfWeek - todayMondayBased;
    if (daysUntil <= 0) daysUntil += 7;
    const next = new Date(now);
    next.setDate(next.getDate() + daysUntil);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  if (frequency === "biweekly") {
    // Assumes a reference date exists in the household context; for now, default to 2 weeks
    const next = new Date(now);
    next.setDate(next.getDate() + 14);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  return now; // Fallback
}

function getDayOfWeekNumber(dayName: string): number {
  const days: Record<string, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };
  return days[dayName.toLowerCase()] ?? 0;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
