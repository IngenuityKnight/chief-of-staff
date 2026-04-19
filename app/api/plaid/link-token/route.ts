import { NextRequest, NextResponse } from "next/server";
import { requireEditorPassword } from "@/lib/server/admin";
import { createLinkToken, isPlaidConfigured } from "@/lib/server/plaid";

// POST /api/plaid/link-token
//
// Returns a short-lived Plaid Link token for the client to open the Link UI.
// Requires editor password so only household admins can connect accounts.

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(req: NextRequest) {
  try {
    requireEditorPassword(req.headers.get("x-editor-password"));

    if (!isPlaidConfigured()) {
      return json({ ok: false, error: "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET." }, 503);
    }

    const linkToken = await createLinkToken();
    return json({ ok: true, linkToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, message.includes("password") ? 401 : 500);
  }
}
