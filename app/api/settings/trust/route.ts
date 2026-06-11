// GET  /api/settings/trust          — list trust rows for the current household
// POST /api/settings/trust          — body: { agent, kind, level (0..3) }
//
// Trust levels (BACKEND-BRIEF.md §7.3):
//   0 = always ask, 1 = auto under $50, 2 = auto under $200, 3 = auto (rules permitting)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";

interface TrustRow {
  agent: string;
  kind: string;
  level: number;
  updated_at: string;
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });
  const householdId = await getCurrentHousehold();

  const { data, error } = await supabase
    .from("agent_trust")
    .select("agent, kind, level, updated_at")
    .eq("household_id", householdId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, trust: (data ?? []) as TrustRow[] });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });
  const householdId = await getCurrentHousehold();

  let body: { agent?: string; kind?: string; level?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }

  const { agent, kind, level } = body;
  if (typeof agent !== "string" || typeof kind !== "string" || typeof level !== "number") {
    return NextResponse.json({ ok: false, error: "Provide agent, kind, level." }, { status: 400 });
  }
  if (level < 0 || level > 3 || !Number.isInteger(level)) {
    return NextResponse.json({ ok: false, error: "Level must be an integer 0-3." }, { status: 400 });
  }

  const { error } = await supabase
    .from("agent_trust")
    .upsert(
      { household_id: householdId, agent, kind, level, updated_at: new Date().toISOString() },
      { onConflict: "household_id,agent,kind" },
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
