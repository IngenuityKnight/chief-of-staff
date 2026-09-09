// POST /api/plaid/exchange-token
// Exchange Plaid Link's public_token for an access_token
// Store connection metadata in linked_financial_accounts (Tier 1: read-only)

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || "";
const PLAID_SECRET = process.env.PLAID_SECRET || "";
const PLAID_ENV = (process.env.PLAID_ENV || "sandbox") as "sandbox" | "development" | "production";

export async function POST(req: NextRequest) {
  try {
    const { publicToken, memberId } = (await req.json()) as {
      publicToken: string;
      memberId: string;
    };

    if (!publicToken || !memberId) {
      return NextResponse.json({ error: "Missing publicToken or memberId" }, { status: 400 });
    }

    const householdId = await getCurrentHousehold();
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
    }

    const { Configuration, PlaidApi, PlaidEnvironments } = await import("plaid");

    const configuration = new Configuration({
      basePath: PlaidEnvironments[PLAID_ENV],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
          "PLAID-SECRET": PLAID_SECRET,
        },
      },
    });

    const client = new PlaidApi(configuration);

    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const accounts = accountsResponse.data.accounts;
    if (accounts.length === 0) {
      return NextResponse.json({ error: "No accounts found in link" }, { status: 400 });
    }

    const primaryAccount = accounts[0];
    const accountLabel = primaryAccount.name || "Custodial Account";

    const { error: insertError } = await supabase
      .from("linked_financial_accounts")
      .insert({
        household_id: householdId,
        member_id: memberId,
        provider: "plaid",
        plaid_item_id: itemId,
        plaid_account_id: primaryAccount.account_id,
        account_label: accountLabel,
        last_synced_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Failed to store Plaid connection:", insertError);
      return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });
    }

    // TODO: Store accessToken in Supabase Vault (not plaintext in DB)

    return NextResponse.json({
      ok: true,
      message: "Account linked successfully",
      account: accountLabel,
    });
  } catch (err) {
    console.error("Plaid exchange-token error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to exchange token" },
      { status: 500 }
    );
  }
}
