import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";
import { getSupabaseAdmin } from "@/lib/server/supabase";

// ─── Client ──────────────────────────────────────────────────────────────────

let plaidClient: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi | null {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) return null;

  if (!plaidClient) {
    const env = process.env.PLAID_ENV === "production"
      ? PlaidEnvironments.production
      : process.env.PLAID_ENV === "development"
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox;

    plaidClient = new PlaidApi(
      new Configuration({
        basePath: env,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET,
          },
        },
      })
    );
  }

  return plaidClient;
}

export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

// ─── Link token ───────────────────────────────────────────────────────────────
// Creates a short-lived token that initialises the Plaid Link UI on the client.
// The token never contains any bank credentials.

export async function createLinkToken(userId = "household") {
  const client = getPlaidClient();
  if (!client) throw new Error("Plaid is not configured.");

  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Chief of Staff",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return response.data.link_token;
}

// ─── Exchange ────────────────────────────────────────────────────────────────
// Exchanges a short-lived public_token (from the client) for a permanent
// access_token. The access_token is stored server-side only — never returned
// to the browser.

export async function exchangePublicToken(publicToken: string) {
  const client = getPlaidClient();
  if (!client) throw new Error("Plaid is not configured.");

  const exchangeResponse = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const { access_token, item_id } = exchangeResponse.data;

  // Fetch institution name for display
  const itemResponse = await client.itemGet({ access_token });
  const institutionId = itemResponse.data.item.institution_id ?? null;

  let institutionName: string | null = null;
  if (institutionId) {
    try {
      const instResponse = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = instResponse.data.institution.name;
    } catch {
      // non-critical
    }
  }

  // Fetch initial account list
  const accountsResponse = await client.accountsGet({ access_token });
  const accounts = accountsResponse.data.accounts.map((a) => ({
    id: a.account_id,
    name: a.name,
    officialName: a.official_name,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
  }));

  // Persist to Supabase — access_token stored only here, never returned to client
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: connection, error } = await supabase
    .from("plaid_connections")
    .upsert(
      {
        item_id,
        access_token,
        institution_id: institutionId,
        institution_name: institutionName,
        accounts,
      },
      { onConflict: "item_id" }
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  return {
    connectionId: connection.id,
    institutionName,
    accountCount: accounts.length,
  };
}

// ─── Sync accounts ────────────────────────────────────────────────────────────
// Refreshes balances for all connected institutions.
// Called by the nightly n8n workflow and the /api/plaid/sync route.

export async function syncAccounts(connectionId: string) {
  const client = getPlaidClient();
  const supabase = getSupabaseAdmin();
  if (!client || !supabase) return;

  // Fetch the access_token server-side only
  const { data: conn, error: connErr } = await supabase
    .from("plaid_connections")
    .select("access_token, id")
    .eq("id", connectionId)
    .single();

  if (connErr || !conn) return;

  const { data: accountsData } = await client.accountsGet({
    access_token: conn.access_token,
  });

  const rows = accountsData.accounts.map((a) => ({
    id: a.account_id,
    connection_id: connectionId,
    name: a.name,
    official_name: a.official_name ?? null,
    type: String(a.type),
    subtype: a.subtype ? String(a.subtype) : null,
    balance_current: a.balances.current ?? null,
    balance_available: a.balances.available ?? null,
    balance_limit: a.balances.limit ?? null,
    currency: a.balances.iso_currency_code ?? "USD",
    mask: a.mask ?? null,
    updated_at: new Date().toISOString(),
  }));

  await supabase
    .from("plaid_accounts")
    .upsert(rows, { onConflict: "id" });

  await supabase
    .from("plaid_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connectionId);
}

// ─── Sync recurring transactions → bills table ───────────────────────────────
// Uses Plaid's Recurring Transactions API to detect standing bills/subscriptions
// and upserts them into the existing bills table with source: 'plaid'.

export async function syncRecurringToBills(connectionId: string) {
  const client = getPlaidClient();
  const supabase = getSupabaseAdmin();
  if (!client || !supabase) return { synced: 0 };

  const { data: conn } = await supabase
    .from("plaid_connections")
    .select("access_token, accounts")
    .eq("id", connectionId)
    .single();

  if (!conn) return { synced: 0 };

  // Get account IDs for this connection
  const accountIds = (conn.accounts as Array<{ id: string }>).map((a) => a.id);
  if (!accountIds.length) return { synced: 0 };

  const { data: recurringData } = await client.transactionsRecurringGet({
    access_token: conn.access_token,
    account_ids: accountIds,
  });

  const outflow = recurringData.outflow_streams ?? [];
  let synced = 0;

  for (const stream of outflow) {
    if (stream.status !== "MATURE") continue; // only well-established recurring items

    const lastTx = stream.last_date;
    const amount = Math.abs(stream.average_amount?.amount ?? 0);
    if (amount === 0) continue;

    const bill = {
      id: `plaid_${stream.stream_id}`,
      name: stream.merchant_name ?? stream.description,
      kind: "subscription" as const,
      amount,
      frequency: "monthly" as const,
      category: stream.personal_finance_category?.primary ?? "Other",
      status: "due" as const,
      autopay: true,
      due_date: lastTx ?? null,
      last_paid: lastTx ?? null,
    };

    await supabase.from("bills").upsert(bill, { onConflict: "id" });
    synced++;
  }

  return { synced };
}

// ─── Read accounts (safe — no credentials) ───────────────────────────────────

export async function getPlaidAccounts() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from("plaid_accounts")
    .select("*")
    .order("type");

  return data ?? [];
}

export async function getPlaidConnections() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  // Select only non-sensitive fields
  const { data } = await supabase
    .from("plaid_connections")
    .select("id, institution_name, institution_id, accounts, last_synced_at, created_at");

  return data ?? [];
}
