import { NextRequest, NextResponse } from "next/server";
import { isKrogerConfigured, lookupPricesBatch } from "@/lib/server/kroger";

// POST /api/kroger/price-lookup
//
// Looks up current Kroger prices for a list of item names.
// Also updates price_per_unit on matching inventory_items if Supabase is configured.
//
// Request:  { "items": ["toilet paper", "dish soap", ...], "locationId"?: "..." }
// Response: { ok, results: [{ name, found, bestPrice, description, size, ... }] }

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!isKrogerConfigured()) {
    return json({ ok: false, error: "Kroger API is not configured. Set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET." }, 503);
  }

  try {
    const body = await req.json() as { items?: unknown; locationId?: unknown };
    const items = Array.isArray(body.items)
      ? body.items.filter((i): i is string => typeof i === "string").slice(0, 20)
      : [];

    if (items.length === 0) {
      return json({ ok: false, error: "Provide an `items` array of item names." }, 400);
    }

    const locationId = typeof body.locationId === "string" ? body.locationId : undefined;
    const results = await lookupPricesBatch(items, locationId);

    return json({ ok: true, results, storeId: locationId ?? process.env.KROGER_LOCATION_ID ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
}
