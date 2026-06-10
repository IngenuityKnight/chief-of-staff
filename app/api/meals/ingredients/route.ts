import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAnthropicClient } from "@/lib/server/anthropic";
import { getMealPlan, getInventoryItems } from "@/lib/server/data";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { MealSlot } from "@/lib/types";

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  estCost?: number;
  notes?: string;
}

export async function POST() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "No database" }, { status: 500 });

  const client = getAnthropicClient();
  if (!client) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const [mealPlan, inventory] = await Promise.all([getMealPlan(), getInventoryItems()]);

  const cookMeals = mealPlan.flatMap((day) =>
    (["breakfast", "lunch", "dinner"] as const)
      .map((slot) => day[slot])
      .filter((m): m is MealSlot => !!m && m.kind === "cook")
      .map((m) => m.name)
  );

  if (cookMeals.length === 0) {
    return NextResponse.json({ ok: true, added: 0, message: "No cook meals in plan." });
  }

  const haveItems = inventory
    .filter((i) => i.category === "food" && i.quantity > 0)
    .map((i) => `${i.name} (${i.quantity} ${i.unit})`);

  const prompt = `You are a household grocery assistant. Given these planned home-cooked meals, extract the ingredients needed to buy.

Meals to cook this week:
${cookMeals.map((m, i) => `${i + 1}. ${m}`).join("\n")}

Already have in pantry (don't add these unless quantity is clearly insufficient for multiple uses):
${haveItems.length > 0 ? haveItems.join(", ") : "pantry unknown"}

Return ONLY a JSON array of ingredients to buy. Be practical — combine duplicates, use realistic quantities:
[
  { "name": "salmon fillet", "quantity": 1.5, "unit": "lbs", "estCost": 18 },
  { "name": "asparagus", "quantity": 1, "unit": "bunch", "estCost": 4 }
]

Only return items that need to be purchased. No markdown, no explanation.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  const ingredients = JSON.parse(cleaned) as Ingredient[];

  if (ingredients.length === 0) {
    return NextResponse.json({ ok: true, added: 0, message: "No ingredients needed." });
  }

  const rows = ingredients.map((ing) => ({
    id: crypto.randomUUID(),
    name: ing.name,
    quantity: ing.quantity ?? 1,
    unit: ing.unit ?? "count",
    est_cost: ing.estCost ?? null,
    store_preference: null,
    source: "ai" as const,
    inventory_item_id: null,
    category: "food",
    priority: "medium",
    status: "needed",
    notes: ing.notes ?? null,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("shopping_list_items").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/shopping");
  revalidatePath("/meals");
  return NextResponse.json({ ok: true, added: rows.length });
}
