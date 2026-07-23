// app/economy/gigs/page.tsx
// Gig Board: view, claim, and submit work

import { getSupabaseAdmin } from "@/lib/server/supabase";
import { cookies } from "next/headers";

export default async function GigBoardPage() {
  const cookieStore = await cookies();
  const householdId = cookieStore.get("household_id")?.value;

  if (!householdId) {
    return <div>Unauthorized</div>;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return <div>Database error</div>;
  }

  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, title, description, bounty_cents, status, claimed_by, posted_by, created_at, source_type")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  const { data: members } = await supabase
    .from("household_members")
    .select("id, name")
    .eq("household_id", householdId);

  const memberMap = new Map((members as Array<any>)?.map((m) => [m.id, m]) || []);

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const statusLabels: Record<string, string> = {
    open: "Open",
    claimed: "Claimed",
    submitted: "Submitted",
    approved: "Approved",
    paid: "Paid",
  };

  const statusColors: Record<string, string> = {
    open: "bg-green-100 text-green-800",
    claimed: "bg-blue-100 text-blue-800",
    submitted: "bg-yellow-100 text-yellow-800",
    approved: "bg-purple-100 text-purple-800",
    paid: "bg-slate-100 text-slate-800",
  };

  const openGigs = (gigs as Array<any>)?.filter((g) => g.status === "open") || [];
  const myGigs = (gigs as Array<any>)?.filter((g) => g.claimed_by) || [];
  const completedGigs = (gigs as Array<any>)?.filter((g) => g.status === "paid") || [];

  const owedThisPeriod = myGigs
    .filter((g) => g.status === "approved")
    .reduce((sum, g) => sum + g.bounty_cents, 0);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Gig Board</h2>
        <p className="text-slate-600">Post, claim, and complete household work for money.</p>
      </div>

      {owedThisPeriod > 0 && (
        <div className="mb-8 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm text-blue-700">
            <span className="font-semibold">Awaiting payday:</span> {formatCents(owedThisPeriod)} owed
          </p>
        </div>
      )}

      <div className="mb-12">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Open Gigs ({openGigs.length})</h3>
        {openGigs.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-slate-600">No open gigs yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openGigs.map((gig) => (
              <div key={gig.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{gig.title}</h4>
                    {gig.description && <p className="text-sm text-slate-600 mt-1">{gig.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{formatCents(gig.bounty_cents)}</p>
                    <button className="mt-2 px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
                      Claim
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {myGigs.length > 0 && (
        <div className="mb-12">
          <h3 className="text-lg font-bold text-slate-900 mb-4">My Gigs</h3>
          <div className="space-y-3">
            {myGigs.map((gig) => (
              <div key={gig.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{gig.title}</h4>
                    <span className={`inline-block mt-1 text-xs px-2 py-1 rounded ${statusColors[gig.status]}`}>
                      {statusLabels[gig.status]}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatCents(gig.bounty_cents)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
