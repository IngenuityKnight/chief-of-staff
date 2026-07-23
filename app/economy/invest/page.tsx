// Invest view (custodial account + ventures + stakes)
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { cookies } from "next/headers";

export default async function InvestPage() {
  const cookieStore = await cookies();
  const householdId = cookieStore.get("household_id")?.value;
  if (!householdId) return <div>Unauthorized</div>;

  const supabase = getSupabaseAdmin();
  if (!supabase) return <div>Database error</div>;

  const { data: linkedAccounts } = await supabase
    .from("linked_financial_accounts")
    .select("id, account_label, last_synced_balance_cents, last_synced_at")
    .eq("household_id", householdId);

  const { data: ventures } = await supabase
    .from("micro_ventures")
    .select("id, name, status")
    .eq("household_id", householdId);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Invest</h2>
      
      {linkedAccounts && linkedAccounts.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Custodial Accounts</h3>
          <div className="space-y-4">
            {(linkedAccounts as Array<any>).map((acct) => (
              <div key={acct.id} className="rounded-lg border border-slate-200 bg-white p-6">
                <h4 className="font-bold text-slate-900">{acct.account_label}</h4>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  ${(acct.last_synced_balance_cents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Last synced: {acct.last_synced_at ? new Date(acct.last_synced_at).toLocaleDateString() : "Never"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ventures && ventures.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Ventures</h3>
          <div className="space-y-4">
            {(ventures as Array<any>).map((v) => (
              <div key={v.id} className="rounded-lg border border-slate-200 bg-white p-6">
                <h4 className="font-bold text-slate-900">{v.name}</h4>
                <p className="text-sm text-slate-600 mt-1">Status: {v.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
