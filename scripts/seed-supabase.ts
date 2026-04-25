import {
  bills,
  calendar,
  decisions,
  household,
  inboxItems,
  maintenance,
  mealPlan,
  rules,
  tasks,
} from "../lib/mock-data.ts";
import { getSupabaseAdmin, getSupabaseUrl, isSupabaseConfigured } from "../lib/server/supabase.ts";

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }

  return supabase;
}

async function upsert(table: string, rows: Record<string, unknown>[], conflict: string) {
  if (rows.length === 0) return;

  const supabase = requireSupabase();
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });

  if (error) {
    throw new Error(`Failed to upsert ${table}: ${error.message}`);
  }

  console.log(`Seeded ${rows.length} rows into ${table}`);
}

async function main() {
  requireSupabase();
  console.log(`Seeding Supabase project at ${getSupabaseUrl()}`);

  await upsert(
    "inbox_items",
    inboxItems.map((item) => ({
      id: item.id,
      title: item.title,
      raw_input: item.rawInput,
      analysis: item.analysis,
      primary_agent: item.primaryAgent,
      secondary_agents: item.secondaryAgents,
      category: item.category,
      needs_action: item.needsAction,
      proposed_tasks: item.proposedTasks,
      status: item.status,
      source: item.source,
      created_at: item.createdAt,
      urgency: item.urgency,
    })),
    "id"
  );

  await upsert(
    "tasks",
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      agent: task.agent,
      category: task.category,
      status: task.status,
      due_date: task.dueDate ?? null,
      priority: task.priority,
      inbox_item_id: task.inboxItemId ?? null,
      notes: task.notes ?? null,
      created_at: task.createdAt,
    })),
    "id"
  );

  await upsert(
    "decisions",
    decisions.map((decision) => ({
      id: decision.id,
      title: decision.title,
      context: decision.context ?? null,
      status: decision.status,
      priority: decision.priority,
      category: decision.category,
      recommendation: decision.recommendation ?? null,
      options: decision.options,
      cost_estimate: decision.costEstimate ?? null,
      time_estimate_minutes: decision.timeEstimateMinutes ?? null,
      due_date: decision.dueDate ?? null,
      source_inbox_item_id: decision.sourceInboxItemId ?? null,
      created_at: decision.createdAt,
      resolved_at: decision.resolvedAt ?? null,
    })),
    "id"
  );

  await upsert(
    "maintenance_items",
    maintenance.map((item) => ({
      id: item.id,
      item: item.item,
      system: item.system,
      frequency: item.frequency,
      last_done: item.lastDone,
      next_due: item.nextDue,
      status: item.status,
      vendor: item.vendor ?? null,
      last_cost: item.lastCost ?? null,
      notes: item.notes ?? null,
    })),
    "id"
  );

  await upsert(
    "bills",
    bills.map((bill) => ({
      id: bill.id,
      name: bill.name,
      kind: bill.kind,
      amount: bill.amount,
      due_date: bill.dueDate ?? null,
      frequency: bill.frequency,
      category: bill.category,
      status: bill.status,
      autopay: bill.autopay,
      last_paid: bill.lastPaid ?? null,
    })),
    "id"
  );

  await upsert(
    "calendar_events",
    calendar.map((event) => ({
      id: event.id,
      title: event.title,
      start_at: event.start,
      end_at: event.end,
      type: event.type,
      location: event.location ?? null,
      notes: event.notes ?? null,
      agent: event.agent ?? null,
    })),
    "id"
  );

  await upsert(
    "household_members",
    household.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      notes: member.notes ?? null,
      avatar_color: member.avatarColor,
    })),
    "id"
  );

  await upsert(
    "rules",
    rules.map((rule) => ({
      id: rule.id,
      category: rule.category,
      title: rule.title,
      description: rule.description,
      priority: rule.priority,
      active: rule.active,
    })),
    "id"
  );

  await upsert(
    "meal_plan_days",
    mealPlan.map((day) => ({
      date: day.date.slice(0, 10),
      label: day.label,
      theme: day.theme ?? null,
      breakfast: day.breakfast ?? null,
      lunch: day.lunch ?? null,
      dinner: day.dinner ?? null,
    })),
    "date"
  );

  console.log("Supabase seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
