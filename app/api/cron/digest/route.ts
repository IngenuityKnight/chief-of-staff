import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { logActivity } from "@/lib/server/activity";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return json({ ok: false, error: "Unauthorized" }, 401);

  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ ok: false, error: "Supabase not configured" }, 500);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Dedup — skip if we already sent a digest today
  const { data: existing } = await supabase
    .from("inbox_items")
    .select("id")
    .like("raw_input", `digest:${today}%`)
    .maybeSingle();

  if (existing) return json({ ok: true, skipped: "already sent today" });

  const [
    { data: unreviewed },
    { data: overdueTasks },
    { data: billsDue },
    { data: lowStock },
  ] = await Promise.all([
    supabase.from("inbox_items").select("id").eq("status", "new"),
    supabase
      .from("tasks")
      .select("title")
      .neq("status", "done")
      .lt("due_date", now.toISOString()),
    supabase
      .from("bills")
      .select("name, due_date, amount")
      .neq("status", "paid")
      .lte("due_date", new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)),
    supabase
      .from("inventory_items")
      .select("name, quantity, min_quantity")
      .not("min_quantity", "is", null)
      .filter("quantity", "lte", "min_quantity"),
  ]);

  const lines: string[] = [];

  const unreviewedCount = unreviewed?.length ?? 0;
  const overdueCount = overdueTasks?.length ?? 0;
  const billsCount = billsDue?.length ?? 0;
  const lowStockCount = lowStock?.length ?? 0;

  if (unreviewedCount === 0 && overdueCount === 0 && billsCount === 0 && lowStockCount === 0) {
    return json({ ok: true, skipped: "nothing to report" });
  }

  lines.push(`Evening digest for ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}:`);

  if (unreviewedCount > 0) {
    lines.push(`• ${unreviewedCount} unreviewed inbox item${unreviewedCount > 1 ? "s" : ""} waiting`);
  }
  if (overdueCount > 0) {
    const titles = (overdueTasks ?? []).slice(0, 3).map((t) => t.title as string);
    lines.push(`• ${overdueCount} overdue task${overdueCount > 1 ? "s" : ""}: ${titles.join(", ")}${overdueCount > 3 ? "…" : ""}`);
  }
  if (billsCount > 0) {
    const names = (billsDue ?? []).slice(0, 3).map((b) => b.name as string);
    lines.push(`• ${billsCount} bill${billsCount > 1 ? "s" : ""} due within 3 days: ${names.join(", ")}`);
  }
  if (lowStockCount > 0) {
    const names = (lowStock ?? []).slice(0, 4).map((i) => i.name as string);
    lines.push(`• ${lowStockCount} inventory item${lowStockCount > 1 ? "s" : ""} low: ${names.join(", ")}${lowStockCount > 4 ? "…" : ""}`);
  }

  const summary = lines.join("\n");
  const id = crypto.randomUUID();

  await supabase.from("inbox_items").insert({
    id,
    title: `Evening digest — ${overdueCount > 0 ? `${overdueCount} overdue` : billsCount > 0 ? `${billsCount} bills due soon` : `${unreviewedCount} unreviewed`}`,
    raw_input: `digest:${today}\n${summary}`,
    analysis: summary,
    primary_agent: "chief",
    secondary_agents: [],
    category: "Admin",
    needs_action: overdueCount > 0 || billsCount > 0,
    proposed_tasks: [],
    status: "routed",
    source: "system",
    urgency: overdueCount > 0 || billsCount > 0 ? "medium" : "low",
    created_at: now.toISOString(),
  });

  await logActivity({
    event_type: "item_captured",
    domain: "inbox",
    entity_title: "Evening digest",
    entity_id: id,
    metadata: { unreviewed: unreviewedCount, overdue: overdueCount, bills: billsCount, low_stock: lowStockCount },
  });

  return json({ ok: true, sent: true });
}
