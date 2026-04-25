import { NextRequest, NextResponse } from "next/server";
import { findLocations, isKrogerConfigured } from "@/lib/server/kroger";

// GET /api/kroger/locations?zip=21044&radius=10
//
// Find Kroger-family stores near a zip code.
// Use this to discover your KROGER_LOCATION_ID for the env var.

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(req: NextRequest) {
  if (!isKrogerConfigured()) {
    return json({ ok: false, error: "Kroger API is not configured." }, 503);
  }

  const zip    = req.nextUrl.searchParams.get("zip") ?? "";
  const radius = Number(req.nextUrl.searchParams.get("radius") ?? 10);

  if (!zip.match(/^\d{5}$/)) {
    return json({ ok: false, error: "Provide a valid 5-digit zip code via ?zip=XXXXX" }, 400);
  }

  try {
    const locations = await findLocations(zip, radius);
    return json({ ok: true, locations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
}
