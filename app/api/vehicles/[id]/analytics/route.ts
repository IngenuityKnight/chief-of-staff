import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const householdId = await getCurrentHousehold();
  if (!householdId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database error" }, { status: 500 });

  const { id: vehicleId } = await params;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "month";

  // Verify vehicle belongs to household
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("household_id", householdId)
    .single();

  if (vehicleError || !vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // Calculate date range
  const now = new Date();
  let startDate = new Date();
  if (period === "month") {
    startDate.setMonth(now.getMonth() - 1);
  } else if (period === "year") {
    startDate.setFullYear(now.getFullYear() - 1);
  } else {
    startDate = new Date("2000-01-01"); // all_time
  }

  // Get logs for period
  const { data: logs, error } = await supabase
    .from("vehicle_logs")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .gte("log_date", startDate.toISOString())
    .order("log_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!logs || logs.length === 0) {
    return NextResponse.json({
      mpg_avg: null,
      cost_per_mile: null,
      total_miles: 0,
      total_cost: 0,
      fill_ups: 0,
      last_fill_up: null,
      trend_mpg: null,
      trend_cost: null,
    });
  }

  // Calculate metrics
  const firstLog = logs[0];
  const lastLog = logs[logs.length - 1];
  const totalMiles = lastLog.odometer_miles - firstLog.odometer_miles;

  let totalCost = 0;
  let mpgReadings: number[] = [];
  let costPerGallon: number[] = [];

  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i - 1];
    const curr = logs[i];
    const milesSinceLastFill = curr.odometer_miles - prev.odometer_miles;

    if (curr.gallons_pumped && milesSinceLastFill > 0) {
      const mpg = milesSinceLastFill / curr.gallons_pumped;
      mpgReadings.push(mpg);
    }

    if (curr.gallons_pumped && curr.cost_dollars) {
      const costPer = curr.cost_dollars / curr.gallons_pumped;
      costPerGallon.push(costPer);
      totalCost += curr.cost_dollars;
    }
  }

  // Average calculations
  const mpgAvg =
    mpgReadings.length > 0
      ? Math.round((mpgReadings.reduce((a, b) => a + b) / mpgReadings.length) * 10) / 10
      : null;
  const costPerMile =
    totalMiles > 0 && totalCost > 0
      ? Math.round((totalCost / totalMiles) * 100) / 100
      : null;
  const avgCostPerGallon =
    costPerGallon.length > 0
      ? Math.round((costPerGallon.reduce((a, b) => a + b) / costPerGallon.length) * 100) / 100
      : null;

  // Calculate previous period for trend
  let trendMpg = null;
  let trendCost = null;

  if (period === "month") {
    const prevStart = new Date(startDate);
    prevStart.setMonth(prevStart.getMonth() - 1);

    const { data: prevLogs } = await supabase
      .from("vehicle_logs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .gte("log_date", prevStart.toISOString())
      .lt("log_date", startDate.toISOString())
      .order("log_date", { ascending: true });

    if (prevLogs && prevLogs.length > 1) {
      let prevMpg: number[] = [];
      for (let i = 1; i < prevLogs.length; i++) {
        const prev = prevLogs[i - 1];
        const curr = prevLogs[i];
        if (curr.gallons_pumped) {
          const miles = curr.odometer_miles - prev.odometer_miles;
          prevMpg.push(miles / curr.gallons_pumped);
        }
      }
      if (prevMpg.length > 0 && mpgAvg) {
        const prevAvg = prevMpg.reduce((a, b) => a + b) / prevMpg.length;
        trendMpg = Math.round((mpgAvg - prevAvg) * 10) / 10;
      }
    }
  }

  return NextResponse.json({
    mpg_avg: mpgAvg,
    cost_per_mile: costPerMile,
    cost_per_gallon: avgCostPerGallon,
    total_miles: totalMiles,
    total_cost: totalCost,
    fill_ups: mpgReadings.length,
    last_fill_up: lastLog.log_date,
    trend_mpg: trendMpg,
    trend_cost: trendCost,
    period,
  });
}
