// GET /api/export — download the household's records on demand.
//
// The monthly email is the backup that happens whether or not anyone
// remembers. This is the one you reach for when you want the data now.
//
//   /api/export                 the whole household as one JSON file
//   /api/export?table=tap_events  one table as CSV, for a spreadsheet
//
// Behind the session wall, so only a signed-in member can pull it.

import { NextResponse, type NextRequest } from "next/server";
import { EXPORT_TABLES, exportHousehold, exportHouseholdJson } from "@/lib/server/export";
import { getCurrentHousehold } from "@/lib/server/household";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const householdId = await getCurrentHousehold();
  if (!householdId) {
    return NextResponse.json({ ok: false, error: "No household for this login." }, { status: 403 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const table = req.nextUrl.searchParams.get("table");

  if (table) {
    // Checked against the list rather than passed through: this value reaches
    // a table name, and the allow-list is what keeps it from reaching any
    // other table in the schema.
    if (!EXPORT_TABLES.some((t) => t.table === table)) {
      return NextResponse.json(
        { ok: false, error: `Unknown table. One of: ${EXPORT_TABLES.map((t) => t.table).join(", ")}` },
        { status: 400 }
      );
    }
    const files = await exportHousehold(householdId);
    const file = files.find((f) => f.filename === `${table}.csv`);
    return new NextResponse(file?.csv ?? "", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stamp}-${table}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const json = await exportHouseholdJson(householdId);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="burden-house-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
