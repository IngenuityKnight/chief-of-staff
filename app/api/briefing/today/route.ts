import { NextResponse } from "next/server";
import { getTodaysBriefing, generateDailyBriefing } from "@/lib/server/briefing";
import { getCurrentHousehold } from "@/lib/server/household";

// GET /api/briefing/today
// Returns today's stored briefing. If none exists yet, generates one on demand.

export async function GET() {
  const householdId = await getCurrentHousehold();
  if (!householdId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  let briefing = await getTodaysBriefing(householdId);

  if (!briefing) {
    briefing = await generateDailyBriefing(householdId);
  }

  if (!briefing) {
    return NextResponse.json({ ok: false, error: "Briefing unavailable." }, { status: 503 });
  }

  return NextResponse.json(
    { ok: true, briefing },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
