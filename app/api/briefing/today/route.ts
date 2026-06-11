import { NextResponse } from "next/server";
import { getTodaysBriefing, generateDailyBriefing } from "@/lib/server/briefing";

// GET /api/briefing/today
// Returns today's stored briefing. If none exists yet, generates one on demand.

export async function GET() {
  let briefing = await getTodaysBriefing();

  if (!briefing) {
    briefing = await generateDailyBriefing();
  }

  if (!briefing) {
    return NextResponse.json({ ok: false, error: "Briefing unavailable." }, { status: 503 });
  }

  return NextResponse.json(
    { ok: true, briefing },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
