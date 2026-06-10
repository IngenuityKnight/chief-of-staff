import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAnthropicClient } from "@/lib/server/anthropic";
import { getHouseholdContext, getInventoryItems, getRules } from "@/lib/server/data";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import type { MealSlot } from "@/lib/types";

interface GeneratedDay {
  date: string;
  label: string;
  theme?: string;
  breakfast?: MealSlot;
  lunch?: MealSlot;
  dinner?: MealSlot;
}

function nextWeekDates(): { date: string; label: string }[] {
  const days = [];
  const start = new Date();
  // Start from today (or next Monday if preferred)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    days.push({ date, label });
  }
  return days;
}

export async function POST() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "No database" }, { status: 500 });

  const client = getAnthropicClient();
  if (!client) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const [ctx, inventory, rules] = await Promise.all([
    getHouseholdContext(),
    getInventoryItems(),
    getRules(),
  ]);

  const dates = nextWeekDates();
  const availableFood = inventory
    .filter((i) => i.category === "food" && i.quantity > 0)
    .map((i) => `${i.name} (${i.quantity} ${i.unit})`);

  const mustRules = rules.filter((r) => r.priority === "must-follow" && r.active).map((r) => r.title);
  const prefRules = rules.filter((r) => r.priority === "prefer" && r.active).map((r) => r.title);

  const prompt = `You are a practical household meal planner. Generate a 7-day meal plan for the upcoming week. Be realistic, use what's available in the pantry, and honor the household rules.

Household context:
- Frugal mode: ${ctx.frugalMode ? "yes — minimize food spend" : "no"}
- Monthly budget: ${ctx.budgetMonthly ? `$${ctx.budgetMonthly}` : "unset"}

Dietary rules (MUST follow):
${mustRules.length > 0 ? mustRules.map((r) => `- ${r}`).join("\n") : "- None specified"}

Meal preferences:
${prefRules.length > 0 ? prefRules.map((r) => `- ${r}`).join("\n") : "- No specific preferences"}

Available in pantry:
${availableFood.length > 0 ? availableFood.join(", ") : "pantry not stocked yet"}

Dates to plan:
${dates.map((d) => `${d.date} (${d.label})`).join(", ")}

Meal kinds: "cook" (home-cooked), "leftover", "restaurant", "delivery"

Respond with ONLY a JSON array — no markdown, no explanation:
[
  {
    "date": "YYYY-MM-DD",
    "label": "Mon 6/10",
    "theme": "Light night",
    "breakfast": { "kind": "cook", "name": "Oatmeal with berries", "prepMinutes": 10, "estCost": 2 },
    "lunch": { "kind": "leftover", "name": "Yesterday's soup", "estCost": 0 },
    "dinner": { "kind": "cook", "name": "Salmon with asparagus", "prepMinutes": 25, "estCost": 14, "notes": "Use the salmon in the fridge" }
  }
]`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  const plan = JSON.parse(cleaned) as GeneratedDay[];

  for (const day of plan) {
    await supabase.from("meal_plan_days").upsert(
      {
        date: day.date,
        label: day.label,
        theme: day.theme ?? null,
        breakfast: day.breakfast ?? null,
        lunch: day.lunch ?? null,
        dinner: day.dinner ?? null,
      },
      { onConflict: "date" }
    );
  }

  revalidatePath("/meals");
  return NextResponse.json({ ok: true, days: plan.length });
}
