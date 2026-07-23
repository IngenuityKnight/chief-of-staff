// app/economy/page.tsx
// Family Bank: Accounts and Buckets view

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { cookies } from "next/headers";

export default async function EconomyPage() {
  const cookieStore = await cookies();
  const householdId = cookieStore.get("household_id")?.value;

  if (!householdId) {
    return <div>Unauthorized</div>;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return <div>Database error</div>;
  }

  const { data: accounts } = await supabase
    .from("economy_accounts")
    .select("id, member_id, created_at")
    .eq("household_id", householdId)
    .order("created_at");

  const { data: members } = await supabase
    .from("household_members")
    .select("id, name, avatar_color")
    .eq("household_id", householdId)
    .in(
      "id",
      (accounts as Array<any>)?.map((a) => a.member_id) || []
    );

  const memberMap = new Map(
    (members as Array<any>)?.map((m) => [m.id, m]) || []
  );

  // Get all buckets
  const { data: buckets } = await supabase
    .from("economy_buckets")
    .select("id, account_id, type, balance_cents, goal_label, goal_target_cents")
    .in(
      "account_id",
      (accounts as Array<any>)?.map((a) => a.id) || []
    )
    .order("account_id");

  const bucketsByAccount = new Map<string, Array<any>>();
  for (const bucket of (buckets as Array<any>) || []) {
    if (!bucketsByAccount.has(bucket.account_id)) {
      bucketsByAccount.set(bucket.account_id, []);
    }
    bucketsByAccount.get(bucket.account_id)!.push(bucket);
  }

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const bucketLabels: Record<string, string> = {
    give: "🎁 Give",
    save: "🏦 Save",
    spend: "💰 Spend",
    invest: "📈 Invest",
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Account Balances</h2>

      {!accounts || accounts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-600">No accounts set up yet. Create accounts in Settings.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(accounts as Array<any>).map((account) => {
            const member = memberMap.get(account.member_id);
            const accountBuckets = bucketsByAccount.get(account.id) || [];
            const totalBalance = accountBuckets.reduce((sum, b) => sum + b.balance_cents, 0);

            return (
              <div
                key={account.id}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-full bg-${
                      member?.avatar_color || "slate"
                    }-200 flex items-center justify-center font-semibold text-${
                      member?.avatar_color || "slate"
                    }-900`}
                  >
                    {member?.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{member?.name || "Unknown"}</h3>
                    <p className="text-sm text-slate-600">Total: {formatCents(totalBalance)}</p>
                  </div>
                </div>

                {/* Buckets */}
                <div className="space-y-2">
                  {accountBuckets.map((bucket) => (
                    <div key={bucket.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-700">
                          {bucketLabels[bucket.type] || bucket.type}
                        </p>
                        {bucket.goal_label && (
                          <p className="text-xs text-slate-500">Goal: {bucket.goal_label}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCents(bucket.balance_cents)}</p>
                        {bucket.goal_target_cents && (
                          <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.min(
                                  (bucket.balance_cents / bucket.goal_target_cents) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent transactions */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Recent Activity</h2>
        <RecentTransactions householdId={householdId} />
      </div>
    </div>
  );
}

async function RecentTransactions({ householdId }: { householdId: string }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return <div>Error loading transactions</div>;

  const { data: transactions } = await supabase
    .from("economy_transactions")
    .select("id, kind, amount_cents, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(10);

  const kindLabels: Record<string, string> = {
    payday_disbursement: "Payday",
    transfer: "Transfer",
    invest_contribution: "Invest",
    venture_buyin: "Venture",
    venture_distribution: "Profit",
    give_out: "Gave Away",
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {!transactions || transactions.length === 0 ? (
        <div className="p-6 text-center text-slate-600">No transactions yet</div>
      ) : (
        <div className="divide-y divide-slate-200">
          {(transactions as Array<any>).map((txn) => (
            <div key={txn.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
              <div>
                <p className="font-medium text-slate-900">{kindLabels[txn.kind] || txn.kind}</p>
                <p className="text-xs text-slate-500">{formatDate(txn.created_at)}</p>
              </div>
              <p className="font-semibold text-slate-900">{formatCents(txn.amount_cents)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
