import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPlaidConnections, syncAccounts, syncRecurringToBills } from "@/lib/server/plaid";

// POST /api/plaid/sync
//
// Manual Plaid sync — refreshes account balances and pulls recurring
// transactions into the bills table. For scheduled runs use /api/cron/plaid.
// Authenticated via CRON_SECRET bearer token.

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev: no secret configured
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySecret(req)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const connections = await getPlaidConnections();
    if (!connections.length) {
      return json({ ok: true, message: "No Plaid connections found.", synced: 0 });
    }

    const results = await Promise.allSettled(
      connections.map(async (conn) => {
        await syncAccounts(conn.id);
        const { synced } = await syncRecurringToBills(conn.id);
        return { institution: conn.institution_name, billsSynced: synced };
      })
    );

    const summary = results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: String(r.reason) }
    );

    revalidatePath("/money");
    revalidatePath("/");

    return json({ ok: true, connections: summary.length, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
}
