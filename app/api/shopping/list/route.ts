import { NextResponse } from "next/server";
import { getShoppingList } from "@/lib/server/data";

// GET /api/shopping/list — returns current shopping list items as JSON.
// Used by the client-side shopping page to refresh after AI generation.

export async function GET() {
  try {
    const items = await getShoppingList();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
