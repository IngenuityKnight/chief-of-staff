import { type NextRequest, NextResponse } from "next/server";
import { generateDailyBriefing } from "@/lib/server/briefing";

// GET  /api/jobs/briefing  — Vercel Cron (daily 07:00)
// POST /api/jobs/briefing  — n8n or manual trigger
//
// Protected by CRON_SECRET. Idempotent — upserts on date.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const briefing = await generateDailyBriefing();
    if (!briefing) {
      return NextResponse.json({ ok: false, error: "Supabase or Anthropic not configured." }, { status: 503 });
    }
    return NextResponse.json(
      { ok: true, date: briefing.date, headline: briefing.headline },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export { handle as GET, handle as POST };
