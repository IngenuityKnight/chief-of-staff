import { NextRequest, NextResponse } from "next/server";
import { revalidateAdminPaths } from "@/lib/server/admin";
import { getSupabaseAdmin } from "@/lib/server/supabase";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

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

    const { data: inboxItem, error: fetchError } = await supabase
      .from("inbox_items")
      .select("id, primary_agent, category, urgency, proposed_tasks")
      .eq("id", inboxItemId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!inboxItem) {
      return NextResponse.json({ ok: false, error: "Inbox item not found." }, { status: 404 });
    }

    const proposedTasks = asStringArray(inboxItem.proposed_tasks);
    if (proposedTasks.length > 0) {
      const now = new Date().toISOString();
      const inserts = proposedTasks.map((title) => ({
        id: crypto.randomUUID(),
        title,
        agent: inboxItem.primary_agent,
        category: inboxItem.category,
        status: "todo",
        priority: inboxItem.urgency,
        inbox_item_id: inboxItemId,
        created_at: now,
      }));

      const { error: insertError } = await supabase.from("tasks").insert(inserts);
      if (insertError) throw new Error(insertError.message);
    }

    const { error: updateError } = await supabase
      .from("inbox_items")
      .update({ status: "processed", needs_action: false })
      .eq("id", inboxItemId);

    if (updateError) throw new Error(updateError.message);

    revalidateAdminPaths();

    return NextResponse.json(
      { ok: true, tasksCreated: proposedTasks.length },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
