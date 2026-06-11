import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { executeProposal } from "@/lib/server/agents/executors";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });
  }

  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("id, kind, payload, inbox_item_id, status, household_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!proposal) return NextResponse.json({ ok: false, error: "Proposal not found." }, { status: 404 });
  if (proposal.status !== "awaiting_approval") {
    return NextResponse.json({ ok: false, error: `Proposal is already ${proposal.status}.` }, { status: 409 });
  }

  const result = await executeProposal(
    {
      id: proposal.id,
      kind: proposal.kind,
      payload: proposal.payload as Record<string, unknown>,
      inbox_item_id: proposal.inbox_item_id,
      household_id: proposal.household_id as string,
    },
    "user",
  );

  return NextResponse.json(
    { ok: result.ok, proposalId: id, error: result.error },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
