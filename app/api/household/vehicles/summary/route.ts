import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
import { NextResponse } from "next/server";

// GET /api/household/vehicles/summary - Summary across all household vehicles
export async function GET() {
  const householdId = await getCurrentHousehold();
  if (!householdId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database error" }, { status: 500 });

  // Get all vehicles
  const { data: vehicles, error: vehiclesError } = await supabase
    .from("vehicles")
    .select("id, name, make, model, year, plate")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  if (vehiclesError) {
    return NextResponse.json({ error: vehiclesError.message }, { status: 500 });
  }

  if (!vehicles || vehicles.length === 0) {
    return NextResponse.json({
      vehicles: [],
      total_household_miles: 0,
      avg_cost_per_mile: null,
    });
  }

  // Get all logs for household
  const { data: logs, error: logsError } = await supabase
    .from("vehicle_logs")
    .select("*")
    .eq("household_id", householdId)
    .order("log_date", { ascending: false });

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  // Calculate metrics per vehicle
  const vehicleMetrics = vehicles.map((vehicle) => {
    const vehicleLogs = (logs || []).filter((log) => log.vehicle_id === vehicle.id).sort((a, b) =>
      new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
    );

    if (vehicleLogs.length === 0) {
      return {
        ...vehicle,
        total_miles: 0,
        avg_mpg: null,
        last_log_date: null,
      };
    }

    const firstLog = vehicleLogs[0];
    const lastLog = vehicleLogs[vehicleLogs.length - 1];
    const totalMiles = lastLog.odometer_miles - firstLog.odometer_miles;

    let mpgReadings: number[] = [];
    for (let i = 1; i < vehicleLogs.length; i++) {
      const prev = vehicleLogs[i - 1];
      const curr = vehicleLogs[i];
      if (curr.gallons_pumped && curr.gallons_pumped > 0) {
        const miles = curr.odometer_miles - prev.odometer_miles;
        if (miles > 0) {
          mpgReadings.push(miles / curr.gallons_pumped);
        }
      }
    }

    const avgMpg =
      mpgReadings.length > 0
        ? Math.round((mpgReadings.reduce((a, b) => a + b) / mpgReadings.length) * 10) / 10
        : null;

    return {
      ...vehicle,
      total_miles: totalMiles,
      avg_mpg: avgMpg,
      last_log_date: lastLog.log_date,
    };
  });

  // Calculate household totals
  const totalHouseholdMiles = vehicleMetrics.reduce((sum, v) => sum + v.total_miles, 0);

  let totalCost = 0;
  let totalCostMiles = 0;

  (logs || []).forEach((log) => {
    if (log.cost_dollars) {
      totalCost += log.cost_dollars;
      // Find the miles for this log
      const prevLog = (logs || [])
        .filter((l) => l.vehicle_id === log.vehicle_id && new Date(l.log_date) < new Date(log.log_date))
        .sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime())[0];

      if (prevLog) {
        totalCostMiles += log.odometer_miles - prevLog.odometer_miles;
      }
    }
  });

  const avgCostPerMile =
    totalCostMiles > 0 ? Math.round((totalCost / totalCostMiles) * 100) / 100 : null;

  return NextResponse.json({
    vehicles: vehicleMetrics,
    total_household_miles: totalHouseholdMiles,
    avg_cost_per_mile: avgCostPerMile,
  });
}
