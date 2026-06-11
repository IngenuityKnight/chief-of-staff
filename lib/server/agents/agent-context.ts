// Cheap, indexed reads that build domain snapshots for specialist agents.
// These are text digests injected into LLM prompts — NOT full data fetches.

import { getSupabaseAdmin } from "@/lib/server/supabase";

export interface MealsDomainState {
  existingMealPlan: string;   // what's already planned this week
  shoppingItems: string;      // active grocery list
  lowStockFood: string;       // pantry items below minimum
  calendarDensity: string;    // how busy evenings are this week
}

export interface ScheduleDomainState {
  eveningCommitments: string; // evenings booked this week
  openSlots: string;          // 2-3h windows free in the next week
  conflicts: string;          // any double-booked or back-to-back stretches
}

export interface MoneyDomainState {
  upcomingBills: string;      // bills due next 14 days
  monthSpend: string;         // category leaders this month
  budgetHeadroom: string;     // remaining vs monthly budget
  activeSubscriptions: string;// recurring monthly debits
}

// Cross-domain digests — short text summaries other specialists can read
// without each specialist re-querying the database.
export interface SiblingDigests {
  meals?: string;
  schedule?: string;
  money?: string;
  home?: string;
  roster?: string;
}

export async function buildMealsDomainState(): Promise<MealsDomainState> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      existingMealPlan: "No meal plan on file.",
      shoppingItems: "Shopping list unavailable.",
      lowStockFood: "Pantry data unavailable.",
      calendarDensity: "Calendar unavailable.",
    };
  }

  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 86_400_000);
  const todayISO = today.toISOString().slice(0, 10);
  const nextWeekISO = nextWeek.toISOString().slice(0, 10);

  const [mealPlanResult, shoppingResult, inventoryResult, calendarResult] = await Promise.allSettled([
    supabase
      .from("meal_plan_days")
      .select("date, label, dinner, lunch")
      .gte("date", todayISO)
      .lte("date", nextWeekISO)
      .order("date"),
    supabase
      .from("shopping_list_items")
      .select("name, quantity, unit, category, status")
      .eq("status", "needed")
      .limit(20),
    supabase
      .from("inventory_items")
      .select("name, quantity, min_quantity, unit")
      .eq("category", "food")
      .filter("quantity", "lte", "min_quantity")
      .limit(10),
    supabase
      .from("calendar_events")
      .select("title, start_at, end_at")
      .gte("start_at", today.toISOString())
      .lte("start_at", nextWeek.toISOString())
      .order("start_at"),
  ]);

  // Meal plan
  let existingMealPlan = "No meals planned yet.";
  if (mealPlanResult.status === "fulfilled" && mealPlanResult.value.data?.length) {
    const days = mealPlanResult.value.data as Array<{
      date: string; label: string;
      dinner?: { name: string; kind: string };
      lunch?: { name: string; kind: string };
    }>;
    existingMealPlan = days
      .map((d) => {
        const parts: string[] = [d.label ?? d.date];
        if (d.dinner) parts.push(`dinner: ${d.dinner.name}`);
        if (d.lunch) parts.push(`lunch: ${d.lunch.name}`);
        return parts.join(" · ");
      })
      .join("\n");
  }

  // Shopping list
  let shoppingItems = "Shopping list is empty.";
  if (shoppingResult.status === "fulfilled" && shoppingResult.value.data?.length) {
    const items = shoppingResult.value.data as Array<{ name: string; quantity: number; unit: string }>;
    shoppingItems = items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(", ");
  }

  // Pantry low-stock
  let lowStockFood = "No low-stock food items.";
  if (inventoryResult.status === "fulfilled" && inventoryResult.value.data?.length) {
    const items = inventoryResult.value.data as Array<{ name: string; quantity: number; unit: string }>;
    lowStockFood = items.map((i) => `${i.name} (${i.quantity} ${i.unit} left)`).join(", ");
  }

  // Calendar density
  let calendarDensity = "Calendar appears clear this week.";
  if (calendarResult.status === "fulfilled" && calendarResult.value.data?.length) {
    const events = calendarResult.value.data as Array<{ title: string; start_at: string }>;
    const eveningEvents = events.filter((e) => {
      const hour = new Date(e.start_at).getHours();
      return hour >= 17;
    });
    calendarDensity = `${events.length} event(s) this week; ${eveningEvents.length} in the evenings.`;
    if (eveningEvents.length >= 3) calendarDensity += " Evenings are busy — favor simple dinners.";
  }

  return { existingMealPlan, shoppingItems, lowStockFood, calendarDensity };
}

export async function buildScheduleDomainState(householdId: string): Promise<ScheduleDomainState> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { eveningCommitments: "Calendar unavailable.", openSlots: "Calendar unavailable.", conflicts: "Calendar unavailable." };
  }
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 86_400_000);

  const { data } = await supabase
    .from("calendar_events")
    .select("title, start_at, end_at")
    .eq("household_id", householdId)
    .gte("start_at", now.toISOString())
    .lte("start_at", weekOut.toISOString())
    .order("start_at");

  const events = (data ?? []) as Array<{ title: string; start_at: string; end_at: string }>;
  const evenings = events.filter((e) => new Date(e.start_at).getHours() >= 17);
  const eveningCommitments = evenings.length
    ? evenings.map((e) => `${new Date(e.start_at).toLocaleDateString("en-US", { weekday: "short" })} ${e.title}`).join(", ")
    : "No evening commitments this week.";

  // Naive conflict detection: events overlapping the previous one's end
  let conflictsCount = 0;
  for (let i = 1; i < events.length; i++) {
    if (new Date(events[i].start_at) < new Date(events[i - 1].end_at)) conflictsCount++;
  }
  const conflicts = conflictsCount ? `${conflictsCount} overlapping events this week.` : "No overlapping events.";

  const openSlots = evenings.length >= 4
    ? "Week is dense; few open evening slots."
    : "Several evening blocks open in the next 7 days.";

  return { eveningCommitments, openSlots, conflicts };
}

export async function buildMoneyDomainState(householdId: string): Promise<MoneyDomainState> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { upcomingBills: "Bills unavailable.", monthSpend: "Spend unavailable.", budgetHeadroom: "Budget unavailable.", activeSubscriptions: "Subscriptions unavailable." };
  }

  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [billsResult, txnResult, ctxResult] = await Promise.allSettled([
    supabase
      .from("bills")
      .select("name, amount, due_date, autopay")
      .eq("household_id", householdId)
      .neq("status", "paid")
      .gte("due_date", now.toISOString().slice(0, 10))
      .lte("due_date", in14.toISOString())
      .order("due_date"),
    supabase
      .from("transactions")
      .select("category, amount")
      .eq("household_id", householdId)
      .gte("date", monthStart)
      .lt("amount", 0),
    supabase
      .from("household_context")
      .select("budget_monthly")
      .eq("household_id", householdId)
      .maybeSingle(),
  ]);

  const bills = (billsResult.status === "fulfilled" ? billsResult.value.data ?? [] : []) as Array<{ name: string; amount: number; due_date: string; autopay: boolean }>;
  const txns = (txnResult.status === "fulfilled" ? txnResult.value.data ?? [] : []) as Array<{ category: string; amount: number }>;
  const budgetMonthly = Number(((ctxResult.status === "fulfilled" ? ctxResult.value.data : null) as { budget_monthly?: number } | null)?.budget_monthly ?? 0);

  const upcomingBills = bills.length
    ? bills.map((b) => `${b.name} $${Number(b.amount).toFixed(0)} due ${new Date(b.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${b.autopay ? " (autopay)" : ""}`).join("; ")
    : "No bills due in the next 14 days.";

  const byCategory: Record<string, number> = {};
  for (const t of txns) {
    const c = t.category ?? "Other";
    byCategory[c] = (byCategory[c] ?? 0) + Math.abs(t.amount);
  }
  const totalSpend = Object.values(byCategory).reduce((sum, v) => sum + v, 0);
  const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const monthSpend = topCats.length
    ? `MTD $${totalSpend.toFixed(0)}: ${topCats.map(([c, v]) => `${c} $${v.toFixed(0)}`).join(", ")}`
    : "No transactions logged this month.";

  const budgetHeadroom = budgetMonthly
    ? `Budget $${budgetMonthly.toFixed(0)}/mo · spent $${totalSpend.toFixed(0)} · remaining $${(budgetMonthly - totalSpend).toFixed(0)}`
    : "No monthly budget configured.";

  return { upcomingBills, monthSpend, budgetHeadroom, activeSubscriptions: "Tracked via bills + Plaid recurring." };
}

