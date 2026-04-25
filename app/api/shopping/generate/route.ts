import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAnthropicClient } from "@/lib/server/anthropic";
import { getInventoryItems } from "@/lib/server/data";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { isKrogerConfigured, lookupPricesBatch } from "@/lib/server/kroger";

// POST /api/shopping/generate
//
// Uses Claude to analyze current inventory and generate a prioritized
// shopping list. Low-stock items are always included; Claude adds context
// like suggested quantities, stores, and bundling tips.
//
// Also called by /api/cron/shopping for weekly auto-generation.

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

interface GeneratedItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  estCost?: number;
  storePreference?: string;
  notes?: string;
  inventoryItemId?: string;
}

async function generateWithAI(lowStock: Awaited<ReturnType<typeof getInventoryItems>>, all: Awaited<ReturnType<typeof getInventoryItems>>): Promise<GeneratedItem[]> {
  const client = getAnthropicClient();
  if (!client) {
    // Fallback: just convert low-stock items directly without AI
    return lowStock.map((item) => ({
      name: item.name,
      quantity: Math.max(item.minQuantity - item.quantity, item.minQuantity),
      unit: item.unit,
      category: item.category,
      priority: item.quantity === 0 ? "critical" : item.quantity <= item.minQuantity / 2 ? "high" : "medium",
      estCost: item.pricePerUnit ? item.pricePerUnit * Math.max(item.minQuantity - item.quantity, 1) : undefined,
      storePreference: item.preferredStore ?? undefined,
      inventoryItemId: item.id,
    }));
  }

  const inventorySummary = all.map((i) => ({
    name: i.name,
    category: i.category,
    qty: i.quantity,
    unit: i.unit,
    min: i.minQuantity,
    weeklyUse: i.estWeeklyConsumption,
    pricePerUnit: i.pricePerUnit,
    store: i.preferredStore,
    id: i.id,
  }));

  const prompt = `You are a frugal household shopping assistant. The goal is financial independence — buy smart, buy in bulk when it saves money, avoid waste.

Current inventory (JSON):
${JSON.stringify(inventorySummary, null, 2)}

Low-stock items (quantity <= min_quantity):
${JSON.stringify(lowStock.map(i => ({ name: i.name, qty: i.quantity, min: i.minQuantity, id: i.id })), null, 2)}

Generate a prioritized shopping list. Rules:
1. Always include low-stock items. Set priority based on urgency: quantity=0 → critical, <=50% of min → high, <=min → medium.
2. Look for items approaching min_quantity (qty < 2x min) — add them as low priority to avoid a second trip.
3. Suggest buying quantities that minimize restocking frequency (e.g. buy 2-3x the minimum if it's a stable consumable).
4. Group by store when possible to suggest trip efficiency.
5. If pricePerUnit is known, estimate total cost.

Respond with ONLY a JSON array of shopping items (no markdown, no explanation):
[
  {
    "name": "item name",
    "quantity": 12,
    "unit": "rolls",
    "category": "paper",
    "priority": "high",
    "estCost": 8.99,
    "storePreference": "Costco",
    "notes": "optional frugal tip or bundling suggestion",
    "inventoryItemId": "uuid or null"
  }
]`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as GeneratedItem[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return json({ ok: false, error: "Supabase not configured." }, 500);

    const body = await req.json().catch(() => ({}));
    const clearExisting = body.clearExisting === true;

    const allInventory = await getInventoryItems();
    const lowStock = allInventory.filter((i) => i.quantity <= i.minQuantity);

    const items = await generateWithAI(lowStock, allInventory);

    if (clearExisting) {
      await supabase
        .from("shopping_list_items")
        .delete()
        .in("source", ["auto", "ai"])
        .eq("status", "needed");
    }

    if (items.length === 0) {
      return json({ ok: true, generated: 0, krogerPriced: 0, message: "Nothing to add — inventory looks good." });
    }

    // Enrich with Kroger prices when configured
    let krogerPriced = 0;
    if (isKrogerConfigured()) {
      try {
        const names   = items.map((i) => i.name);
        const prices  = await lookupPricesBatch(names);
        const priceMap = Object.fromEntries(prices.map((p) => [p.name.toLowerCase(), p]));

        for (const item of items) {
          const match = priceMap[item.name.toLowerCase()];
          if (match?.found && match.bestPrice) {
            item.estCost       = parseFloat((match.bestPrice * item.quantity).toFixed(2));
            item.storePreference = item.storePreference ?? "Kroger";
            krogerPriced++;
          }
        }
      } catch (err) {
        console.error("Kroger price enrichment failed (non-fatal):", err);
      }
    }

    const rows = items.map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      est_cost: item.estCost ?? null,
      store_preference: item.storePreference ?? null,
      source: "ai" as const,
      inventory_item_id: item.inventoryItemId ?? null,
      category: item.category,
      priority: item.priority,
      status: "needed",
      notes: item.notes ?? null,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("shopping_list_items").insert(rows);
    if (error) throw new Error(error.message);

    revalidatePath("/shopping");
    revalidatePath("/");

    return json({ ok: true, generated: rows.length, krogerPriced });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ ok: false, error: message }, 500);
  }
}
