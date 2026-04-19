import { NextRequest, NextResponse } from "next/server";
import { requireEditorPassword } from "@/lib/server/admin";
import { exchangePublicToken, syncAccounts, syncRecurringToBills } from "@/lib/server/plaid";
import { revalidatePath } from "next/cache";

// POST /api/plaid/exchange
//
// Exchanges the short-lived public_token (from Plaid Link) for a permanent
// access_token. The access_token is stored in Supabase and NEVER returned
// to the client. Immediately syncs accounts and recurring bills.
//
// Body: { publicToken: string }

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: NextRequest) {
  try {
    requireEditorPassword(req.headers.get("x-editor-password"));

    const body = await req.json();
    const { publicToken } = body as { publicToken?: string };

    if (!publicToken || typeof publicToken !== "string") {
      return json({ ok: false, error: "Missing publicToken." }, 400);
    }

    // Exchange and persist — access_token stored server-side only
    const result = await exchangePublicToken(publicToken);

    // Immediately pull account balances and recurring bills
    await Promise.all([
      syncAccounts(result.connectionId),
      syncRecurringToBills(result.connectionId),
    ]);

    revalidatePath("/money");
    revalidatePath("/");

    return json({
      ok: true,
      institutionName: result.institutionName,
      accountCount: result.accountCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, message.includes("password") ? 401 : 500);
  }
}
