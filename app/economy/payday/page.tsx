// Payday review screen (stub - approve disbursements)
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { cookies } from "next/headers";

export default async function PaydayPage() {
  const cookieStore = await cookies();
  const householdId = cookieStore.get("household_id")?.value;
  if (!householdId) return <div>Unauthorized</div>;

  const supabase = getSupabaseAdmin();
  if (!supabase) return <div>Database error</div>;

  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, title, payload, status, created_at")
    .eq("household_id", householdId)
    .eq("kind", "payday_disbursement")
    .eq("status", "awaiting_approval")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Payday Review</h2>
      {!proposals || proposals.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-slate-600">No pending paydays</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(proposals as Array<any>).map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-bold text-slate-900 mb-2">{p.title}</h3>
              <p className="text-sm text-slate-600 mb-4">{p.payload.paymentRationale || "Gigs ready for payout"}</p>
              <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                Approve & Disburse
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
