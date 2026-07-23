import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";

// POST /api/proposals/:id/decline

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });
  }

  const householdId = await getCurrentHousehold();
  if (!householdId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("id, status")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  }
  if (!proposal) {
    return NextResponse.json({ ok: false, error: "Proposal not found." }, { status: 404 });
  }
  if (proposal.status !== "awaiting_approval") {
    return NextResponse.json({ ok: false, error: `Proposal is already ${proposal.status}.` }, { status: 409 });
  }

  const { error } = await supabase
    .from("proposals")
    .update({ status: "declined", decided_by: "user", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("household_id", householdId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, proposalId: id },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
