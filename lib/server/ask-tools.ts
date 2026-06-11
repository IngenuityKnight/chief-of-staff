// Read-only query tools for /api/ask — parameterized Supabase queries scoped
// to household_id. The model never writes SQL; it picks a tool and arguments,
// and the dispatcher runs the corresponding query.
//
// Output shape: { rows: Array<{ id, label, fact }>, citations: Array<{ table, id, label }> }.

import { getSupabaseAdmin } from "@/lib/server/supabase";

export interface ToolRow {
  id: string;
  label: string;     // human-readable summary for citation chips
  fact: string;      // the fact the model can quote in its answer
}

export interface ToolResult {
  ok: boolean;
  rows: ToolRow[];
  citations: Array<{ table: string; id: string; label: string }>;
  error?: string;
}

async function safeRun(table: string, fn: () => Promise<ToolRow[]>): Promise<ToolResult> {
  try {
    const rows = await fn();
    return {
      ok: true,
      rows,
      citations: rows.map((r) => ({ table, id: r.id, label: r.label })),
    };
  } catch (err) {
    return { ok: false, rows: [], citations: [], error: err instanceof Error ? err.message : "tool failed" };
  }
}

function fmtMoney(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(0)}` : "$?";
}
function fmtDate(v: unknown) {
  if (!v) return "unknown date";
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const TOOL_DEFS = [
  {
    name: "query_maintenance",
    description: "Look up household maintenance records (HVAC filter changes, oil changes, etc.). Use for 'when did we last service X' questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        item: { type: "string", description: "Item name substring (e.g. 'HVAC', 'filter')" },
      },
    },
  },
  {
    name: "query_appliances",
    description: "Look up appliances (dishwasher, water heater, oven). Use for warranty, model, last serviced.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Appliance name substring (e.g. 'dishwasher')" },
      },
    },
  },
  {
    name: "query_bills_spend",
    description: "Look up bills and recent spending. Use for 'how much do we spend on X' or 'when is the next bill'.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Bill or spending category substring" },
        days: { type: "number", description: "Look back this many days (default 90)" },
      },
    },
  },
  {
    name: "query_vehicles",
    description: "Look up vehicles — mileage, next service, insurance, registration.",
    input_schema: {
      type: "object" as const,
      properties: {
        make_or_model: { type: "string", description: "Substring of make or model" },
      },
    },
  },
  {
    name: "query_calendar",
    description: "Look up calendar events between two dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "How many days from today forward (default 14)" },
        query: { type: "string", description: "Title substring to filter" },
      },
    },
  },
  {
    name: "query_activity",
    description: "Look up recent activity events — captures, completions, decisions.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Look back this many days (default 30)" },
        query: { type: "string", description: "Substring to match against entity title" },
      },
    },
  },
] as const;

export type ToolName = (typeof TOOL_DEFS)[number]["name"];

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  householdId: string,
): Promise<ToolResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, rows: [], citations: [], error: "Supabase not configured." };

  switch (name) {
    case "query_maintenance": {
      const item = typeof args.item === "string" ? args.item : "";
      return safeRun("maintenance_items", async () => {
        let q = supabase.from("maintenance_items").select("id, item, system, last_done, next_due, vendor, last_cost").eq("household_id", householdId);
        if (item) q = q.ilike("item", `%${item}%`);
        const { data } = await q.order("last_done", { ascending: false }).limit(8);
        return ((data ?? []) as Array<Record<string, unknown>>).map((m) => ({
          id: String(m.id),
          label: `${m.item} · ${m.system}`,
          fact: `${m.item} (${m.system}) — last done ${fmtDate(m.last_done)}${m.vendor ? ` by ${m.vendor}` : ""}${m.last_cost ? ` (${fmtMoney(m.last_cost)})` : ""}, next due ${fmtDate(m.next_due)}.`,
        }));
      });
    }

    case "query_appliances": {
      const name_ = typeof args.name === "string" ? args.name : "";
      return safeRun("appliances", async () => {
        let q = supabase.from("appliances").select("id, name, brand, model_number, location, purchase_date, warranty_expires, last_serviced").eq("household_id", householdId);
        if (name_) q = q.ilike("name", `%${name_}%`);
        const { data } = await q.limit(8);
        return ((data ?? []) as Array<Record<string, unknown>>).map((a) => ({
          id: String(a.id),
          label: `${a.name}${a.brand ? ` · ${a.brand}` : ""}`,
          fact: `${a.name}${a.brand ? ` (${a.brand} ${a.model_number ?? ""})` : ""}${a.location ? ` in ${a.location}` : ""}${a.warranty_expires ? `, warranty to ${fmtDate(a.warranty_expires)}` : ""}${a.last_serviced ? `, last serviced ${fmtDate(a.last_serviced)}` : ""}.`,
        }));
      });
    }

    case "query_bills_spend": {
      const category = typeof args.category === "string" ? args.category : "";
      const days = typeof args.days === "number" ? args.days : 90;
      return safeRun("bills", async () => {
        const rows: ToolRow[] = [];
        let bq = supabase.from("bills").select("id, name, amount, due_date, autopay, status, category").eq("household_id", householdId);
        if (category) bq = bq.ilike("category", `%${category}%`);
        const { data: bills } = await bq.limit(8);
        for (const b of (bills ?? []) as Array<Record<string, unknown>>) {
          rows.push({
            id: String(b.id),
            label: `${b.name} · ${b.category ?? "bill"}`,
            fact: `${b.name}: ${fmtMoney(b.amount)} due ${fmtDate(b.due_date)} (${b.status}${b.autopay ? ", autopay" : ""}).`,
          });
        }

        const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
        let tq = supabase.from("transactions").select("id, name, amount, category, date").eq("household_id", householdId).gte("date", since);
        if (category) tq = tq.ilike("category", `%${category}%`);
        const { data: txns } = await tq.limit(8);
        for (const t of (txns ?? []) as Array<Record<string, unknown>>) {
          rows.push({
            id: String(t.id),
            label: `${t.name} · ${t.category ?? ""}`.trim(),
            fact: `${t.name} ${fmtMoney(t.amount)} on ${fmtDate(t.date)}.`,
          });
        }
        return rows;
      });
    }

    case "query_vehicles": {
      const q_ = typeof args.make_or_model === "string" ? args.make_or_model : "";
      return safeRun("vehicles", async () => {
        let q = supabase.from("vehicles").select("id, make, model, year, mileage, next_service_type, next_service_miles, insurance_expires, registration_expires").eq("household_id", householdId);
        if (q_) q = q.or(`make.ilike.%${q_}%,model.ilike.%${q_}%`);
        const { data } = await q.limit(6);
        return ((data ?? []) as Array<Record<string, unknown>>).map((v) => ({
          id: String(v.id),
          label: `${v.year} ${v.make} ${v.model}`,
          fact: `${v.year} ${v.make} ${v.model}${v.mileage ? ` at ${v.mileage} mi` : ""}${v.next_service_type ? `, next: ${v.next_service_type}${v.next_service_miles ? ` @ ${v.next_service_miles} mi` : ""}` : ""}${v.insurance_expires ? `, insurance to ${fmtDate(v.insurance_expires)}` : ""}.`,
        }));
      });
    }

    case "query_calendar": {
      const days = typeof args.days === "number" ? args.days : 14;
      const query = typeof args.query === "string" ? args.query : "";
      return safeRun("calendar_events", async () => {
        const from = new Date().toISOString();
        const to = new Date(Date.now() + days * 86_400_000).toISOString();
        let q = supabase.from("calendar_events").select("id, title, start_at, end_at, location").eq("household_id", householdId).gte("start_at", from).lte("start_at", to);
        if (query) q = q.ilike("title", `%${query}%`);
        const { data } = await q.order("start_at").limit(15);
        return ((data ?? []) as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id),
          label: String(e.title),
          fact: `${e.title} on ${fmtDate(e.start_at)} at ${new Date(e.start_at as string).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}${e.location ? ` (${e.location})` : ""}.`,
        }));
      });
    }

    case "query_activity": {
      const days = typeof args.days === "number" ? args.days : 30;
      const query = typeof args.query === "string" ? args.query : "";
      return safeRun("activity_log", async () => {
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        let q = supabase.from("activity_log").select("id, event_type, domain, entity_title, occurred_at").eq("household_id", householdId).gte("occurred_at", since);
        if (query) q = q.ilike("entity_title", `%${query}%`);
        const { data } = await q.order("occurred_at", { ascending: false }).limit(20);
        return ((data ?? []) as Array<Record<string, unknown>>).map((a) => ({
          id: String(a.id),
          label: `${a.event_type} · ${a.entity_title}`,
          fact: `${fmtDate(a.occurred_at)}: ${a.event_type} — ${a.entity_title}.`,
        }));
      });
    }

    default:
      return { ok: false, rows: [], citations: [], error: `Unknown tool ${name}.` };
  }
}
