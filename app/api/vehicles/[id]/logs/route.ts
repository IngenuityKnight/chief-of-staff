import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
import { wallHouseholdId } from "@/lib/server/wall";
import { rateLimit, rateLimitKey } from "@/lib/server/rate-limit";
import { verifyVehicleLogToken } from "@/lib/tap-token";
import { NextRequest, NextResponse } from "next/server";

// GET /api/vehicles/[id]/logs - List logs for a vehicle
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
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

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

  let query = supabase
    .from("vehicle_logs")
    .select("*", { count: "exact" })
    .eq("vehicle_id", vehicleId)
    .eq("household_id", householdId)
    .order("log_date", { ascending: false });

  if (from) query = query.gte("log_date", from);
  if (to) query = query.lte("log_date", to);

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    logs: data,
    total_count: count,
    has_more: count ? offset + limit < count : false,
  });
}

// POST /api/vehicles/[id]/logs - Create a new log
//
// Accepts either a signed-in session or a `k` token from an NFC car sticker.
// The sticker path is unauthenticated by design (possession of the signed URL
// is the credential), so it is rate limited and scoped to the wall household.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: vehicleId } = await params;

  const token = new URL(req.url).searchParams.get("k");
  const secret = (process.env.TAP_SECRET ?? "").trim();
  const viaSticker = Boolean(token && verifyVehicleLogToken(vehicleId, token, secret));

  if (viaSticker) {
    const limit = rateLimit(rateLimitKey("vehicle-log", null, req), {
      limit: 30,
      windowMs: 10 * 60_000,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
  }

  const householdId = viaSticker ? wallHouseholdId() : await getCurrentHousehold();
  if (!householdId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database error" }, { status: 500 });

  const body = await req.json();
  const { odometer_miles, gallons_pumped, cost_dollars, location, fuel_type, notes, log_date } =
    body;

  // Validate required field
  if (!odometer_miles || odometer_miles <= 0) {
    return NextResponse.json({ error: "odometer_miles is required and must be > 0" }, { status: 400 });
  }

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

  // Check if odometer is higher than last reading
  const { data: lastLog } = await supabase
    .from("vehicle_logs")
    .select("odometer_miles")
    .eq("vehicle_id", vehicleId)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastLog && odometer_miles <= lastLog.odometer_miles) {
    return NextResponse.json(
      {
        error: "odometer_lower_than_previous",
        message: `Odometer (${odometer_miles}) must be higher than last reading (${lastLog.odometer_miles})`,
      },
      { status: 400 }
    );
  }

  // Insert log
  const { data, error } = await supabase
    .from("vehicle_logs")
    .insert({
      household_id: householdId,
      vehicle_id: vehicleId,
      odometer_miles,
      gallons_pumped: gallons_pumped || null,
      cost_dollars: cost_dollars || null,
      location: location || null,
      fuel_type: fuel_type || null,
      notes: notes || null,
      log_date: log_date || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate MPG if we have gallons
  let mpg = null;
  if (gallons_pumped && lastLog && lastLog.odometer_miles > 0) {
    const miles = odometer_miles - lastLog.odometer_miles;
    mpg = miles / gallons_pumped;
  }

  // Keep vehicles.mileage in step with the newest reading so the existing
  // /vehicles page and maintenance cron don't drift from the log history.
  await supabase
    .from("vehicles")
    .update({ mileage: odometer_miles })
    .eq("id", vehicleId)
    .eq("household_id", householdId);

  return NextResponse.json({ ...data, mpg_calculated: mpg }, { status: 201 });
}
