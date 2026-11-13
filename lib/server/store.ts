// The only module that talks to the household database. Every function takes
// an explicit householdId and scopes every query to it (service role bypasses
// RLS, so the scoping here is the tenant boundary).
//
// Without Supabase configured (local preview) reads return sample data and
// writes are no-ops.

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { sampleData } from "@/lib/sample-data";
import { isYmd, nextBillDue, nextDue } from "@/lib/schedule";
import type { Bill, Frequency, MealDay, RoutineItem, TapEvent, Task, UpkeepItem, Vehicle } from "@/lib/types";

type Row = Record<string, unknown>;

const ymd = (v: unknown): string | undefined =>
  typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : undefined;
// Noon UTC keeps the calendar date stable in any US timezone.
const toTs = (date: string | undefined | null) => (date ? `${date}T12:00:00Z` : null);
const num = (v: unknown): number | undefined => (v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

function db() {
  return getSupabaseAdmin();
}

function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`[store] ${what}: ${error.message}`);
    throw new Error(`Could not ${what}.`);
  }
}

// ─── tasks ───────────────────────────────────────────────────────────────────

const toTask = (r: Row): Task => ({
  id: String(r.id),
  title: String(r.title),
  dueDate: ymd(r.due_date),
  done: r.status === "done",
  completedAt: typeof r.completed_at === "string" ? r.completed_at : undefined,
});

/** Open tasks plus anything completed since `doneSince` (ISO), so it can be undone. */
export async function listTasks(householdId: string, today: string, doneSince: string): Promise<Task[]> {
  const sb = db();
  if (!sb) return sampleData(today).tasks;
  const { data, error } = await sb
    .from("tasks")
    .select("id,title,due_date,status,completed_at")
    .eq("household_id", householdId)
    .or(`status.neq.done,completed_at.gte.${doneSince}`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);
  check(error, "load tasks");
  return (data ?? []).map(toTask);
}

export async function addTask(householdId: string, title: string, dueDate?: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("tasks").insert({
    id: randomUUID(),
    household_id: householdId,
    title,
    agent: "home",
    category: "Household",
    status: "todo",
    priority: "medium",
    due_date: toTs(dueDate),
    created_at: new Date().toISOString(),
  });
  check(error, "add the task");
}

export async function setTaskDone(householdId: string, id: string, done: boolean) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb
    .from("tasks")
    .update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null })
    .eq("household_id", householdId)
    .eq("id", id);
  check(error, "update the task");
}

export async function deleteTask(householdId: string, id: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("tasks").delete().eq("household_id", householdId).eq("id", id);
  check(error, "delete the task");
}

// ─── bills ───────────────────────────────────────────────────────────────────

const toBill = (r: Row): Bill => ({
  id: String(r.id),
  name: String(r.name),
  amount: num(r.amount) ?? 0,
  dueDate: ymd(r.due_date),
  frequency: String(r.frequency) as Frequency,
  autopay: r.autopay === true,
  paid: r.status === "paid",
});

export async function listBills(householdId: string, today: string): Promise<Bill[]> {
  const sb = db();
  if (!sb) return sampleData(today).bills;
  const { data, error } = await sb
    .from("bills")
    .select("id,name,amount,due_date,frequency,autopay,status")
    .eq("household_id", householdId)
    .neq("status", "canceled")
    .order("due_date", { ascending: true, nullsFirst: false });
  check(error, "load bills");
  // A paid one-time bill is finished; recurring bills roll forward instead.
  return (data ?? []).map(toBill).filter((b) => !(b.paid && b.frequency === "one-time"));
}

export async function saveBill(
  householdId: string,
  bill: { id?: string; name: string; amount: number; dueDate?: string; frequency: Frequency; autopay: boolean }
) {
  const sb = db();
  if (!sb) return;
  const fields = {
    name: bill.name,
    amount: bill.amount,
    due_date: toTs(bill.dueDate),
    frequency: bill.frequency,
    autopay: bill.autopay,
    status: "due",
  };
  const { error } = bill.id
    ? await sb.from("bills").update(fields).eq("household_id", householdId).eq("id", bill.id)
    : await sb.from("bills").insert({
        id: randomUUID(),
        household_id: householdId,
        kind: bill.frequency === "one-time" ? "one-time" : "bill",
        category: "Household",
        ...fields,
      });
  check(error, "save the bill");
}

export async function markBillPaid(householdId: string, id: string, today: string) {
  const sb = db();
  if (!sb) return;
  const { data, error } = await sb
    .from("bills").select("due_date,frequency").eq("household_id", householdId).eq("id", id).maybeSingle();
  check(error, "load the bill");
  if (!data) return;
  const next = nextBillDue(String(data.frequency) as Frequency, ymd(data.due_date), today);
  const { error: upErr } = await sb
    .from("bills")
    .update(
      next
        ? { due_date: toTs(next), status: "due", last_paid: new Date().toISOString() }
        : { status: "paid", last_paid: new Date().toISOString() }
    )
    .eq("household_id", householdId)
    .eq("id", id);
  check(upErr, "mark the bill paid");
}

export async function deleteBill(householdId: string, id: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("bills").delete().eq("household_id", householdId).eq("id", id);
  check(error, "delete the bill");
}

// ─── upkeep (home + car maintenance) ─────────────────────────────────────────

const toUpkeep = (r: Row): UpkeepItem => ({
  id: String(r.id),
  item: String(r.item),
  frequency: String(r.frequency) as Frequency,
  lastDone: ymd(r.last_done),
  nextDue: ymd(r.next_due) ?? "9999-12-31",
});

export async function listUpkeep(householdId: string, today: string): Promise<UpkeepItem[]> {
  const sb = db();
  if (!sb) return sampleData(today).upkeep;
  const { data, error } = await sb
    .from("maintenance_items")
    .select("id,item,frequency,last_done,next_due")
    .eq("household_id", householdId)
    .order("next_due", { ascending: true });
  check(error, "load upkeep");
  return (data ?? []).map(toUpkeep);
}

export async function addUpkeep(householdId: string, item: string, frequency: Frequency, firstDue: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("maintenance_items").insert({
    id: randomUUID(),
    household_id: householdId,
    item,
    system: "Other",
    frequency,
    last_done: toTs(firstDue),
    next_due: toTs(firstDue),
    status: "ok",
    auto_create_task: false,
  });
  check(error, "add the upkeep item");
}

export async function markUpkeepDone(householdId: string, id: string, today: string) {
  const sb = db();
  if (!sb) return;
  const { data, error } = await sb
    .from("maintenance_items").select("frequency").eq("household_id", householdId).eq("id", id).maybeSingle();
  check(error, "load the upkeep item");
  if (!data) return;
  const next = nextDue(String(data.frequency) as Frequency, today);
  if (!next) {
    const { error: delErr } = await sb.from("maintenance_items").delete().eq("household_id", householdId).eq("id", id);
    check(delErr, "finish the upkeep item");
    return;
  }
  const { error: upErr } = await sb
    .from("maintenance_items")
    .update({ last_done: toTs(today), next_due: toTs(next), status: "ok" })
    .eq("household_id", householdId)
    .eq("id", id);
  check(upErr, "mark the upkeep item done");
}

export async function deleteUpkeep(householdId: string, id: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("maintenance_items").delete().eq("household_id", householdId).eq("id", id);
  check(error, "delete the upkeep item");
}

// ─── meals ───────────────────────────────────────────────────────────────────

export async function listMeals(householdId: string, from: string, to: string): Promise<MealDay[]> {
  const sb = db();
  if (!sb) return sampleData(from).meals.filter((m) => m.date <= to);
  const { data, error } = await sb
    .from("meal_plan_days")
    .select("date,dinner")
    .eq("household_id", householdId)
    .gte("date", from)
    .lte("date", to);
  check(error, "load meals");
  return (data ?? []).map((r: Row) => {
    const dinner = (r.dinner ?? null) as { name?: unknown; notes?: unknown } | null;
    return {
      date: String(r.date).slice(0, 10),
      dinner: typeof dinner?.name === "string" && dinner.name ? dinner.name : undefined,
      notes: typeof dinner?.notes === "string" && dinner.notes ? dinner.notes : undefined,
    };
  });
}

export async function setDinner(householdId: string, date: string, name: string, notes?: string) {
  const sb = db();
  if (!sb || !isYmd(date)) return;
  if (!name) {
    const { error } = await sb.from("meal_plan_days").delete().eq("household_id", householdId).eq("date", date);
    check(error, "clear dinner");
    return;
  }
  const { error } = await sb.from("meal_plan_days").upsert(
    { household_id: householdId, date, label: date, dinner: { kind: "cook", name, ...(notes ? { notes } : {}) } },
    { onConflict: "household_id,date" }
  );
  check(error, "save dinner");
}

// ─── routine ─────────────────────────────────────────────────────────────────

export async function listRoutine(householdId: string, today: string): Promise<RoutineItem[]> {
  const sb = db();
  if (!sb) return sampleData(today).routine;
  const { data, error } = await sb
    .from("routine_items")
    .select("id,label,time_of_day,days,who")
    .eq("household_id", householdId)
    .order("time_of_day", { ascending: true });
  check(error, "load the routine");
  return (data ?? []).map((r: Row) => ({
    id: String(r.id),
    label: String(r.label),
    time: String(r.time_of_day),
    days: Array.isArray(r.days) ? r.days.map(Number) : [],
    who: typeof r.who === "string" && r.who ? r.who : undefined,
  }));
}

export async function addRoutine(householdId: string, item: Omit<RoutineItem, "id">) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("routine_items").insert({
    household_id: householdId,
    label: item.label,
    time_of_day: item.time,
    days: item.days,
    who: item.who ?? null,
  });
  check(error, "add the routine item");
}

export async function deleteRoutine(householdId: string, id: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("routine_items").delete().eq("household_id", householdId).eq("id", id);
  check(error, "delete the routine item");
}

// ─── vehicles ────────────────────────────────────────────────────────────────

export async function listVehicles(householdId: string, today: string): Promise<Vehicle[]> {
  const sb = db();
  if (!sb) return sampleData(today).vehicles;
  const { data, error } = await sb
    .from("vehicles")
    .select("id,year,make,model,mileage,last_oil_change_miles,oil_change_interval_miles,registration_expires")
    .eq("household_id", householdId)
    .order("year", { ascending: false });
  check(error, "load vehicles");
  return (data ?? []).map((r: Row) => ({
    id: String(r.id),
    year: Number(r.year),
    make: String(r.make),
    model: String(r.model),
    mileage: num(r.mileage),
    lastOilChangeMiles: num(r.last_oil_change_miles),
    oilChangeIntervalMiles: num(r.oil_change_interval_miles) ?? 5000,
    registrationExpires: ymd(r.registration_expires),
  }));
}

export async function saveVehicle(householdId: string, v: Omit<Vehicle, "id"> & { id?: string }) {
  const sb = db();
  if (!sb) return;
  const fields = {
    year: v.year,
    make: v.make,
    model: v.model,
    mileage: v.mileage ?? null,
    last_oil_change_miles: v.lastOilChangeMiles ?? null,
    oil_change_interval_miles: v.oilChangeIntervalMiles,
    registration_expires: v.registrationExpires ?? null,
  };
  const { error } = v.id
    ? await sb.from("vehicles").update(fields).eq("household_id", householdId).eq("id", v.id)
    : await sb.from("vehicles").insert({ household_id: householdId, ...fields });
  check(error, "save the vehicle");
}

export async function deleteVehicle(householdId: string, id: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("vehicles").delete().eq("household_id", householdId).eq("id", id);
  check(error, "delete the vehicle");
}

// ─── taps ────────────────────────────────────────────────────────────────────

export async function listTaps(householdId: string, today: string, limit = 5): Promise<TapEvent[]> {
  const sb = db();
  if (!sb) return sampleData(today).taps;
  const { data, error } = await sb
    .from("tap_events")
    .select("slug,label,created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(limit);
  check(error, "load taps");
  return (data ?? []).map((r: Row) => ({ slug: String(r.slug), label: String(r.label), at: String(r.created_at) }));
}
