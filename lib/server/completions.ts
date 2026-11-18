// Every completion, kept.
//
// The state tables overwrite themselves: marking an upkeep job done replaces
// last_done and reschedules, so the previous completion is gone the moment
// the next one happens. This is the append-only half — state answers "what is
// true now", this answers "what happened", and nothing in here is ever
// updated or deleted.
//
// Writing is best-effort by design. Losing a history row is a smaller harm
// than refusing to let someone tick a job off the wall because the log write
// failed, so record() swallows its errors after logging them. The state
// change is the user's intent; the log is bookkeeping.

import { getSupabaseAdmin } from "@/lib/server/supabase";

/** Where the completion came from, which is worth knowing a year later. */
export type CompletionSource = "phone" | "wall" | "nfc";

export type SubjectKind = "upkeep" | "task" | "chore" | "care";

export interface Completion {
  id: string;
  subjectKind: SubjectKind;
  subjectId: string;
  label: string;
  completedAt: string;
  actor?: string;
  source: CompletionSource;
  value?: string;
}

const toCompletion = (r: Record<string, unknown>): Completion => ({
  id: String(r.id),
  subjectKind: String(r.subject_kind) as SubjectKind,
  subjectId: String(r.subject_id),
  label: String(r.label),
  completedAt: String(r.completed_at),
  actor: r.actor ? String(r.actor) : undefined,
  source: String(r.source) as CompletionSource,
  value: r.value ? String(r.value) : undefined,
});

export async function record(
  householdId: string,
  entry: {
    subjectKind: SubjectKind;
    subjectId: string;
    /** Stored as given: the log has to stay readable after the subject is renamed or deleted. */
    label: string;
    source?: CompletionSource;
    actor?: string | null;
    value?: string | null;
  }
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from("completions").insert({
    household_id: householdId,
    subject_kind: entry.subjectKind,
    subject_id: entry.subjectId,
    label: entry.label,
    source: entry.source ?? "phone",
    actor: entry.actor ?? null,
    value: entry.value ?? null,
  });
  if (error) console.error(`[completions] could not record ${entry.subjectKind}: ${error.message}`);
}

/** What the household has got done lately, newest first. */
export async function listCompletions(householdId: string, limit = 30): Promise<Completion[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("completions")
    .select("id,subject_kind,subject_id,label,completed_at,actor,source,value")
    .eq("household_id", householdId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error(`[completions] could not list: ${error.message}`);
    return [];
  }
  return (data ?? []).map(toCompletion);
}

/** Every time one particular thing was done — the "how often do we really" query. */
export async function completionsFor(
  householdId: string,
  subjectKind: SubjectKind,
  subjectId: string,
  limit = 50
): Promise<Completion[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("completions")
    .select("id,subject_kind,subject_id,label,completed_at,actor,source,value")
    .eq("household_id", householdId)
    .eq("subject_kind", subjectKind)
    .eq("subject_id", subjectId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error(`[completions] could not list for ${subjectKind}: ${error.message}`);
    return [];
  }
  return (data ?? []).map(toCompletion);
}

/** Care events since `sinceIso` — the day's nappies, feeds and the rest. */
export async function careSince(householdId: string, sinceIso: string): Promise<Completion[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("completions")
    .select("id,subject_kind,subject_id,label,completed_at,actor,source,value")
    .eq("household_id", householdId)
    .eq("subject_kind", "care")
    .gte("completed_at", sinceIso)
    .order("completed_at", { ascending: true });
  if (error) {
    console.error(`[completions] could not list care: ${error.message}`);
    return [];
  }
  return (data ?? []).map(toCompletion);
}
