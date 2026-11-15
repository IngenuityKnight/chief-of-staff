// Everything the household would want back if this app and its database both
// went away. Read-only, scoped to one household, no interpretation: whatever
// is in the row goes in the file.
//
// The point is survivability, so the output is deliberately boring. CSV opens
// in any spreadsheet on any machine in twenty years; JSON keeps the exact
// values for a restore. Neither needs this codebase to be readable.

import { getSupabaseAdmin } from "@/lib/server/supabase";

/**
 * The tables worth keeping, with the column each is most usefully ordered by.
 * Append-only logs come first: they are the ones that cannot be reconstructed
 * from anything else.
 */
export const EXPORT_TABLES: ReadonlyArray<{ table: string; orderBy: string }> = [
  { table: "completions", orderBy: "completed_at" },
  { table: "tap_events", orderBy: "created_at" },
  { table: "vehicle_logs", orderBy: "log_date" },
  { table: "vehicles", orderBy: "year" },
  { table: "vehicle_services", orderBy: "item" },
  { table: "maintenance_items", orderBy: "next_due" },
  // The app no longer has a Bills section — Monarch and EveryDollar own that
  // ground, and a second ledger nobody trusted had been silently wrong since
  // July. The table stays, and stays exported, because sixteen rows of what
  // the household owed and when is history worth keeping even though nothing
  // reads it any more. Do not remove this line while the table exists.
  { table: "bills", orderBy: "due_date" },
  { table: "routine_items", orderBy: "time_of_day" },
  { table: "tasks", orderBy: "due_date" },
  { table: "meal_plan_days", orderBy: "date" },
];

export interface ExportFile {
  filename: string;
  csv: string;
  rows: number;
}

/** RFC 4180: quote when the value could otherwise break the row or column. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  // Union of keys rather than the first row's, so a nullable column that only
  // appears later is not silently dropped from the file.
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => cell(row[h])).join(","));
  return lines.join("\r\n");
}

export async function exportHousehold(householdId: string): Promise<ExportFile[]> {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("The household database isn't configured.");

  const out: ExportFile[] = [];
  for (const { table, orderBy } of EXPORT_TABLES) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("household_id", householdId)
      .order(orderBy, { ascending: true, nullsFirst: false });

    // One missing or renamed table must not cost you the other eight files.
    if (error) {
      out.push({ filename: `${table}.csv`, csv: `error,${cell(error.message)}`, rows: 0 });
      continue;
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    out.push({ filename: `${table}.csv`, csv: toCsv(rows), rows: rows.length });
  }
  return out;
}

/** The same data as one JSON document, for restoring rather than reading. */
export async function exportHouseholdJson(householdId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("The household database isn't configured.");

  const payload: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    household_id: householdId,
  };
  for (const { table, orderBy } of EXPORT_TABLES) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("household_id", householdId)
      .order(orderBy, { ascending: true, nullsFirst: false });
    payload[table] = error ? { error: error.message } : (data ?? []);
  }
  return JSON.stringify(payload, null, 2);
}
