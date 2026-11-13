import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
import { NextRequest, NextResponse } from "next/server";

// The vehicles table predates this feature and has no `name` column — the
// display name is derived from make + model (e.g. "Lexus ES 350").
const VEHICLE_COLUMNS =
  "id, make, model, year, color, vin, license_plate, mileage, avg_mpg, monthly_fuel_cost, notes, created_at";

function withDisplayName<T extends { make: string; model: string }>(row: T) {
  return { ...row, name: `${row.make} ${row.model}`.trim() };
}

// GET /api/vehicles - List all vehicles for household
export async function GET() {
  const householdId = await getCurrentHousehold();
  if (!householdId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database error" }, { status: 500 });

  const { data, error } = await supabase
    .from("vehicles")
    .select(VEHICLE_COLUMNS)
    .eq("household_id", householdId)
    .order("year", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(withDisplayName));
}

// POST /api/vehicles - Create a new vehicle
export async function POST(req: NextRequest) {
  const householdId = await getCurrentHousehold();
  if (!householdId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database error" }, { status: 500 });

  const body = await req.json();
  const { make, model, year, color, vin, license_plate, mileage, notes } = body;

  // make/model/year are NOT NULL in the existing schema.
  if (!make || !model || !year) {
    return NextResponse.json(
      { error: "make, model and year are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      household_id: householdId,
      make,
      model,
      year,
      color: color || null,
      vin: vin || null,
      license_plate: license_plate || null,
      mileage: mileage || null,
      notes: notes || null,
    })
    .select(VEHICLE_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(withDisplayName(data), { status: 201 });
}
