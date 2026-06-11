// POST /api/proposals/:id/edit
//
// Amend an awaiting_approval proposal's payload before approving. Body:
//   { payload?: Record<string, unknown>, title?: string, rationale?: string,
//     estimatedCostCents?: number, approve?: boolean }
//
// If `approve: true`, the executor runs against the new payload immediately.
// Edits are recorded in events for audit.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { executeProposal } from "@/lib/server/agents/executors";

interface EditBody {
  payload?: Record<string, unknown>;
  title?: string;
  rationale?: string;
  estimatedCostCents?: number;
  approve?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured." }, { status: 503 });
  }

  let body: EditBody;
  try {
    body = (await req.json()) as EditBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }

  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("id, kind, payload, title, rationale, estimated_cost_cents, inbox_item_id, status, household_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!proposal) return NextResponse.json({ ok: false, error: "Proposal not found." }, { status: 404 });
  if (proposal.status !== "awaiting_approval") {
    return NextResponse.json({ ok: false, error: `Proposal is already ${proposal.status}.` }, { status: 409 });
  }

  const patch: Record<string, unknown> = {};
  if (body.payload && typeof body.payload === "object") patch.payload = body.payload;
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.rationale === "string") patch.rationale = body.rationale;
  if (typeof body.estimatedCostCents === "number") patch.estimated_cost_cents = Math.max(0, body.estimatedCostCents);

  if (Object.keys(patch).length === 0 && !body.approve) {
    return NextResponse.json({ ok: false, error: "Nothing to edit." }, { status: 400 });
  }

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from("proposals").update(patch).eq("id", id);
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    await supabase.from("events").insert({
      household_id: proposal.household_id,
      type: "proposal.edited",
      entity_id: id,
      payload: { fields: Object.keys(patch) },
    });
  }

  if (body.approve) {
    const merged = {
      id: proposal.id,
      kind: proposal.kind,
      payload: (patch.payload ?? proposal.payload) as Record<string, unknown>,
      inbox_item_id: proposal.inbox_item_id,
      household_id: proposal.household_id as string,
    };
    const result = await executeProposal(merged, "user");
    return NextResponse.json({ ok: result.ok, proposalId: id, executed: result.ok, error: result.error });
  }

  return NextResponse.json({ ok: true, proposalId: id, executed: false });
}
