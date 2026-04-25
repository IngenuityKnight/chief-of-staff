import { NextRequest, NextResponse } from "next/server";

// GET /api/cron/shopping
//
// Weekly cron (Sunday 6am) — auto-generates the shopping list from low-stock
// inventory by delegating to /api/shopping/generate with clearExisting=true.
// Authenticated via CRON_SECRET bearer token (same as other cron routes).

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`;
    const res = await fetch(`${baseUrl}/api/shopping/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
      },
      body: JSON.stringify({ clearExisting: true }),
    });

    const data = await res.json();
    return json({ ok: true, cron: "shopping", ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
}
