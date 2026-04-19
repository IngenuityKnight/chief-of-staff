import { NextRequest, NextResponse } from "next/server";
import { requireEditorPassword } from "@/lib/server/admin";
import { createGCalEvent, isGoogleCalendarConfigured } from "@/lib/server/google-calendar";
import type { CalendarEvent } from "@/lib/types";

// POST /api/sync/calendar/outbound
//
// Called from the inline calendar form after a new event is inserted into Supabase.
// Creates a corresponding event in Google Calendar using the service account.
//
// Body: { event: CalendarEvent }
// Headers: x-editor-password

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get("x-editor-password");
    requireEditorPassword(password);

    if (!isGoogleCalendarConfigured()) {
      // Not an error — Google Calendar may not be set up yet. Return gracefully.
      return jsonResponse({ ok: true, gcalId: null, skipped: "Google Calendar not configured." });
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
    }

    const { event } = body as { event?: CalendarEvent };
    if (!event || !event.title || !event.start) {
      return jsonResponse({ ok: false, error: "Missing event data." }, 400);
    }

    const result = await createGCalEvent(event);
    return jsonResponse({ ok: true, gcalId: result?.gcalId ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    const status = message.includes("password") ? 401 : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }
}
