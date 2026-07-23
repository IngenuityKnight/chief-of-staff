// POST /api/jobs/payday
// Cron-invoked job to generate payday disbursement proposals
// Called by n8n or Vercel Cron on the scheduled payday dates.
//
// Signature validation: expects ?secret=PAYDAY_JOB_SECRET in query
// (configure in environment: PAYDAY_JOB_SECRET)

import { NextResponse, type NextRequest } from "next/server";
import { runPaydayForAllHouseholds } from "@/lib/server/jobs/payday";

const JOB_SECRET = process.env.PAYDAY_JOB_SECRET || "";

export async function POST(req: NextRequest) {
  // Verify the caller knows the secret
  const secret = req.nextUrl.searchParams.get("secret");
  if (!JOB_SECRET || secret !== JOB_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const results = await runPaydayForAllHouseholds();
    return NextResponse.json({
      ok: true,
      households: results.length,
      details: results.map((r) => ({
        householdId: r.householdId,
        proposalsGenerated: r.results.filter((x) => !x.error).length,
        totalGigs: r.results.reduce((sum, x) => sum + x.gigCount, 0),
        totalCents: r.results.reduce((sum, x) => sum + x.totalCents, 0),
        errors: r.results.filter((x) => x.error).length,
      })),
    });
  } catch (err) {
    console.error("Payday job failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
