import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPlaidConnections, syncAccounts, syncRecurringToBills } from "@/lib/server/plaid";

// POST /api/plaid/sync
//
// Syncs all connected Plaid institutions: refreshes account balances and
// pulls recurring transactions into the bills table. Called by the nightly
// n8n workflow (authenticated via x-webhook-secret) or manually via the UI.

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.N8N_PLAID_SYNC_SECRET;
  if (!expected) return true; // no secret configured — allow (dev mode)
  return req.headers.get("x-webhook-secret") === expected;
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
