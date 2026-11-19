import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
import { syncVehicleMileage } from "@/lib/server/store";
import { NextRequest, NextResponse } from "next/server";

// GET /api/vehicles/[id]/logs/[logId] - Get single log
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const householdId = await getCurrentHousehold();
  if (!householdId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database error" }, { status: 500 });

  const { id: vehicleId, logId } = await params;

  const { data, error } = await supabase
    .from("vehicle_logs")
    .select("*")
    .eq("id", logId)
    .eq("vehicle_id", vehicleId)
    .eq("household_id", householdId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PUT /api/vehicles/[id]/logs/[logId] - Update log
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const householdId = await getCurrentHousehold();
  if (!householdId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database error" }, { status: 500 });

  const { id: vehicleId, logId } = await params;
  const body = await req.json();
  const { odometer_miles, gallons_pumped, cost_dollars, location, fuel_type, notes } = body;

  // Verify log exists
  const { data: log } = await supabase
    .from("vehicle_logs")
    .select("*")
    .eq("id", logId)
    .eq("vehicle_id", vehicleId)
    .eq("household_id", householdId)
    .single();

  if (!log) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  const nextOdometer = odometer_miles ?? log.odometer_miles;

  // An odometer only goes up, so an edit has to stay between its neighbours.
  // Without this a correction can silently invert an interval, and the MPG
  // either side of it becomes nonsense with nothing to show which row is bad.
  if (nextOdometer !== log.odometer_miles) {
    const [{ data: before }, { data: after }] = await Promise.all([
      supabase
        .from("vehicle_logs")
        .select("odometer_miles")
        .eq("household_id", householdId)
        .eq("vehicle_id", vehicleId)
        .lt("log_date", log.log_date)
        .order("log_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("vehicle_logs")
        .select("odometer_miles")
        .eq("household_id", householdId)
        .eq("vehicle_id", vehicleId)
        .gt("log_date", log.log_date)
        .order("log_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (before && nextOdometer <= Number(before.odometer_miles)) {
      return NextResponse.json(
        {
          error: "odometer_lower_than_previous",
          message: `Odometer (${nextOdometer}) must be higher than the fill-up before it (${before.odometer_miles}).`,
        },
        { status: 400 }
      );
    }
    if (after && nextOdometer >= Number(after.odometer_miles)) {
      return NextResponse.json(
        {
          error: "odometer_higher_than_next",
          message: `Odometer (${nextOdometer}) must be lower than the fill-up after it (${after.odometer_miles}).`,
        },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("vehicle_logs")
    .update({
      odometer_miles: nextOdometer,
      gallons_pumped: gallons_pumped ?? log.gallons_pumped,
      cost_dollars: cost_dollars ?? log.cost_dollars,
      location: location ?? log.location,
      fuel_type: fuel_type ?? log.fuel_type,
      notes: notes ?? log.notes,
      // Editable so a splash-and-dash mis-logged as a full tank can be
      // corrected. Without this the only fix was to delete and re-enter.
      is_full_fill: body.is_full_fill ?? log.is_full_fill,
    })
    .eq("id", logId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The vehicle's odometer is derived from its logs, so editing one has to
  // re-derive it rather than leave the old reading behind.
  await syncVehicleMileage(householdId, vehicleId);

  return NextResponse.json(data);
}

// DELETE /api/vehicles/[id]/logs/[logId] - Delete log
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const householdId = await getCurrentHousehold();
  if (!householdId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database error" }, { status: 500 });

  const { id: vehicleId, logId } = await params;

  const { error } = await supabase
    .from("vehicle_logs")
    .delete()
    .eq("id", logId)
    .eq("vehicle_id", vehicleId)
    .eq("household_id", householdId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The reading this log left on the vehicle has to go with it. Without this
  // a deleted fill-up keeps setting the odometer forever — which is how a
  // mileage from one car outlived its log and stranded itself on another.
  await syncVehicleMileage(householdId, vehicleId);

  return NextResponse.json({ success: true });
}
