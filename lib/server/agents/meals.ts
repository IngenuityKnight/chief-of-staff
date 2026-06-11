// Meals specialist — stage 2 agent (BACKEND-BRIEF.md §4).
//
// Receives the chief's analysis + meals domain state, makes one LLM call,
// and returns ProposalDraft[] — never writes to domain tables directly.

import { getAnthropicClient } from "@/lib/server/anthropic";
import { logAgentRun } from "./agent-runs";
import type { ProposalDraft, MealPlanPayload, OrderItemPayload, BlockTimePayload } from "./schemas";
import type { Rule } from "@/lib/types";
import type { MealsDomainState, SiblingDigests } from "./agent-context";

const MODEL = "claude-haiku-4-5-20251001";

export interface MealsCtx {
  inboxItemId: string;
  householdId: string;
  capture: string;
  chiefAnalysis: string;
  focus?: string;                  // chief's per-specialist focus sentence
  rulesConsulted: string[];
  rulesConflicts: string[];
  domainState: MealsDomainState;
  domainRules: Rule[];
  siblingDigests?: SiblingDigests; // schedule + money digests
}

export async function run(ctx: MealsCtx): Promise<ProposalDraft[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return [];

  const today = new Date();
  // Next Monday (or today if it's Monday)
  const daysUntilMonday = (7 - today.getDay() + 1) % 7 || 7;
  const monday = new Date(today.getTime() + daysUntilMonday * 86_400_000);
  const weekStartDate = monday.toISOString().slice(0, 10);

  const mustFollowRules = ctx.domainRules
    .filter((r) => r.priority === "must-follow" && r.active)
    .map((r) => `[MUST][id:${r.id}] ${r.title}: ${r.description}`)
    .join("\n");

  const preferRules = ctx.domainRules
    .filter((r) => r.priority !== "must-follow" && r.active)
    .map((r) => `[${r.priority.toUpperCase()}][id:${r.id}] ${r.title}: ${r.description}`)
    .join("\n");

  const siblingText = ctx.siblingDigests ? [
    ctx.siblingDigests.schedule ? `Schedule: ${ctx.siblingDigests.schedule}` : null,
    ctx.siblingDigests.money ? `Money: ${ctx.siblingDigests.money}` : null,
  ].filter(Boolean).join("\n") : "";

  const prompt = `You are the Meals specialist for a frugal household. Plan meals based on context below.

CAPTURE: "${ctx.capture}"
CHIEF ANALYSIS: ${ctx.chiefAnalysis}
${ctx.focus ? `CHIEF FOCUS: ${ctx.focus}` : ""}

CURRENT MEAL PLAN:
${ctx.domainState.existingMealPlan}

ACTIVE SHOPPING LIST: ${ctx.domainState.shoppingItems}
LOW STOCK PANTRY: ${ctx.domainState.lowStockFood}
CALENDAR: ${ctx.domainState.calendarDensity}
${siblingText ? `\nSIBLING DIGESTS:\n${siblingText}` : ""}

MEALS RULES:
${mustFollowRules || "(none)"}
${preferRules || ""}

Week starts: ${weekStartDate} (next Monday)
Today: ${today.toISOString().slice(0, 10)}

Return ONLY valid JSON — no markdown, no explanation:
{
  "analysis": "<1-2 sentences: what you're planning and why given the context>",
  "rules_consulted": ["<rule-id>"],
  "rules_conflicts": ["<must-follow rule-id violated>"],
  "meal_plan": {
    "weekStartDate": "${weekStartDate}",
    "days": [
      {
        "date": "YYYY-MM-DD",
        "label": "Mon M/D",
        "dinner": { "kind": "cook|leftover|restaurant|delivery", "name": "...", "notes": "...", "prepMinutes": 20, "estCost": 15 },
        "lunch": { "kind": "cook|leftover", "name": "..." }
      }
    ],
    "totalEstCost": 90
  },
  "grocery_items": [
    { "name": "...", "quantity": 1, "unit": "lbs|count|box|bag|bunch|oz|gallons", "priority": "high|medium|low", "notes": "..." }
  ],
  "prep_block": {
    "date": "YYYY-MM-DD",
    "startHour": 14,
    "durationMinutes": 90,
    "notes": "what to prep"
  }
}

Rules:
- Plan 5 weeknight dinners; skip days already in the current meal plan
- Favor meals that reuse ingredients (reduce waste, lower cost)
- grocery_items: only items NOT already on the shopping list
- prep_block: suggest Sunday prep if 3+ evenings are busy; omit if week looks light
- totalEstCost in dollars
- rules_conflicts: only [MUST] rule IDs this plan would violate; empty if none`;

  const t0 = Date.now();
  let message: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;

  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    void logAgentRun({
      agent: "meals",
      trigger: "capture",
      inboxItemId: ctx.inboxItemId,
      model: MODEL,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - t0,
      inputSummary: ctx.capture.slice(0, 200),
      output: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const latencyMs = Date.now() - t0;
  const content = message.content[0];

  if (content.type !== "text") {
    void logAgentRun({ agent: "meals", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: null, ok: false, error: "non-text response", householdId: ctx.householdId });
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    const match = content.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON");
    parsed = JSON.parse(match[0]);
  } catch {
    void logAgentRun({ agent: "meals", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: { raw: content.text }, ok: false, error: "parse failed", householdId: ctx.householdId });
    return [];
  }

  void logAgentRun({ agent: "meals", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: parsed as Record<string, unknown>, ok: true, householdId: ctx.householdId });

  const validRuleIds = new Set(ctx.domainRules.map((r) => r.id));
  const mustFollowIds = new Set(ctx.domainRules.filter((r) => r.priority === "must-follow").map((r) => r.id));
  const rulesConsulted = ((parsed.rules_consulted as unknown[]) ?? []).filter((id): id is string => typeof id === "string" && validRuleIds.has(id));
  const rulesConflicts = ((parsed.rules_conflicts as unknown[]) ?? []).filter((id): id is string => typeof id === "string" && mustFollowIds.has(id));

  const drafts: ProposalDraft[] = [];
  const analysis = typeof parsed.analysis === "string" ? parsed.analysis : "Meals plan generated.";

  // Meal plan proposal
  const mealPlanRaw = parsed.meal_plan as MealPlanPayload | undefined;
  if (mealPlanRaw?.days?.length) {
    const cost = typeof mealPlanRaw.totalEstCost === "number" ? Math.round(mealPlanRaw.totalEstCost * 100) : 0;
    drafts.push({
      inboxItemId: ctx.inboxItemId,
      agent: "meals",
      kind: "meal_plan",
      title: `Meal plan for the week of ${weekStartDate}`,
      rationale: analysis,
      payload: mealPlanRaw as unknown as Record<string, unknown>,
      estimatedCostCents: cost,
      rulesConsulted,
      rulesConflicts,
    });
  }

  // Grocery item proposals (one per item)
  const groceryItems = (parsed.grocery_items as OrderItemPayload[] | undefined) ?? [];
  for (const item of groceryItems) {
    if (typeof item.name !== "string") continue;
    drafts.push({
      inboxItemId: ctx.inboxItemId,
      agent: "meals",
      kind: "order_item",
      title: `Add to shopping list: ${item.name}`,
      rationale: `Needed for the week's meal plan.`,
      payload: {
        name: item.name,
        quantity: typeof item.quantity === "number" ? item.quantity : 1,
        unit: typeof item.unit === "string" ? item.unit : "count",
        category: "food",
        priority: typeof item.priority === "string" ? item.priority : "medium",
        notes: typeof item.notes === "string" ? item.notes : undefined,
      },
      estimatedCostCents: 0,
      rulesConsulted,
      rulesConflicts: [],
    });
  }

  // Prep block proposal
  const prepBlock = parsed.prep_block as BlockTimePayload | undefined;
  if (prepBlock?.date && typeof prepBlock.startHour === "number") {
    drafts.push({
      inboxItemId: ctx.inboxItemId,
      agent: "meals",
      kind: "block_time",
      title: "Meal prep block",
      rationale: prepBlock.notes ?? "Block time for weekly meal prep.",
      payload: {
        title: "Meal Prep",
        date: prepBlock.date,
        startHour: prepBlock.startHour,
        durationMinutes: typeof prepBlock.durationMinutes === "number" ? prepBlock.durationMinutes : 90,
        notes: prepBlock.notes,
      },
      estimatedCostCents: 0,
      rulesConsulted,
      rulesConflicts: [],
    });
  }

  return drafts;
}
