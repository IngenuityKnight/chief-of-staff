// The only module that talks to the household database. Every function takes
// an explicit householdId and scopes every query to it (service role bypasses
// RLS, so the scoping here is the tenant boundary).
//
// Without Supabase configured (local preview) reads return sample data and
// writes are no-ops.

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { sampleData } from "@/lib/sample-data";
import { record, type CompletionSource } from "@/lib/server/completions";
import { isYmd, nextDue } from "@/lib/schedule";
import type { Frequency, MealDay, RoutineItem, TapEvent, Task, UpkeepItem, Vehicle, VehicleService } from "@/lib/types";

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

export async function setTaskDone(
  householdId: string,
  id: string,
  done: boolean,
  source: CompletionSource = "phone"
) {
  const sb = db();
  if (!sb) return;

  // Read the title before the update so the log keeps something readable even
  // if the task is renamed or deleted later.
  const { data: existing } = await sb
    .from("tasks").select("title").eq("household_id", householdId).eq("id", id).maybeSingle();

  const { error } = await sb
    .from("tasks")
    .update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null })
    .eq("household_id", householdId)
    .eq("id", id);
  check(error, "update the task");

  // Only completions are logged. Reopening is a correction, not an event, and
  // a log that fills with ticks and un-ticks answers nothing.
  if (done && existing) {
    await record(householdId, {
      subjectKind: "task",
      subjectId: id,
      label: String(existing.title),
      source,
    });
  }
}

export async function deleteTask(householdId: string, id: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("tasks").delete().eq("household_id", householdId).eq("id", id);
  check(error, "delete the task");
}

// ─── upkeep (home + car maintenance) ─────────────────────────────────────────

const toUpkeep = (r: Row): UpkeepItem => ({
  id: String(r.id),
  item: String(r.item),
  frequency: String(r.frequency) as Frequency,
  lastDone: ymd(r.last_done),
  nextDue: ymd(r.next_due) ?? "9999-12-31",
  estCost: num(r.est_cost),
});

export async function listUpkeep(householdId: string, today: string): Promise<UpkeepItem[]> {
  const sb = db();
  if (!sb) return sampleData(today).upkeep;
  const { data, error } = await sb
    .from("maintenance_items")
    .select("id,item,frequency,last_done,next_due,est_cost")
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

export async function markUpkeepDone(
  householdId: string,
  id: string,
  today: string,
  source: CompletionSource = "phone"
): Promise<string | null> {
  const sb = db();
  if (!sb) return null;
  const { data, error } = await sb
    .from("maintenance_items").select("item,frequency").eq("household_id", householdId).eq("id", id).maybeSingle();
  check(error, "load the upkeep item");
  if (!data) return null;

  const label = String(data.item);
  // Written before either branch: a one-time job is deleted on completion, so
  // this is the only moment the fact that it was ever done can be captured.
  // The id goes back to the caller so a tap can be undone.
  const completionId = await record(householdId, { subjectKind: "upkeep", subjectId: id, label, source });

  const next = nextDue(String(data.frequency) as Frequency, today);
  if (!next) {
    const { error: delErr } = await sb.from("maintenance_items").delete().eq("household_id", householdId).eq("id", id);
    check(delErr, "finish the upkeep item");
    return completionId;
  }
  // last_done still moves: it is the fast answer to "when was this last done".
  // The log is the slow answer to "every time it has been".
  const { error: upErr } = await sb
    .from("maintenance_items")
    .update({ last_done: toTs(today), next_due: toTs(next), status: "ok" })
    .eq("household_id", householdId)
    .eq("id", id);
  check(upErr, "mark the upkeep item done");
  return completionId;
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
    .select("id,label,time_of_day,days,who,interval_weeks,anchor_date")
    .eq("household_id", householdId)
    .order("time_of_day", { ascending: true });
  check(error, "load the routine");
  return (data ?? []).map((r: Row) => ({
    id: String(r.id),
    intervalWeeks: r.interval_weeks == null ? 1 : Number(r.interval_weeks),
    anchorDate: ymd(r.anchor_date),
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
    .select("id,year,make,model,mileage,last_oil_change_miles,oil_change_interval_miles,registration_expires,tank_gallons")
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
    tankGallons: num(r.tank_gallons),
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
    tank_gallons: v.tankGallons ?? null,
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

/**
 * Re-derive a vehicle's odometer from its own logs.
 *
 * Every path that adds, edits or removes a fill-up has to call this. Setting
 * the mileage to "whatever was just entered" is only correct when that entry
 * is the newest one — deleting a log used to leave the odometer where the
 * deleted row had put it, which is how a 205,587-mile reading outlived the
 * log that created it and ended up on the wrong car.
 *
 * Takes the maximum rather than the latest by date, because an odometer only
 * goes up and a back-dated entry should not lower it.
 */
export async function syncVehicleMileage(householdId: string, vehicleId: string) {
  const sb = db();
  if (!sb) return;
  const { data, error } = await sb
    .from("vehicle_logs")
    .select("odometer_miles")
    .eq("household_id", householdId)
    .eq("vehicle_id", vehicleId)
    .order("odometer_miles", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[store] could not re-derive mileage: ${error.message}`);
    return;
  }
  // No logs left: leave whatever is there. It may have been typed in by hand
  // on the manage page, and clearing it would lose a real reading.
  if (!data) return;
  const { error: upErr } = await sb
    .from("vehicles")
    .update({ mileage: Number(data.odometer_miles) })
    .eq("household_id", householdId)
    .eq("id", vehicleId);
  check(upErr, "update the vehicle mileage");
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

/**
 * The newest value for each of `slugs`, which for a toggle tag is its current
 * state. Reads the same append-only rows as the history below, so asking
 * "is the dishwasher clean" costs nothing extra and cannot drift from the log.
 */
export async function tapStates(
  householdId: string,
  slugs: readonly string[]
): Promise<Record<string, { value: string; at: string }>> {
  const sb = db();
  if (!sb || slugs.length === 0) return {};
  const { data, error } = await sb
    .from("tap_events")
    .select("slug,value,created_at")
    .eq("household_id", householdId)
    .in("slug", slugs as string[])
    .not("value", "is", null)
    .order("created_at", { ascending: false });
  check(error, "load tap states");

  const out: Record<string, { value: string; at: string }> = {};
  // Rows arrive newest first, so the first one seen for a slug is its state.
  for (const r of (data ?? []) as Row[]) {
    const slug = String(r.slug);
    if (out[slug]) continue;
    out[slug] = { value: String(r.value), at: String(r.created_at) };
  }
  return out;
}

/**
 * Every tap for one slug, newest first. This is the maintenance record: the
 * reason tap_events is only ever inserted into is so that this can be asked
 * a year from now.
 */
export async function tapHistory(householdId: string, slug: string, limit = 50): Promise<TapEvent[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb
    .from("tap_events")
    .select("id,slug,label,created_at")
    .eq("household_id", householdId)
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(limit);
  check(error, "load tap history");
  return (data ?? []).map((r: Row) => ({
    id: String(r.id), slug: String(r.slug), label: String(r.label), at: String(r.created_at),
  }));
}

// ─── car services + cost estimates ───────────────────────────────────────────

const toService = (r: Row): VehicleService => ({
  id: String(r.id),
  vehicleId: String(r.vehicle_id),
  item: String(r.item),
  intervalMiles: num(r.interval_miles),
  intervalMonths: num(r.interval_months),
  estCost: num(r.est_cost) ?? 0,
  lastDoneMiles: num(r.last_done_miles),
  lastDoneDate: ymd(r.last_done_date),
  notes: typeof r.notes === "string" && r.notes ? r.notes : undefined,
});

export async function listVehicleServices(householdId: string): Promise<VehicleService[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb
    .from("vehicle_services")
    .select("id,vehicle_id,item,interval_miles,interval_months,est_cost,last_done_miles,last_done_date,notes")
    .eq("household_id", householdId)
    .order("item", { ascending: true });
  check(error, "load car services");
  return (data ?? []).map(toService);
}

/** Record a service as done at the given odometer reading and date. */
export async function markServiceDone(householdId: string, id: string, miles: number | undefined, today: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb
    .from("vehicle_services")
    .update({ last_done_miles: miles ?? null, last_done_date: today })
    .eq("household_id", householdId)
    .eq("id", id);
  check(error, "record the service");
}

export async function setServiceCost(householdId: string, id: string, cost: number) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("vehicle_services").update({ est_cost: cost }).eq("household_id", householdId).eq("id", id);
  check(error, "save the cost");
}

export async function setUpkeepCost(householdId: string, id: string, cost: number) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("maintenance_items").update({ est_cost: cost }).eq("household_id", householdId).eq("id", id);
  check(error, "save the cost");
}
