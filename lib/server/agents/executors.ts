// Executors: the ONLY code path that writes domain tables (BACKEND-BRIEF.md §4).
// Agents propose; executors act.
//
// executeProposal() is the single entry point — it dispatches by kind,
// runs the domain write, then updates proposals.status in the same call.

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getHouseholdForJob } from "@/lib/server/household";
import type {
  BlockTimePayload,
  CreateTaskPayload,
  MealPlanPayload,
  OrderItemPayload,
} from "./schemas";

export type ExecuteResult = { ok: boolean; error?: string };

export async function executeProposal(
  proposal: {
    id: string;
    kind: string;
    payload: Record<string, unknown>;
    inbox_item_id: string | null;
    household_id?: string;
  },
  decidedBy: "user" | "policy",
): Promise<ExecuteResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase not configured" };

  const householdId = proposal.household_id ?? getHouseholdForJob();
  const now = new Date().toISOString();
  let ok = false;
  let error: string | undefined;

  try {
    switch (proposal.kind) {
      case "create_task":
        ok = await _createTask(proposal.id, proposal.payload as unknown as CreateTaskPayload, proposal.inbox_item_id, householdId);
        break;
      case "meal_plan":
        ok = await _writeMealPlan(proposal.payload as unknown as MealPlanPayload, householdId);
        break;
      case "order_item":
        ok = await _addShoppingItem(proposal.payload as unknown as OrderItemPayload, householdId);
        break;
      case "block_time":
        ok = await _blockCalendar(proposal.payload as unknown as BlockTimePayload, householdId);
        break;
      default:
        error = `No executor for proposal kind "${proposal.kind}"`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Executor threw";
    ok = false;
  }

  const successStatus = decidedBy === "policy" ? "auto_executed" : "executed";
  await supabase
    .from("proposals")
    .update({
      status: ok ? successStatus : "failed",
      decided_by: decidedBy,
      decided_at: now,
      executed_at: ok ? now : null,
    })
    .eq("id", proposal.id);

  await supabase.from("events").insert({
    household_id: householdId,
    type: ok ? (decidedBy === "policy" ? "proposal.auto_executed" : "proposal.executed") : "proposal.failed",
    entity_id: proposal.id,
    payload: { kind: proposal.kind, error: error ?? null },
  });

  return { ok, error };
}

// ─── Domain writers ───────────────────────────────────────────────────────────

async function _createTask(
  proposalId: string,
  payload: CreateTaskPayload,
  inboxItemId: string | null,
  householdId: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase.from("tasks").insert({
    id: crypto.randomUUID(),
    household_id: householdId,
    title: payload.title,
    agent: payload.agent,
    category: payload.category,
    status: "todo",
    priority: payload.priority,
    inbox_item_id: inboxItemId,
    proposal_id: proposalId,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("executor create_task failed:", error);
  return !error;
}

async function _writeMealPlan(payload: MealPlanPayload, householdId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const rows = payload.days.map((day) => ({
    date: day.date,
    household_id: householdId,
    label: day.label,
    dinner: day.dinner ?? null,
    lunch: day.lunch ?? null,
    breakfast: day.breakfast ?? null,
  }));
  const { error } = await supabase
    .from("meal_plan_days")
    .upsert(rows, { onConflict: "date" });
  if (error) console.error("executor meal_plan failed:", error);
  return !error;
}

async function _addShoppingItem(payload: OrderItemPayload, householdId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase.from("shopping_list_items").insert({
    household_id: householdId,
    name: payload.name,
    quantity: payload.quantity,
    unit: payload.unit,
    source: "ai",
    priority: payload.priority,
    status: "needed",
    category: payload.category,
    notes: payload.notes ?? null,
    created_at: new Date().toISOString(),
  });
  if (error) console.error("executor order_item failed:", error);
  return !error;
}

async function _blockCalendar(payload: BlockTimePayload, householdId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const start = new Date(payload.date);
  start.setHours(payload.startHour, 0, 0, 0);
  const end = new Date(start.getTime() + payload.durationMinutes * 60_000);
  const { error } = await supabase.from("calendar_events").insert({
    id: crypto.randomUUID(),
    household_id: householdId,
    title: payload.title,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    type: "block",
    notes: payload.notes ?? null,
    agent: "meals",
  });
  if (error) console.error("executor block_time failed:", error);
  return !error;
}
