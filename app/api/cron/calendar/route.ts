import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { revalidatePath } from "next/cache";
import { getOAuthClient } from "@/lib/server/google-calendar";
import { getSupabaseAdmin } from "@/lib/server/supabase";

// GET /api/cron/calendar
//
// Polls Google Calendar for events created or updated in the last 15 minutes
// (cron runs every 10 min — 5 min overlap prevents gaps), then upserts them
// into the calendar_events Supabase table.
//
// Invoked every 10 minutes by Vercel Cron. Secured with CRON_SECRET.

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow all (dev mode)
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const auth = getOAuthClient();
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN." },
      { status: 503 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured." },
      { status: 503 }
    );
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  const calendar = google.calendar({ version: "v3", auth });

  // 15-minute window — wider than cron interval to avoid gaps on missed runs
  const updatedMin = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data } = await calendar.events.list({
    calendarId,
    updatedMin,
    singleEvents: true,
    maxResults: 50,
    orderBy: "updated",
  });

  const events = data.items ?? [];
  let upserted = 0;
  let deleted = 0;
  const errors: string[] = [];

  for (const event of events) {
    if (!event.id) continue;

    try {
      if (event.status === "cancelled") {
        await supabase.from("calendar_events").delete().eq("id", event.id);
        deleted++;
        continue;
      }

      if (!event.summary) continue;

      const start = event.start?.dateTime ?? event.start?.date ?? "";
      const end = event.end?.dateTime ?? event.end?.date ?? start;

      if (!start) continue;

      const { error } = await supabase.from("calendar_events").upsert(
        {
          id: event.id,
          title: event.summary,
          start_at: start,
          end_at: end,
          type: "event",
          location: event.location ?? null,
          notes: event.description ?? null,
          agent: null,
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error(`[cron/calendar] Upsert failed for event ${event.id}:`, error);
        errors.push(event.id);
      } else {
        upserted++;
      }
    } catch (err) {
      console.error(`[cron/calendar] Failed to process event ${event.id}:`, err);
      errors.push(event.id!);
    }
  }

  if (upserted > 0 || deleted > 0) {
    revalidatePath("/schedule");
    revalidatePath("/");
  }

  return NextResponse.json({
    ok: true,
    upserted,
    deleted,
    errors: errors.length,
  });
}
