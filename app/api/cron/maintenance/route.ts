import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { logActivity } from "@/lib/server/activity";
import { getVehicles } from "@/lib/server/data";

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

    // Auto-create maintenance items from vehicle state
    const vehicles = await getVehicles();
    for (const vehicle of vehicles) {
      const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      const checks: { title: string; condition: boolean; priority: "high" | "medium" }[] = [];

      // Oil change
      if (vehicle.mileage && vehicle.lastOilChangeMiles) {
        const milesSince = vehicle.mileage - vehicle.lastOilChangeMiles;
        if (milesSince >= vehicle.oilChangeIntervalMiles) {
          checks.push({ title: `Oil change — ${label}`, condition: true, priority: "high" });
        }
      }

      // Next scheduled service
      if (vehicle.nextServiceType && vehicle.nextServiceMiles && vehicle.mileage &&
          vehicle.mileage >= vehicle.nextServiceMiles) {
        checks.push({ title: `${vehicle.nextServiceType} — ${label}`, condition: true, priority: "medium" });
      }

      // Insurance expiry
      if (vehicle.insuranceExpires) {
        const daysLeft = Math.floor((new Date(vehicle.insuranceExpires).getTime() - Date.now()) / 86_400_000);
        if (daysLeft <= 30) {
          checks.push({ title: `Insurance renewal — ${label}`, condition: true, priority: daysLeft <= 7 ? "high" : "medium" });
        }
      }

      // Registration expiry
      if (vehicle.registrationExpires) {
        const daysLeft = Math.floor((new Date(vehicle.registrationExpires).getTime() - Date.now()) / 86_400_000);
        if (daysLeft <= 30) {
          checks.push({ title: `Registration renewal — ${label}`, condition: true, priority: daysLeft <= 7 ? "high" : "medium" });
        }
      }

      for (const check of checks) {
        // Skip if an open maintenance item with this title already exists
        const { data: existing } = await supabase
          .from("maintenance_items")
          .select("id, status")
          .ilike("item", check.title)
          .in("status", ["due-soon", "overdue", "in-progress"])
          .maybeSingle();

        if (existing) continue;

        const nextDue = new Date().toISOString();
        const { error: maintError } = await supabase.from("maintenance_items").insert({
          id: crypto.randomUUID(),
          item: check.title,
          system: "Vehicle",
          frequency: "annual",
          last_done: new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10),
          next_due: nextDue,
          status: "overdue",
          auto_create_task: true,
          created_at: new Date().toISOString(),
        });

        if (!maintError) {
          created++;
          await logActivity({
            event_type: "maintenance_task_created",
            domain: "maintenance",
            entity_title: check.title,
            entity_id: vehicle.id,
            metadata: { source: "vehicle_check" },
          });
        }
      }
    }

    // Appliance warranty alerts
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const { data: expiringAppliances } = await supabase
      .from("appliances")
      .select("id, name, warranty_expires")
      .not("warranty_expires", "is", null)
      .lte("warranty_expires", thirtyDaysFromNow);

    for (const appliance of (expiringAppliances ?? []) as Array<Record<string, unknown>>) {
      const dedupKey = `appliance-warranty:${appliance.id as string}`;
      const { data: alreadyNotified } = await supabase
        .from("inbox_items")
        .select("id")
        .like("raw_input", `${dedupKey}%`)
        .gte("created_at", new Date(Date.now() - 25 * 86_400_000).toISOString())
        .maybeSingle();

      if (alreadyNotified) continue;

      const daysLeft = Math.floor(
        (new Date(appliance.warranty_expires as string).getTime() - Date.now()) / 86_400_000
      );
      const isExpired = daysLeft < 0;
      const title = isExpired
        ? `Warranty expired: ${appliance.name as string}`
        : `Warranty expiring in ${daysLeft}d: ${appliance.name as string}`;

      const inboxId = crypto.randomUUID();
      await supabase.from("inbox_items").insert({
        id: inboxId,
        title,
        raw_input: `${dedupKey}\nAppliance: ${appliance.name as string}. Warranty expires: ${appliance.warranty_expires as string}.`,
        analysis: isExpired
          ? `The warranty on ${appliance.name as string} has expired. Consider an extended plan or note it's now out of coverage.`
          : `The warranty on ${appliance.name as string} expires in ${daysLeft} days (${appliance.warranty_expires as string}). Consider extended warranty or service plan.`,
        primary_agent: "home",
        secondary_agents: ["money"],
        category: "Household",
        needs_action: true,
        proposed_tasks: isExpired ? [] : [`Research extended warranty for ${appliance.name as string}`],
        status: "routed",
        source: "system",
        urgency: daysLeft <= 7 ? "high" : "medium",
        created_at: new Date().toISOString(),
      });

      await logActivity({
        event_type: "item_captured",
        domain: "inbox",
        entity_title: title,
        entity_id: inboxId,
        metadata: { appliance_id: appliance.id, days_left: daysLeft },
      });

      created++;
    }

    return json({ ok: true, cron: "maintenance", created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
}
