import { NextRequest, NextResponse } from "next/server";
import type { AdminResource } from "@/lib/server/admin";
import { updateAdminResource } from "@/lib/server/admin";
import { logActivity } from "@/lib/server/activity";
import { getSupabaseAdmin } from "@/lib/server/supabase";

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function handleSideEffects(
  resource: string,
  id: string,
  values: Record<string, unknown>
): Promise<void> {
  if (resource === "tasks" && values.status !== undefined) {
    await logActivity({
      event_type: "task_status_changed",
      domain: "tasks",
      entity_title: typeof values.title === "string" ? values.title : id,
      entity_id: id,
      metadata: { status: values.status },
    });

    // Spawn next instance for recurring tasks when marked done
    if (values.status === "done") {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const { data: task } = await supabase
            .from("tasks")
            .select("title, agent, category, priority, recurring_rule, due_date")
            .eq("id", id)
            .single();

          if (task?.recurring_rule) {
            const intervalDays: Record<string, number> = {
              daily: 1, weekly: 7, "every-2-weeks": 14, monthly: 30, quarterly: 91,
            };
            const days = intervalDays[task.recurring_rule as string] ?? 7;
            const nextDue = new Date(Date.now() + days * 86_400_000).toISOString();

            await supabase.from("tasks").insert({
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
              title: task.title,
              agent: task.agent,
              category: task.category,
              status: "todo",
              priority: task.priority,
              recurring_rule: task.recurring_rule,
              due_date: nextDue,
              notes: `Auto-created from recurring rule: ${task.recurring_rule as string}`,
            });
          }
        } catch {
          // non-critical
        }
      }
    }
  }

  if (resource === "decisions" && values.status !== undefined && values.status !== "open") {
    await logActivity({
      event_type: "decision_resolved",
      domain: "decisions",
      entity_title: typeof values.title === "string" ? values.title : id,
      entity_id: id,
      metadata: {
        status: values.status,
        chosen_option: values.chosenOption ?? null,
      },
    });
  }

  if (resource === "maintenance" && values.status === "ok" && values.lastDone !== undefined) {
    await logActivity({
      event_type: "maintenance_completed",
      domain: "maintenance",
      entity_title: typeof values.item === "string" ? values.item : id,
      entity_id: id,
      metadata: { last_done: values.lastDone },
    });
  }

  if (resource === "maintenance" && (values.status === "overdue" || values.status === "due-soon")) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: maint } = await supabase
          .from("maintenance_items")
          .select("item, system, last_task_id")
          .eq("id", id)
          .single();

        if (maint) {
          const itemTitle = typeof values.item === "string" ? values.item : (maint.item as string);
          let hasOpenTask = false;
          if (maint.last_task_id) {
            const { data: existingTask } = await supabase
              .from("tasks")
              .select("status")
              .eq("id", maint.last_task_id)
              .single();
            hasOpenTask = existingTask?.status !== "done";
          }

          if (!hasOpenTask) {
            const newTaskId = crypto.randomUUID();
            await supabase.from("tasks").insert({
              id: newTaskId,
              created_at: new Date().toISOString(),
              title: `${itemTitle} — maintenance ${values.status === "overdue" ? "overdue" : "due soon"}`,
              agent: "home",
              category: "Household",
              status: "todo",
              priority: values.status === "overdue" ? "high" : "medium",
              notes: `Auto-created from maintenance tracker (system: ${maint.system as string})`,
            });
            await supabase
              .from("maintenance_items")
              .update({ last_task_id: newTaskId })
              .eq("id", id);
            await logActivity({
              event_type: "maintenance_task_created",
              domain: "maintenance",
              entity_title: itemTitle,
              entity_id: id,
              metadata: { task_id: newTaskId, status: values.status },
            });
          }
        }
      } catch {
        // non-critical
      }
    }
  }

  if (resource === "shopping" && values.status === "purchased") {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: item } = await supabase
          .from("shopping_list_items")
          .select("inventory_item_id, quantity, name")
          .eq("id", id)
          .single();

        if (item && item.inventory_item_id) {
          const { data: inv } = await supabase
            .from("inventory_items")
            .select("quantity")
            .eq("id", item.inventory_item_id)
            .single();

          if (inv) {
            await supabase
              .from("inventory_items")
              .update({ quantity: Number(inv.quantity) + Number(item.quantity) })
              .eq("id", item.inventory_item_id);

            await logActivity({
              event_type: "inventory_restocked",
              domain: "inventory",
              entity_title: item.name as string,
              entity_id: item.inventory_item_id as string,
              metadata: { quantity_added: item.quantity, via: "shopping_list" },
            });
          }
        }
      } catch {
        // non-critical
      }
    }
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const { resource, id } = await params;
    const decodedId = decodeURIComponent(id);

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ ok: false, error: "Body must be a JSON object." }, 400);
    }

    const values = (body as { values?: unknown }).values;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      return response({ ok: false, error: "Field `values` must be an object." }, 400);
    }

    const valuesObj = values as Record<string, unknown>;

    await updateAdminResource(resource as AdminResource, decodedId, valuesObj);
    await handleSideEffects(resource, decodedId, valuesObj);

    return response({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    return response({ ok: false, error: message }, 400);
  }
}
