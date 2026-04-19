import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase";

// POST /api/sync/calendar
//
// Inbound webhook from n8n. n8n receives a Google Calendar event trigger,
// transforms it to this shape, and POSTs here.
//
// Expected body:
// {
//   id: string           — Google Calendar event ID (used as row ID)
//   title: string
//   start: string        — ISO datetime
//   end: string          — ISO datetime
//   type?: string        — "appointment" | "event" | "block" | "meeting"
//   location?: string
//   notes?: string
//   agent?: string       — AgentId
// }

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.N8N_CALENDAR_WEBHOOK_SECRET;
  if (!expected) return true; // no secret configured — allow all (dev mode)
  const provided = req.headers.get("x-webhook-secret");
  return provided === expected;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySecret(req)) {
      return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
    }

    const event = body as Record<string, unknown>;
    if (!event.id || !event.title || !event.start) {
      return jsonResponse({ ok: false, error: "Missing required fields: id, title, start." }, 400);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return jsonResponse({ ok: false, error: "Supabase is not configured." }, 503);
    }

    const row = {
      id: String(event.id),
      title: String(event.title),
      start_at: String(event.start),
      end_at: event.end ? String(event.end) : null,
      type: ["appointment", "event", "block", "meeting"].includes(String(event.type))
        ? String(event.type)
        : "event",
      location: event.location ? String(event.location) : null,
      notes: event.notes ? String(event.notes) : null,
      agent: event.agent ? String(event.agent) : null,
    };

    const { error } = await supabase
      .from("calendar_events")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("Calendar sync upsert failed:", error);
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    revalidatePath("/schedule");
    revalidatePath("/");

    return jsonResponse({ ok: true, id: row.id });
  } catch (err) {
    console.error("Calendar sync error:", err);
    return jsonResponse({ ok: false, error: "Internal error." }, 500);
  }
}
