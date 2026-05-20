import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { logActivity } from "@/lib/server/activity";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json({ ok: false, error: "Supabase not configured." }, 500);
  }

  try {
    const now = new Date().toISOString();

    const { data: overdueItems, error } = await supabase
      .from("maintenance_items")
      .select("id, item, system, frequency, next_due, last_task_id")
      .eq("auto_create_task", true)
      .lte("next_due", now)
      .in("status", ["overdue", "due-soon"]);

    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }

    if (!overdueItems || overdueItems.length === 0) {
      return json({ ok: true, cron: "maintenance", created: 0 });
    }

    let created = 0;

    for (const item of overdueItems as Array<Record<string, unknown>>) {
      const taskId = crypto.randomUUID();
      const title = `${item.item} — ${item.frequency} maintenance`;

      const { error: taskError } = await supabase.from("tasks").insert({
        id: taskId,
        title,
        agent: "home",
        category: "Household",
        status: "todo",
        priority: "high",
        notes: `Auto-created by maintenance cron. System: ${item.system}. Due: ${item.next_due}`,
        created_at: new Date().toISOString(),
      });

      if (taskError) {
        console.error("Failed to create maintenance task:", taskError.message);
        continue;
      }

      await supabase
        .from("maintenance_items")
        .update({ last_task_id: taskId })
        .eq("id", item.id);

      await logActivity({
        event_type: "maintenance_task_created",
        domain: "maintenance",
        entity_title: title,
        entity_id: String(item.id),
        metadata: { task_id: taskId, system: item.system },
      });

      created++;
    }

    return json({ ok: true, cron: "maintenance", created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
}
