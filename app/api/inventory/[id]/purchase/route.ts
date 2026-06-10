import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { store, quantity, price, notes } = body as Record<string, string>;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "No database" }, { status: 500 });

  const { error } = await supabase.from("inventory_purchases").insert({
    inventory_item_id: id,
    store: store || null,
    quantity: quantity ? Number(quantity) : null,
    price: price ? Number(price) : null,
    notes: notes || null,
    recorded_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/inventory");
  return NextResponse.json({ ok: true });
}
