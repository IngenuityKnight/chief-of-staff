import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function POST(req: Request) {
  const body = await req.json() as Record<string, unknown>;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "No database" }, { status: 500 });

  const { error } = await supabase.from("household_context").upsert({
    id: "default",
    household_name: body.householdName || null,
    address: body.address || null,
    timezone: String(body.timezone || "America/Chicago"),
    frugal_mode: Boolean(body.frugalMode),
    budget_monthly: body.budgetMonthly ? Number(body.budgetMonthly) : null,
    ai_persona: body.aiPersona || null,
    goals: body.goals || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/settings");
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
