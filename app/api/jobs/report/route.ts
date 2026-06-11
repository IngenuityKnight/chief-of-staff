// GET/POST /api/jobs/report
//
// Sunday-evening Chief's Report — synthesizes the week, stores it, optionally
// emails via Resend. NEXT-LEVEL-BRIEF.md F5.

import { type NextRequest, NextResponse } from "next/server";
import { generateChiefsReport } from "@/lib/server/sunday-report";

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
    const report = await generateChiefsReport();
    if (!report) return NextResponse.json({ ok: false, error: "Supabase unavailable." }, { status: 503 });
    return NextResponse.json({
      ok: true,
      weekEnd: report.weekEnd,
      headline: report.headline,
      metrics: report.metrics,
      suggestedUpgrade: report.suggestedUpgrade,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error." }, { status: 500 });
  }
}

export { handle as GET, handle as POST };
