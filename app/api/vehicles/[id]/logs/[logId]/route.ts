import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
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

  const { data, error } = await supabase
    .from("vehicle_logs")
    .update({
      odometer_miles: odometer_miles ?? log.odometer_miles,
      gallons_pumped: gallons_pumped ?? log.gallons_pumped,
      cost_dollars: cost_dollars ?? log.cost_dollars,
      location: location ?? log.location,
      fuel_type: fuel_type ?? log.fuel_type,
      notes: notes ?? log.notes,
    })
    .eq("id", logId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  return NextResponse.json({ success: true });
}
