// Data layer for chores.
//
// Production reads and writes Supabase (tables from the 20261127120000_chores
// migration), scoped by household; the service role bypasses RLS, so the
// household filter here is the boundary, as everywhere else in lib/server.
//
// Without Supabase configured (local preview) the rest of the app shows
// read-only sample data. Chores instead keep a small JSON file under .data/,
// so a local preview can actually be used — add, complete, close the tab,
// come back — without touching production.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import {
  addDays,
  alignFirstDue,
  nextDueAfterComplete,
  nextDueAfterSkip,
  type Anchor,
  type Cadence,
  type Chore,
  type ChoreEvent,
  type ChoreStatus,
  type EventKind,
} from "@/lib/chores";

export interface ChoreInput {
  name: string;
  room: string;
  assignee?: string;
  cadence: Cadence;
  anchor: Anchor;
  nextDue: string;
  estimateMinutes?: number;
  notes?: string;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");
const opt = (v: unknown) => (v == null || v === "" ? undefined : String(v));
const day = (v: unknown) => str(v).slice(0, 10);

function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`[chores] ${what}: ${error.message}`);
    throw new Error(`Could not ${what}.`);
  }
}

const toChore = (r: Row): Chore => ({
  id: str(r.id),
  name: str(r.name),
  room: str(r.room),
  assignee: opt(r.assignee),
  cadence: {
    kind: str(r.cadence_kind) as Cadence["kind"],
    interval: Number(r.cadence_interval ?? 1),
    weekdays: Array.isArray(r.cadence_weekdays) ? (r.cadence_weekdays as unknown[]).map(Number) : [],
  },
  anchor: r.anchor === "completion" ? "completion" : "scheduled",
  startDate: day(r.start_date),
  nextDue: day(r.next_due),
  estimateMinutes: r.estimate_minutes == null ? undefined : Number(r.estimate_minutes),
  notes: opt(r.notes),
  status: (["active", "paused", "archived"].includes(str(r.status)) ? r.status : "active") as ChoreStatus,
});

const toRow = (c: ChoreInput) => ({
  name: c.name,
  room: c.room,
  assignee: c.assignee ?? null,
  cadence_kind: c.cadence.kind,
  cadence_interval: c.cadence.interval,
  cadence_weekdays: c.cadence.weekdays,
  anchor: c.anchor,
  estimate_minutes: c.estimateMinutes ?? null,
  notes: c.notes ?? null,
});

// ─── local file store (preview only) ─────────────────────────────────────────

interface FileDb {
  chores: (Chore & { householdId: string })[];
  events: (ChoreEvent & { householdId: string })[];
}

// A fixed path: a dynamic one makes the bundler trace the whole project into
// the server build.
const FILE = path.join(process.cwd(), ".data", "chores.json");

/** The same starter set the migration seeds, relative to today. */
function samples(today: string): ChoreInput[] {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const nextDow = (d: number) => addDays(today, (d - dow + 7) % 7);
  const c = (kind: Cadence["kind"], interval = 1, weekdays: number[] = []): Cadence => ({ kind, interval, weekdays });
  const nextMonThu = [nextDow(1), nextDow(4)].sort()[0];
  return [
    { name: "Wipe kitchen counters", room: "Kitchen", cadence: c("days"), anchor: "scheduled", nextDue: today, estimateMinutes: 5 },
    { name: "Run and empty dishwasher", room: "Kitchen", cadence: c("days"), anchor: "scheduled", nextDue: addDays(today, -1), estimateMinutes: 10 },
    {
      name: "Take out trash and recycling", room: "Outside", assignee: "Cameron", cadence: c("weekdays", 1, [2]),
      anchor: "scheduled", nextDue: nextDow(2), estimateMinutes: 10, notes: "Recycling goes out every week with the trash.",
    },
    { name: "Laundry", room: "Laundry room", assignee: "Corine", cadence: c("weekdays", 1, [1, 4]), anchor: "scheduled", nextDue: nextMonThu, estimateMinutes: 45 },
    { name: "Vacuum living room", room: "Living room", cadence: c("weeks"), anchor: "completion", nextDue: addDays(today, -2), estimateMinutes: 20 },
    { name: "Water plants", room: "Living room", cadence: c("days", 4), anchor: "completion", nextDue: addDays(today, 1), estimateMinutes: 5 },
    { name: "Sanitize Charlie's toys", room: "Nursery", cadence: c("weeks"), anchor: "scheduled", nextDue: addDays(today, 2), estimateMinutes: 15 },
    { name: "Clean bathrooms", room: "Bathroom", cadence: c("weeks", 2), anchor: "scheduled", nextDue: addDays(today, 3), estimateMinutes: 30 },
    { name: "Change bed sheets", room: "Bedroom", cadence: c("weeks", 2), anchor: "completion", nextDue: addDays(today, 5), estimateMinutes: 15 },
    {
      name: "Clear out the fridge", room: "Kitchen", cadence: c("months"), anchor: "scheduled", nextDue: addDays(today, 9),
      estimateMinutes: 20, notes: "Toss leftovers, wipe the shelves.",
    },
    { name: "Deep clean the oven", room: "Kitchen", cadence: c("months", 3), anchor: "scheduled", nextDue: addDays(today, 20), estimateMinutes: 60 },
  ];
}

async function readFile(householdId: string, today: string): Promise<FileDb> {
  try {
    const db = JSON.parse(await fs.readFile(FILE, "utf8")) as FileDb;
    if (db.chores.some((c) => c.householdId === householdId)) return db;
  } catch {
    // First run, or an unreadable file: start fresh below.
  }
  const db: FileDb = {
    chores: samples(today).map((s, i, all) => ({
      ...s,
      id: randomUUID(),
      householdId,
      startDate: s.nextDue,
      status: i === all.length - 1 ? "paused" : "active",
    })),
    events: [],
  };
  await writeFile(db);
  return db;
}

async function writeFile(db: FileDb) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

// ─── reads ───────────────────────────────────────────────────────────────────

/** Every chore in the household, archived included; callers filter. */
export async function listChores(householdId: string, today: string): Promise<Chore[]> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const db = await readFile(householdId, today);
    return db.chores.filter((c) => c.householdId === householdId).sort(byDue);
  }
  const { data, error } = await sb
    .from("chores")
    .select("*")
    .eq("household_id", householdId)
    .order("next_due", { ascending: true })
    .order("name", { ascending: true });
  check(error, "load chores");
  return ((data ?? []) as Row[]).map(toChore);
}

const byDue = (a: Chore, b: Chore) => a.nextDue.localeCompare(b.nextDue) || a.name.localeCompare(b.name);

export async function getChore(householdId: string, id: string, today: string): Promise<Chore | null> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const db = await readFile(householdId, today);
    return db.chores.find((c) => c.householdId === householdId && c.id === id) ?? null;
  }
  const { data, error } = await sb.from("chores").select("*").eq("household_id", householdId).eq("id", id).maybeSingle();
  check(error, "load the chore");
  return data ? toChore(data as Row) : null;
}

/** Recent history, newest first; optionally for one chore. */
export async function listEvents(
  householdId: string,
  today: string,
  opts: { choreId?: string; sinceDays?: number; limit?: number } = {}
): Promise<ChoreEvent[]> {
  const since = addDays(today, -(opts.sinceDays ?? 60));
  const limit = opts.limit ?? 200;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const db = await readFile(householdId, today);
    return db.events
      .filter((e) => e.householdId === householdId && e.onDate >= since && (!opts.choreId || e.choreId === opts.choreId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  let q = sb
    .from("chore_events")
    .select("id,chore_id,kind,on_date,due_date,new_due,actor,created_at,chores(name,room)")
    .eq("household_id", householdId)
    .gte("on_date", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.choreId) q = q.eq("chore_id", opts.choreId);
  const { data, error } = await q;
  check(error, "load chore history");
  return ((data ?? []) as Row[]).map((r) => {
    const chore = (Array.isArray(r.chores) ? r.chores[0] : r.chores) as Row | null;
    return {
      id: str(r.id),
      choreId: str(r.chore_id),
      choreName: str(chore?.name),
      room: opt(chore?.room),
      kind: str(r.kind) as EventKind,
      onDate: day(r.on_date),
      dueDate: opt(r.due_date) ? day(r.due_date) : undefined,
      newDue: opt(r.new_due) ? day(r.new_due) : undefined,
      actor: opt(r.actor),
      createdAt: str(r.created_at),
    };
  });
}

// ─── writes ──────────────────────────────────────────────────────────────────

export async function createChore(householdId: string, input: ChoreInput, today: string): Promise<string> {
  const due = alignFirstDue(input.cadence, input.nextDue);
  const sb = getSupabaseAdmin();
  if (!sb) {
    const db = await readFile(householdId, today);
    const id = randomUUID();
    db.chores.push({ ...input, id, householdId, nextDue: due, startDate: due, status: "active" });
    await writeFile(db);
    return id;
  }
  const { data, error } = await sb
    .from("chores")
    .insert({ ...toRow(input), household_id: householdId, start_date: due, next_due: due })
    .select("id")
    .single();
  check(error, "add the chore");
  return str((data as Row).id);
}

/**
 * Save edits. If the cadence or due date changed, the calendar rhythm
 * restarts from the new due date — the old rhythm no longer describes it.
 */
export async function updateChore(householdId: string, id: string, input: ChoreInput, today: string) {
  const current = await getChore(householdId, id, today);
  if (!current) return;
  const due = alignFirstDue(input.cadence, input.nextDue);
  const rhythmChanged =
    due !== current.nextDue ||
    input.cadence.kind !== current.cadence.kind ||
    input.cadence.interval !== current.cadence.interval ||
    input.cadence.weekdays.join() !== current.cadence.weekdays.join();
  const startDate = rhythmChanged ? due : current.startDate;

  const sb = getSupabaseAdmin();
  if (!sb) {
    const db = await readFile(householdId, today);
    const c = db.chores.find((x) => x.householdId === householdId && x.id === id);
    if (c) Object.assign(c, input, { nextDue: due, startDate, assignee: input.assignee, estimateMinutes: input.estimateMinutes, notes: input.notes });
    await writeFile(db);
    return;
  }
  const { error } = await sb
    .from("chores")
    .update({ ...toRow(input), next_due: due, start_date: startDate, updated_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("id", id);
  check(error, "save the chore");
}

/**
 * Pause, resume, archive or restore. A chore coming back from a pause with a
 * due date in the past is due today, not overdue for the weeks it was off.
 */
export async function setChoreStatus(householdId: string, id: string, status: ChoreStatus, today: string) {
  const current = await getChore(householdId, id, today);
  if (!current) return;
  const nextDue = status === "active" && current.nextDue < today ? today : current.nextDue;
  const sb = getSupabaseAdmin();
  if (!sb) {
    const db = await readFile(householdId, today);
    const c = db.chores.find((x) => x.householdId === householdId && x.id === id);
    if (c) Object.assign(c, { status, nextDue });
    await writeFile(db);
    return;
  }
  const { error } = await sb
    .from("chores")
    .update({ status, next_due: nextDue, updated_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("id", id);
  check(error, "update the chore");
}

async function record(
  householdId: string,
  chore: Chore,
  kind: EventKind,
  onDate: string,
  newDue: string,
  actor: string | undefined,
  today: string
) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const db = await readFile(householdId, today);
    const c = db.chores.find((x) => x.householdId === householdId && x.id === chore.id);
    if (!c) return;
    c.nextDue = newDue;
    db.events.push({
      id: randomUUID(),
      householdId,
      choreId: chore.id,
      choreName: chore.name,
      room: chore.room,
      kind,
      onDate,
      dueDate: chore.nextDue,
      newDue,
      actor,
      createdAt: new Date().toISOString(),
    });
    await writeFile(db);
    return;
  }
  // History first: if the second write fails, the record of what happened
  // survives and the chore simply still shows its old date.
  const { error: evErr } = await sb.from("chore_events").insert({
    household_id: householdId,
    chore_id: chore.id,
    kind,
    on_date: onDate,
    due_date: chore.nextDue,
    new_due: newDue,
    actor: actor ?? null,
  });
  check(evErr, "save to history");
  const { error } = await sb
    .from("chores")
    .update({ next_due: newDue, updated_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("id", chore.id);
  check(error, "move the due date");
}

export async function completeChore(householdId: string, id: string, doneOn: string, actor: string | undefined, today: string) {
  const chore = await getChore(householdId, id, today);
  if (!chore || chore.status !== "active") return null;
  const next = nextDueAfterComplete(chore, doneOn);
  await record(householdId, chore, "completed", doneOn, next, actor, today);
  return { name: chore.name, next };
}

export async function skipChore(householdId: string, id: string, actor: string | undefined, today: string) {
  const chore = await getChore(householdId, id, today);
  if (!chore || chore.status !== "active") return null;
  const next = nextDueAfterSkip(chore, today);
  await record(householdId, chore, "skipped", today, next, actor, today);
  return { name: chore.name, next };
}

/** Move only this occurrence. The rhythm (start date) is untouched. */
export async function rescheduleChore(householdId: string, id: string, to: string, actor: string | undefined, today: string) {
  const chore = await getChore(householdId, id, today);
  if (!chore || chore.status !== "active" || to === chore.nextDue) return null;
  await record(householdId, chore, "rescheduled", today, to, actor, today);
  return { name: chore.name, next: to };
}

/** People who usually do chores here, for the assignee suggestions. */
const HOUSEHOLD_PEOPLE = ["Cameron", "Corine"];

/** Rooms and people already in use, for the form's suggestions. */
export function suggestions(chores: Chore[]) {
  return {
    rooms: [...new Set(chores.map((c) => c.room).filter(Boolean))].sort(),
    people: [...new Set([...HOUSEHOLD_PEOPLE, ...(chores.map((c) => c.assignee).filter(Boolean) as string[])])],
  };
}
