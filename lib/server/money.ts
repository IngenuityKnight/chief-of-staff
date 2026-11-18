// What recurs, as last read from Monarch.
//
// Read-only on purpose. Monarch owns the money; this app's job is to make
// sure you know what is coming without opening it, not to track it a second
// time. Nothing here is tickable and nothing becomes a task — most of these
// are autopay and need nobody, and a row that appears on its own and has to
// be dismissed teaches you to dismiss without reading.

import { getSupabaseAdmin } from "@/lib/server/supabase";

export interface Recurring {
  id: string;
  kind: "income" | "expense";
  name: string;
  amount: number;
  frequency?: string;
  nextDate?: string;
}

export interface RecurringSnapshot {
  items: Recurring[];
  /** When this was last read from Monarch. Shown, never hidden. */
  capturedAt?: string;
  /** Days since that read, for deciding whether to say so loudly. */
  ageDays?: number;
}

/**
 * Everything due between `from` and `to`, plus how old the snapshot is.
 * The window is the caller's: the dashboard wants a week, a monthly view
 * would want a month.
 */
export async function recurringBetween(
  householdId: string,
  from: string,
  to: string
): Promise<RecurringSnapshot> {
  const sb = getSupabaseAdmin();
  if (!sb) return { items: [] };

  const { data, error } = await sb
    .from("recurring_snapshot")
    .select("id,kind,name,amount,frequency,next_date,captured_at")
    .eq("household_id", householdId)
    .order("next_date", { ascending: true });

  if (error) {
    console.error(`[money] could not read the snapshot: ${error.message}`);
    return { items: [] };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return { items: [] };

  const capturedAt = String(rows[0].captured_at);
  const ageDays = Math.floor((Date.now() - new Date(capturedAt).getTime()) / 86_400_000);

  const items = rows
    .filter((r) => {
      const d = r.next_date ? String(r.next_date).slice(0, 10) : null;
      return d !== null && d >= from && d <= to;
    })
    .map((r) => ({
      id: String(r.id),
      kind: String(r.kind) as "income" | "expense",
      name: String(r.name),
      amount: Number(r.amount),
      frequency: r.frequency ? String(r.frequency) : undefined,
      nextDate: String(r.next_date).slice(0, 10),
    }));

  return { items, capturedAt, ageDays };
}

/**
 * How stale is too stale. Recurring schedules barely move, so a month-old
 * read is still broadly true; past six weeks the dates have probably drifted
 * and the strip should say so rather than quietly mislead.
 */
export const SNAPSHOT_STALE_DAYS = 45;
