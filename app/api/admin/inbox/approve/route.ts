import { NextRequest, NextResponse } from "next/server";
import { revalidateAdminPaths } from "@/lib/server/admin";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { executeProposal } from "@/lib/server/agents/executors";

// Approves all awaiting_approval proposals for an inbox item,
// executes each through the typed executor, and marks the item processed.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { inboxItemId } = body as { inboxItemId?: string };
    if (!inboxItemId || typeof inboxItemId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing inboxItemId." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 400 });
    }

    const { data: proposals, error: fetchError } = await supabase
      .from("proposals")
      .select("id, kind, payload, inbox_item_id, household_id")
      .eq("inbox_item_id", inboxItemId)
      .eq("status", "awaiting_approval");

    if (fetchError) throw new Error(fetchError.message);

    let executedCount = 0;
    for (const proposal of proposals ?? []) {
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
      if (result.ok) executedCount++;
    }

    const { error: itemUpdateError } = await supabase
      .from("inbox_items")
      .update({ status: "processed", needs_action: false })
      .eq("id", inboxItemId);

    if (itemUpdateError) throw new Error(itemUpdateError.message);

    revalidateAdminPaths();

    return NextResponse.json(
      { ok: true, executedCount },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
