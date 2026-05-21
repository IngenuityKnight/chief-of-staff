import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { revalidatePath } from "next/cache";

// GET /api/cron/bills
//
// Daily cron (9am) — scans for bills due in 1–7 days and creates inbox
// reminders for any that haven't been reminded in the past 6 days.
// Deduplicates via raw_input prefix "bill-reminder:{bill_id}".

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
  if (!supabase) return json({ ok: false, error: "Supabase not configured." }, 500);

  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86_400_000).toISOString();
    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString();

    // Bills due in 1–7 days that aren't paid or canceled
    const { data: dueBills, error } = await supabase
      .from("bills")
      .select("id, name, amount, due_date, autopay, category")
      .gte("due_date", tomorrow)
      .lte("due_date", in7Days)
      .in("status", ["due", "overdue"]);

    if (error) return json({ ok: false, error: error.message }, 500);
    if (!dueBills || dueBills.length === 0) {
      return json({ ok: true, cron: "bills", created: 0 });
    }

    // Find which bills already have a recent reminder (last 6 days)
    const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000).toISOString();
    const dedupeKeys = dueBills.map((b) => `bill-reminder:${b.id as string}`);

    const { data: existingReminders } = await supabase
      .from("inbox_items")
      .select("raw_input")
      .in("raw_input", dedupeKeys)
      .gte("created_at", sixDaysAgo);

    const alreadyReminded = new Set(
      (existingReminders ?? []).map((r: Record<string, unknown>) => r.raw_input as string)
    );

    let created = 0;
    for (const bill of dueBills as Array<Record<string, unknown>>) {
      const key = `bill-reminder:${bill.id as string}`;
      if (alreadyReminded.has(key)) continue;

      const dueDate = new Date(bill.due_date as string);
      const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000);
      const autopay = Boolean(bill.autopay);
      const name = bill.name as string;
      const amount = Number(bill.amount);

      const title = autopay
        ? `${name} autopays in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${formatMoney(amount)}`
        : `Action needed: ${name} due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${formatMoney(amount)}`;

      const analysis = autopay
        ? `${name} (${bill.category as string}) will be charged automatically on ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. No action needed unless you want to review the charge.`
        : `${name} (${bill.category as string}) is due on ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} for ${formatMoney(amount)}. Manual payment required — autopay is not enabled.`;

      await supabase.from("inbox_items").insert({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        title,
        raw_input: key,
        analysis,
        primary_agent: "money",
        secondary_agents: [],
        category: "Finance",
        needs_action: !autopay,
        proposed_tasks: autopay ? [] : [`Pay ${name} — ${formatMoney(amount)}`],
        status: "new",
        source: "auto",
        urgency: daysUntil <= 2 ? "high" : "medium",
      });
      created++;
    }

    if (created > 0) revalidatePath("/inbox");

    return json({ ok: true, cron: "bills", created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
