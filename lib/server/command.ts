// Data layer for the personal command centre.
//
// Every function takes both the household and the user: RLS scopes to the
// household, but these are one person's goals and one person's three things,
// so the queries scope to the user as well. Mirrors lib/server/store.ts in
// shape — the service role bypasses RLS, so the scoping here is the boundary.

import { getSupabaseAdmin } from "@/lib/server/supabase";

type Row = Record<string, unknown>;

const str = (v: unknown): string => String(v ?? "");
const opt = (v: unknown): string | undefined => (v == null || v === "" ? undefined : String(v));
const ymd = (v: unknown): string | undefined =>
  typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : undefined;

function db() {
  return getSupabaseAdmin();
}

function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`[command] ${what}: ${error.message}`);
    throw new Error(`Could not ${what}.`);
  }
}

// ─── goals ───────────────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  title: string;
  dueDate?: string;
  doneAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  why?: string;
  targetDate?: string;
  status: string;
  milestones: Milestone[];
}

const toMilestone = (r: Row): Milestone => ({
  id: str(r.id),
  title: str(r.title),
  dueDate: ymd(r.due_date),
  doneAt: opt(r.done_at),
});

export async function listGoals(householdId: string, userId: string): Promise<Goal[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb
    .from("goals")
    .select("id,title,why,target_date,status,milestones(id,title,due_date,done_at,sort_order)")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  check(error, "load goals");

  return (data ?? []).map((r: Row) => ({
    id: str(r.id),
    title: str(r.title),
    why: opt(r.why),
    targetDate: ymd(r.target_date),
    status: str(r.status),
    // Ordered here rather than in the query: PostgREST cannot order an
    // embedded resource and a flat one in the same request.
    milestones: ((r.milestones as Row[]) ?? [])
      .slice()
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map(toMilestone),
  }));
}

export async function addGoal(householdId: string, userId: string, title: string, why?: string, targetDate?: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("goals").insert({
    household_id: householdId,
    user_id: userId,
    title,
    why: why || null,
    target_date: targetDate || null,
  });
  check(error, "add the goal");
}

export async function archiveGoal(householdId: string, userId: string, id: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb
    .from("goals")
    .update({ archived_at: new Date().toISOString(), status: "archived" })
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .eq("id", id);
  check(error, "archive the goal");
}

export async function addMilestone(goalId: string, title: string, dueDate?: string) {
  const sb = db();
  if (!sb) return;
  // Taken from the goal rather than the caller: a milestone cannot belong to a
  // different household than the thing it is a milestone of.
  const { data: goal } = await sb.from("goals").select("household_id").eq("id", goalId).maybeSingle();
  if (!goal) return;
  const { count } = await sb
    .from("milestones")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", goalId);
  const { error } = await sb.from("milestones").insert({
    goal_id: goalId,
    household_id: String(goal.household_id),
    title,
    due_date: dueDate || null,
    sort_order: count ?? 0,
  });
  check(error, "add the milestone");
}

export async function toggleMilestone(id: string, done: boolean) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb
    .from("milestones")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  check(error, "update the milestone");
}

/** Fraction of milestones completed, or null when a goal has none to measure. */
export function goalProgress(goal: Goal): number | null {
  if (goal.milestones.length === 0) return null;
  return goal.milestones.filter((m) => m.doneAt).length / goal.milestones.length;
}

// ─── the day's three ─────────────────────────────────────────────────────────

export interface Priority {
  id: string;
  rank: number;
  title: string;
  goalId?: string;
  doneAt?: string;
}

const toPriority = (r: Row): Priority => ({
  id: str(r.id),
  rank: Number(r.rank),
  title: str(r.title),
  goalId: opt(r.goal_id),
  doneAt: opt(r.done_at),
});

export async function listPriorities(householdId: string, userId: string, date: string): Promise<Priority[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb
    .from("priorities")
    .select("id,rank,title,goal_id,done_at")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .eq("on_date", date)
    .order("rank", { ascending: true });
  check(error, "load today's priorities");
  return (data ?? []).map(toPriority);
}

export async function setPriority(
  householdId: string,
  userId: string,
  date: string,
  rank: number,
  title: string,
  goalId?: string
) {
  const sb = db();
  if (!sb) return;
  if (!title.trim()) {
    // Clearing the box removes the pick rather than storing an empty one.
    const { error } = await sb
      .from("priorities")
      .delete()
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .eq("on_date", date)
      .eq("rank", rank);
    check(error, "clear the priority");
    return;
  }
  const { error } = await sb.from("priorities").upsert(
    {
      household_id: householdId,
      user_id: userId,
      on_date: date,
      rank,
      title: title.trim().slice(0, 140),
      goal_id: goalId || null,
    },
    { onConflict: "user_id,on_date,rank" }
  );
  check(error, "save the priority");
}

export async function togglePriority(householdId: string, userId: string, id: string, done: boolean) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb
    .from("priorities")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .eq("id", id);
  check(error, "update the priority");
}

/** Completion per day over a window, for the dashboard's streak strip. */
export async function priorityHistory(
  householdId: string,
  userId: string,
  fromDate: string,
  toDate: string
): Promise<Record<string, { total: number; done: number }>> {
  const sb = db();
  if (!sb) return {};
  const { data, error } = await sb
    .from("priorities")
    .select("on_date,done_at")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .gte("on_date", fromDate)
    .lte("on_date", toDate);
  check(error, "load the priority history");

  const out: Record<string, { total: number; done: number }> = {};
  for (const r of (data ?? []) as Row[]) {
    const day = ymd(r.on_date) ?? "";
    if (!day) continue;
    out[day] ??= { total: 0, done: 0 };
    out[day].total += 1;
    if (r.done_at) out[day].done += 1;
  }
  return out;
}

// ─── weekly review ───────────────────────────────────────────────────────────

export interface WeekReview {
  weekStart: string;
  wentWell?: string;
  didNot?: string;
  focusNext?: string;
}

export async function getWeekReview(
  householdId: string,
  userId: string,
  weekStart: string
): Promise<WeekReview | null> {
  const sb = db();
  if (!sb) return null;
  const { data, error } = await sb
    .from("week_reviews")
    .select("week_start,went_well,did_not,focus_next")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  check(error, "load the week review");
  if (!data) return null;
  return {
    weekStart: ymd(data.week_start) ?? weekStart,
    wentWell: opt(data.went_well),
    didNot: opt(data.did_not),
    focusNext: opt(data.focus_next),
  };
}

export async function saveWeekReview(
  householdId: string,
  userId: string,
  weekStart: string,
  fields: { wentWell?: string; didNot?: string; focusNext?: string }
) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("week_reviews").upsert(
    {
      household_id: householdId,
      user_id: userId,
      week_start: weekStart,
      went_well: fields.wentWell?.slice(0, 4000) || null,
      did_not: fields.didNot?.slice(0, 4000) || null,
      focus_next: fields.focusNext?.slice(0, 4000) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" }
  );
  check(error, "save the week review");
}

// ─── reading ─────────────────────────────────────────────────────────────────

export interface Reading {
  id: string;
  title: string;
  author?: string;
  kind: string;
  status: string;
  progress: number;
  rating?: number;
  notes?: string;
  startedOn?: string;
  finishedOn?: string;
}

const toReading = (r: Row): Reading => ({
  id: str(r.id),
  title: str(r.title),
  author: opt(r.author),
  kind: str(r.kind),
  status: str(r.status),
  progress: Number(r.progress ?? 0),
  rating: r.rating == null ? undefined : Number(r.rating),
  notes: opt(r.notes),
  startedOn: ymd(r.started_on),
  finishedOn: ymd(r.finished_on),
});

export async function listReadings(householdId: string, userId: string): Promise<Reading[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb
    .from("readings")
    .select("id,title,author,kind,status,progress,rating,notes,started_on,finished_on")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  check(error, "load the reading list");
  return (data ?? []).map(toReading);
}

export async function addReading(
  householdId: string,
  userId: string,
  fields: { title: string; author?: string; kind?: string; status?: string }
) {
  const sb = db();
  if (!sb) return;
  const status = fields.status || "reading";
  const { error } = await sb.from("readings").insert({
    household_id: householdId,
    user_id: userId,
    title: fields.title.slice(0, 200),
    author: fields.author?.slice(0, 120) || null,
    kind: fields.kind || "book",
    status,
    // Starting something is itself a date worth keeping, and nobody will
    // remember to set it later.
    started_on: status === "reading" ? new Date().toISOString().slice(0, 10) : null,
  });
  check(error, "add the book");
}

export async function updateReading(
  householdId: string,
  userId: string,
  id: string,
  fields: { progress?: number; status?: string; rating?: number; notes?: string }
) {
  const sb = db();
  if (!sb) return;
  const patch: Row = {};
  if (fields.progress != null) patch.progress = Math.max(0, Math.min(100, Math.round(fields.progress)));
  if (fields.notes != null) patch.notes = fields.notes.slice(0, 4000) || null;
  if (fields.rating != null) patch.rating = Math.max(1, Math.min(5, Math.round(fields.rating)));
  if (fields.status) {
    patch.status = fields.status;
    if (fields.status === "finished") {
      patch.finished_on = new Date().toISOString().slice(0, 10);
      patch.progress = 100;
    }
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await sb
    .from("readings")
    .update(patch)
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .eq("id", id);
  check(error, "update the book");
}

export async function deleteReading(householdId: string, userId: string, id: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb
    .from("readings")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .eq("id", id);
  check(error, "remove the book");
}

// ─── journal ─────────────────────────────────────────────────────────────────

export interface JournalEntry {
  onDate: string;
  body: string;
  updatedAt?: string;
}

export async function getJournal(householdId: string, userId: string, date: string): Promise<JournalEntry | null> {
  const sb = db();
  if (!sb) return null;
  const { data, error } = await sb
    .from("journal_entries")
    .select("on_date,body,updated_at")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .eq("on_date", date)
    .maybeSingle();
  check(error, "load the journal entry");
  if (!data) return null;
  return { onDate: ymd(data.on_date) ?? date, body: str(data.body), updatedAt: opt(data.updated_at) };
}

export async function saveJournal(householdId: string, userId: string, date: string, body: string) {
  const sb = db();
  if (!sb) return;
  const { error } = await sb.from("journal_entries").upsert(
    {
      household_id: householdId,
      user_id: userId,
      on_date: date,
      body: body.slice(0, 20000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,on_date" }
  );
  check(error, "save the journal entry");
}

export async function recentJournal(
  householdId: string,
  userId: string,
  limit = 14
): Promise<JournalEntry[]> {
  const sb = db();
  if (!sb) return [];
  const { data, error } = await sb
    .from("journal_entries")
    .select("on_date,body,updated_at")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .neq("body", "")
    .order("on_date", { ascending: false })
    .limit(limit);
  check(error, "load recent journal entries");
  return (data ?? []).map((r: Row) => ({
    onDate: ymd(r.on_date) ?? "",
    body: str(r.body),
    updatedAt: opt(r.updated_at),
  }));
}
