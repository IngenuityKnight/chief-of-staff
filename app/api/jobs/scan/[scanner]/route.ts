import { type NextRequest, NextResponse } from "next/server";
import { runScanner, SCANNER_NAMES } from "@/lib/server/scanners";

// GET  /api/jobs/scan/:scanner  — Vercel Cron (uses GET)
// POST /api/jobs/scan/:scanner  — n8n or manual trigger
//
// Protected by CRON_SECRET. Idempotent — scanners deduplicate internally.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ scanner: string }> }
) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { scanner } = await params;

  if (!SCANNER_NAMES.includes(scanner as typeof SCANNER_NAMES[number])) {
    return NextResponse.json(
      { ok: false, error: `Unknown scanner "${scanner}". Valid: ${SCANNER_NAMES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const result = await runScanner(scanner);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, scanner, error: message }, { status: 500 });
  }
}

export { handle as GET, handle as POST };
