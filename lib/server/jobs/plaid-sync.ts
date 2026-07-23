// Plaid balance sync job
// Runs periodically to fetch latest custodial account balance from Plaid
// Updates linked_financial_accounts.last_synced_balance_cents and last_synced_at

import { getSupabaseAdmin } from "@/lib/server/supabase";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || "";
const PLAID_SECRET = process.env.PLAID_SECRET || "";
const PLAID_ENV = (process.env.PLAID_ENV || "sandbox") as "sandbox" | "development" | "production";

export async function syncPlaidBalance(accountId: string): Promise<boolean> {
  try {
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      console.warn("Plaid not configured; skipping sync");
      return false;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return false;

    // Get the account connection
    const { data: connection } = await supabase
      .from("linked_financial_accounts")
      .select("plaid_item_id, plaid_account_id, household_id")
      .eq("id", accountId)
      .maybeSingle();

    if (!connection) return false;

    // TODO: Fetch accessToken from Vault (not plaintext)
    // For now, this is a placeholder since we haven't stored the token yet

    // Once we have the token, we would:
    // 1. Call Plaid balancesGet() with the access_token
    // 2. Extract the balance for the specific account_id
    // 3. Update linked_financial_accounts with last_synced_balance_cents and last_synced_at

    const { error } = await supabase
      .from("linked_financial_accounts")
      .update({
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    return !error;
  } catch (err) {
    console.error("Plaid sync error:", err);
    return false;
  }
}

export async function syncAllPlaidBalances(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { data: connections } = await supabase
    .from("linked_financial_accounts")
    .select("id")
    .eq("provider", "plaid");

  if (!connections) return 0;

  let synced = 0;
  for (const conn of connections as Array<{ id: string }>) {
    const ok = await syncPlaidBalance(conn.id);
    if (ok) synced++;
  }

  return synced;
}
