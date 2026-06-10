import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/server/anthropic";
import { getHouseholdContext } from "@/lib/server/data";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "No database" }, { status: 500 });

  const { data: decision } = await supabase
    .from("decisions")
    .select("title, context, options, cost_estimate, time_estimate_minutes, category")
    .eq("id", id)
    .single();

  if (!decision) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ recommendation: "AI not configured — make the call based on your own judgment." });
  }

  const ctx = await getHouseholdContext();

  const prompt = `You are a practical household chief of staff. Given the following decision, provide a concise 2-3 sentence recommendation that cuts through the noise and tells the household what to do. Be direct and opinionated — no wishy-washy "it depends." Factor in the household context below.

Household context:
- Goals: ${ctx.goals ?? "financial independence, low stress"}
- Frugal mode: ${ctx.frugalMode ? "yes" : "no"}
- Monthly budget: ${ctx.budgetMonthly ? `$${ctx.budgetMonthly}` : "unset"}

Decision: ${decision.title as string}
Category: ${decision.category as string}
Context: ${(decision.context as string | null) ?? "none provided"}
Options: ${JSON.stringify(decision.options)}
${decision.cost_estimate ? `Cost in play: $${decision.cost_estimate as number}` : ""}
${decision.time_estimate_minutes ? `Time required: ${decision.time_estimate_minutes as number} min` : ""}

Respond with ONLY the recommendation text — no headers, no bullet points, no preamble.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  return NextResponse.json({ recommendation: text });
}
