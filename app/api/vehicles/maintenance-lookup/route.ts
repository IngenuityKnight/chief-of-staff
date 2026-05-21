import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/server/anthropic";
import { getRecalls } from "@/lib/server/nhtsa";

export interface MaintenanceSuggestion {
  item: string;
  system: "Vehicle";
  frequency: string;
  status: "ok" | "due-soon" | "overdue";
  notes: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { make, model, year, mileage } = body as {
      make: string;
      model: string;
      year: number;
      mileage?: number;
    };

    if (!make || !model || !year) {
      return NextResponse.json({ ok: false, error: "make, model, and year are required" }, { status: 400 });
    }

    // Run NHTSA recalls and Claude suggestions in parallel
    const [recalls, suggestions] = await Promise.all([
      getRecalls(make, model, year),
      generateSuggestions(make, model, year, mileage),
    ]);

    return NextResponse.json({ ok: true, recalls, suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function generateSuggestions(
  make: string,
  model: string,
  year: number,
  mileage?: number,
): Promise<MaintenanceSuggestion[]> {
  const client = getAnthropicClient();
  if (!client) return [];

  const mileageContext = mileage
    ? `Current mileage: ${mileage.toLocaleString()} miles.`
    : "Current mileage: unknown.";

  const prompt = `You are a vehicle maintenance expert. For a ${year} ${make} ${model}, ${mileageContext}

Generate a list of maintenance items that are likely due or coming up based on standard manufacturer intervals. Focus on the most important items for this specific vehicle.

Return ONLY a valid JSON array with no explanation or markdown:
[
  {
    "item": "Oil Change",
    "frequency": "quarterly",
    "status": "due-soon",
    "notes": "Due every 5,000–7,500 miles depending on oil type"
  }
]

Rules:
- frequency must be one of: monthly, quarterly, semi-annual, annual, seasonal
- status must be: "overdue" (past due based on mileage), "due-soon" (due within ~2,000 miles or next season), or "ok"
- Include 5–10 items covering: oil/filter, tires, brakes, fluids, filters, belts, battery, spark plugs — skip items not applicable to this vehicle
- If mileage is unknown, set all statuses to "ok"
- notes should be concise and specific to this vehicle's known maintenance schedule`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const raw = JSON.parse(cleaned) as Array<{
      item: string;
      frequency: string;
      status: string;
      notes: string;
    }>;

    return raw.map((r) => ({
      item: r.item,
      system: "Vehicle" as const,
      frequency: r.frequency,
      status: (["ok", "due-soon", "overdue"].includes(r.status) ? r.status : "ok") as MaintenanceSuggestion["status"],
      notes: r.notes,
    }));
  } catch {
    return [];
  }
}
