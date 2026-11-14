// What an NFC car sticker opens. Two ways in:
//   - a signed sticker URL (/vehicles/<id>/log?k=<token>) — works on any phone,
//     no session, because possession of the URL is the credential
//   - an ordinary signed-in browser session
//
// Neither one present means 404, not a login redirect: a mistyped or stale
// sticker shouldn't confirm that the vehicle exists. The vehicle and its last
// reading are loaded here rather than from the session-gated /api/vehicles, so
// the form renders filled in on the first paint at the pump.

import { notFound } from "next/navigation";
import { FuelLogForm } from "@/components/vehicles/fuel-log-form";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
import { wallHouseholdId } from "@/lib/server/wall";
import { verifyVehicleLogToken } from "@/lib/tap-token";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string }>;
}

export default async function QuickLogPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { k } = await searchParams;

  const secret = (process.env.TAP_SECRET ?? "").trim();
  const viaSticker = Boolean(k && verifyVehicleLogToken(id, k, secret));

  // A sticker tap is scoped to the wall's household, the same way /api/tap is.
  const householdId = viaSticker ? wallHouseholdId() : await getCurrentHousehold();
  if (!householdId) notFound();

  const supabase = getSupabaseAdmin();
  if (!supabase) notFound();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, make, model, year")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();

  if (!vehicle) notFound();

  const { data: lastLog } = await supabase
    .from("vehicle_logs")
    .select("odometer_miles")
    .eq("vehicle_id", id)
    .eq("household_id", householdId)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const name = `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() || "Vehicle";

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-center">Quick Fill-Up Log</h1>
          <p className="text-center text-gray-600 text-sm mt-2">
            {vehicle.year ? `${vehicle.year} ` : ""}
            {name}
          </p>
        </div>

        <FuelLogForm
          vehicleId={vehicle.id}
          vehicleName={name}
          lastReading={lastLog?.odometer_miles ?? undefined}
          token={viaSticker ? k : undefined}
          // A sticker tap has no session, so sending it to the dashboard would
          // only bounce it to login. Signed-in visitors still get the link.
          redirectTo={viaSticker ? undefined : "/vehicles-tracking"}
        />

        {!viaSticker && (
          <div className="mt-4 text-center">
            <a
              href="/vehicles-tracking"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ← Back to Dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
