// POST /api/plaid/link-token
// Generate a Plaid Link token for authenticated user's household
// Tier 1: Balance API only (read-only custodial account sync)

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || "";
const PLAID_SECRET = process.env.PLAID_SECRET || "";
const PLAID_ENV = (process.env.PLAID_ENV || "sandbox") as "sandbox" | "development" | "production";

export async function POST(req: NextRequest) {
  try {
    const { memberId } = (await req.json()) as { memberId?: string };
    const householdId = await getCurrentHousehold();
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return NextResponse.json({ error: "Plaid not configured" }, { status: 503 });
    }

    const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode, DepositoryAccountSubtype } = await import("plaid");

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

    let targetMemberId = memberId;
    if (!targetMemberId) {
      const supabase = getSupabaseAdmin();
      if (!supabase) {
        return NextResponse.json({ error: "Database not configured" }, { status: 503 });
      }
      const { data: members } = await supabase
        .from("household_members")
        .select("id")
        .eq("household_id", householdId)
        .limit(1)
        .maybeSingle();
      if (!members) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }
      targetMemberId = (members as any).id;
    }

    const linkTokenResponse = await client.linkTokenCreate({
      user: { client_user_id: `${householdId}-${targetMemberId}` },
      client_name: "Chief of Staff — Family Bank",
      language: "en",
      products: [Products.Auth],
      country_codes: [CountryCode.Us],
      account_filters: {
        depository: {
          account_subtypes: [DepositoryAccountSubtype.Savings, DepositoryAccountSubtype.Checking, DepositoryAccountSubtype.MoneyMarket],
        },
      },
    });

    return NextResponse.json({
      link_token: linkTokenResponse.data.link_token,
      expiration: linkTokenResponse.data.expiration,
    });
  } catch (err) {
    console.error("Plaid link-token error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate link token" },
      { status: 500 }
    );
  }
}
