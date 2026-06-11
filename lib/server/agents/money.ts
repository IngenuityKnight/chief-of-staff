// Money specialist — stage 2 (BACKEND-BRIEF.md §4).
// Receives chief framing + sibling digests + own domain state, returns ProposalDraft[].
// Emits create_task proposals for now (pay_bill / cancel_subscription executors land later).

import { getAnthropicClient } from "@/lib/server/anthropic";
import { logAgentRun } from "./agent-runs";
import type { ProposalDraft } from "./schemas";
import type { Rule } from "@/lib/types";
import type { MoneyDomainState, SiblingDigests } from "./agent-context";

const MODEL = "claude-haiku-4-5-20251001";

export interface MoneyCtx {
  inboxItemId: string;
  householdId: string;
  capture: string;
  chiefAnalysis: string;
  focus: string;
  rulesConsulted: string[];
  rulesConflicts: string[];
  domainState: MoneyDomainState;
  domainRules: Rule[];
  siblingDigests: SiblingDigests;
}

export async function run(ctx: MoneyCtx): Promise<ProposalDraft[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return [];

  const rulesText = ctx.domainRules
    .filter((r) => r.active)
    .map((r) => `[${r.priority === "must-follow" ? "MUST" : r.priority.toUpperCase()}][id:${r.id}] ${r.title}: ${r.description}`)
    .join("\n");

  const siblingText = [
    ctx.siblingDigests.meals ? `Meals: ${ctx.siblingDigests.meals}` : null,
    ctx.siblingDigests.schedule ? `Schedule: ${ctx.siblingDigests.schedule}` : null,
    ctx.siblingDigests.home ? `Home: ${ctx.siblingDigests.home}` : null,
  ].filter(Boolean).join("\n") || "(none)";

  const prompt = `You are the Money specialist. Propose financial actions for the household.

CAPTURE: "${ctx.capture}"
CHIEF FOCUS: ${ctx.focus}
CHIEF ANALYSIS: ${ctx.chiefAnalysis}

OWN STATE:
- Upcoming bills: ${ctx.domainState.upcomingBills}
- Month-to-date spend: ${ctx.domainState.monthSpend}
- Budget headroom: ${ctx.domainState.budgetHeadroom}

SIBLING DIGESTS:
${siblingText}

MONEY RULES:
${rulesText || "(none)"}

Return ONLY valid JSON — no markdown:
{
  "analysis": "<1 sentence: what financial action you propose and why>",
  "rules_consulted": ["<rule-id>"],
  "rules_conflicts": ["<must-follow rule-id violated>"],
  "tasks": [
    { "title": "<verb-first task>", "rationale": "<1 sentence>", "estimatedDollars": 0 }
  ]
}

Rules:
- 0-3 tasks. Skip tasks unrelated to the capture
- Be specific ("Pay $187 electric bill before Mar 14") not generic ("Review expenses")
- estimatedDollars is the user's outlay if the task is to spend/pay; 0 for review tasks
- If the capture mentions tight budget, prioritize cost-reduction tasks`;

  const t0 = Date.now();
  let message: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
  try {
    message = await anthropic.messages.create({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] });
  } catch (err) {
    void logAgentRun({ agent: "money", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - t0, inputSummary: ctx.capture.slice(0, 200), output: null, ok: false, error: err instanceof Error ? err.message : String(err), householdId: ctx.householdId });
    return [];
  }

  const latencyMs = Date.now() - t0;
  const content = message.content[0];
  if (content.type !== "text") {
    void logAgentRun({ agent: "money", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: null, ok: false, error: "non-text", householdId: ctx.householdId });
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    const m = content.text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON");
    parsed = JSON.parse(m[0]);
  } catch {
    void logAgentRun({ agent: "money", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: { raw: content.text }, ok: false, error: "parse failed", householdId: ctx.householdId });
    return [];
  }

  void logAgentRun({ agent: "money", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: parsed, ok: true, householdId: ctx.householdId });

  const validRuleIds = new Set(ctx.domainRules.map((r) => r.id));
  const mustFollowIds = new Set(ctx.domainRules.filter((r) => r.priority === "must-follow").map((r) => r.id));
  const rulesConsulted = ((parsed.rules_consulted as unknown[]) ?? []).filter((id): id is string => typeof id === "string" && validRuleIds.has(id));
  const rulesConflicts = ((parsed.rules_conflicts as unknown[]) ?? []).filter((id): id is string => typeof id === "string" && mustFollowIds.has(id));

  const tasks = (parsed.tasks as Array<{ title: string; rationale: string; estimatedDollars?: number }> | undefined) ?? [];

  return tasks
    .filter((t) => t && typeof t.title === "string")
    .slice(0, 3)
    .map((t) => ({
      inboxItemId: ctx.inboxItemId,
      agent: "money" as const,
      kind: "create_task" as const,
      title: t.title,
      rationale: typeof t.rationale === "string" ? t.rationale : "Money specialist proposed.",
      payload: {
        title: t.title,
        agent: "money" as const,
        category: "Finance",
        priority: "medium",
      },
      estimatedCostCents: typeof t.estimatedDollars === "number" ? Math.max(0, Math.round(t.estimatedDollars * 100)) : 0,
      rulesConsulted, rulesConflicts,
    }));
}
