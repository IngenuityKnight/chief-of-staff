// Chief of Staff — stage 1 routing + synthesis (BACKEND-BRIEF.md §4).
//
// Single LLM call. Input: capture text + household context + active rules.
// Output: { analysis, primary, secondary[], urgency, invocations[],
//           rulesConsulted[], rulesConflicts[] }
//
// invocations[] tells the orchestrator which specialists to fan out to and with
// what focus. The orchestrator passes each specialist its own slice of
// household state + sibling digests, then synthesizes the Play.

import { getAnthropicClient } from "@/lib/server/anthropic";
import { logAgentRun } from "./agent-runs";
import { assembleContextForIntake } from "@/lib/server/context";
import type { AgentId, Category, Priority } from "@/lib/types";

const MODEL = "claude-haiku-4-5-20251001";
const AGENT_IDS: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];
const CATEGORIES_LIST: Category[] = ["Meals", "Cleaning", "Household", "Admin", "Planning", "Finance", "Social"];
const PRIORITIES_LIST: Priority[] = ["low", "medium", "high", "critical"];

export interface ChiefInvocation {
  agent: AgentId;       // specialist to invoke
  focus: string;        // 1-sentence framing for the specialist
}

export interface ChiefDecision {
  analysis: string;
  primary: AgentId;
  secondary: AgentId[];
  category: Category;
  urgency: Priority;
  proposedTasks: string[];
  rulesConsulted: string[];
  rulesConflicts: string[];
  invocations: ChiefInvocation[];
}

const CATEGORY_FALLBACK: Record<AgentId, Category> = {
  meals: "Meals", home: "Household", money: "Finance",
  schedule: "Planning", roster: "Social", chief: "Admin",
};

export async function run(opts: {
  text: string;
  inboxItemId: string;
  householdId: string;
}): Promise<ChiefDecision | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const { text: householdCtx, activeRules } = await assembleContextForIntake();

  const prompt = `${householdCtx}You are the Chief of Staff routing engine for a frugal household. Analyze this capture and return JSON.

Input: "${opts.text.replace(/"/g, '\\"')}"

Agents: ${AGENT_IDS.join(", ")}
Categories: ${CATEGORIES_LIST.join(", ")}
Urgency: ${PRIORITIES_LIST.join(", ")}

Return ONLY valid JSON — no markdown, no explanation:
{
  "primary": "<agent>",
  "secondary": ["<agent>"],
  "category": "<category>",
  "urgency": "<urgency>",
  "analysis": "<1-2 sentence summary — what was captured, the cross-domain angle if any, any frugal/rule consideration>",
  "proposedTasks": ["<concrete task 1>", "<task 2>", "<task 3>"],
  "rules_consulted": ["<rule-id from ACTIVE RULES that informed this>"],
  "rules_conflicts": ["<id of a [MUST] rule this would violate>"],
  "invocations": [
    { "agent": "meals|home|money|schedule|roster", "focus": "<what you want this specialist to plan, one sentence>" }
  ]
}

Instructions:
- primary: the agent most responsible
- secondary: 0-2 agents that should also weigh in (their state will be visible to primary)
- invocations: 1-4 specialists to fan out to in parallel; include primary first
- Coordination scenarios (busy week + tight budget, broken appliance + warranty, etc) → invoke multiple specialists
- proposedTasks: 2-3 concrete tasks — these become create_task proposals when no richer specialist plan is generated
- rules_consulted: only IDs from ACTIVE RULES; rules_conflicts: only [MUST] rule IDs this action would directly violate
- urgency=critical only for genuine emergencies`;

  const t0 = Date.now();
  let message: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;

  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    void logAgentRun({
      agent: "chief", trigger: "capture", inboxItemId: opts.inboxItemId,
      model: MODEL, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - t0,
      inputSummary: opts.text.slice(0, 200), output: null, ok: false,
      error: err instanceof Error ? err.message : String(err),
      householdId: opts.householdId,
    });
    return null;
  }

  const latencyMs = Date.now() - t0;
  const content = message.content[0];

  if (content.type !== "text") {
    void logAgentRun({ agent: "chief", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: opts.text.slice(0, 200), output: null, ok: false, error: "non-text response", householdId: opts.householdId });
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    const m = content.text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON");
    parsed = JSON.parse(m[0]);
  } catch (err) {
    void logAgentRun({ agent: "chief", trigger: "capture", inboxItemId: opts.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: opts.text.slice(0, 200), output: { raw: content.text }, ok: false, error: err instanceof Error ? err.message : "parse failed", householdId: opts.householdId });
    return null;
  }

  const validRuleIds = new Set(activeRules.map((r) => r.id));
  const mustFollowIds = new Set(activeRules.filter((r) => r.priority === "must-follow").map((r) => r.id));

  const primary: AgentId = AGENT_IDS.includes(parsed.primary as AgentId) ? (parsed.primary as AgentId) : "chief";
  const secondary: AgentId[] = Array.isArray(parsed.secondary)
    ? (parsed.secondary as unknown[]).filter((a): a is AgentId => typeof a === "string" && AGENT_IDS.includes(a as AgentId) && a !== primary).slice(0, 2)
    : [];

  const invocationsRaw = Array.isArray(parsed.invocations) ? (parsed.invocations as unknown[]) : [];
  const invocations: ChiefInvocation[] = invocationsRaw
    .filter((x): x is { agent: string; focus: string } => !!x && typeof x === "object" && "agent" in x && "focus" in x)
    .map((x) => ({ agent: x.agent as AgentId, focus: String(x.focus) }))
    .filter((inv) => AGENT_IDS.includes(inv.agent) && inv.agent !== "chief")
    .slice(0, 4);

  // Ensure the primary appears as an invocation even if the model omitted it
  if (primary !== "chief" && !invocations.some((inv) => inv.agent === primary)) {
    invocations.unshift({ agent: primary, focus: typeof parsed.analysis === "string" ? parsed.analysis : opts.text });
  }

  const rulesConsulted = Array.isArray(parsed.rules_consulted)
    ? (parsed.rules_consulted as unknown[]).filter((id): id is string => typeof id === "string" && validRuleIds.has(id))
    : [];
  const rulesConflicts = Array.isArray(parsed.rules_conflicts)
    ? (parsed.rules_conflicts as unknown[]).filter((id): id is string => typeof id === "string" && mustFollowIds.has(id))
    : [];

  const decision: ChiefDecision = {
    analysis: typeof parsed.analysis === "string" ? parsed.analysis : "Routing capture.",
    primary, secondary,
    category: CATEGORIES_LIST.includes(parsed.category as Category) ? (parsed.category as Category) : CATEGORY_FALLBACK[primary],
    urgency: PRIORITIES_LIST.includes(parsed.urgency as Priority) ? (parsed.urgency as Priority) : "medium",
    proposedTasks: Array.isArray(parsed.proposedTasks)
      ? (parsed.proposedTasks as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 3)
      : [],
    rulesConsulted, rulesConflicts, invocations,
  };

  void logAgentRun({
    agent: "chief", trigger: "capture", inboxItemId: opts.inboxItemId,
    model: MODEL,
    promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens,
    latencyMs, inputSummary: opts.text.slice(0, 200),
    output: decision as unknown as Record<string, unknown>, ok: true,
    householdId: opts.householdId,
  });

  return decision;
}

// Synthesis pass: after specialists return their drafts, one tiny LLM call
// stitches the Play together in one sentence. Falls back to deterministic
// concat if no LLM is configured.
export async function synthesize(opts: {
  capture: string;
  chiefAnalysis: string;
  draftSummaries: Array<{ agent: AgentId; titles: string[] }>;
  inboxItemId: string;
  householdId: string;
}): Promise<string> {
  const fallback = () => {
    const verbs = opts.draftSummaries.flatMap((s) => s.titles).slice(0, 4);
    return verbs.length ? `The play: ${verbs.join(" · ")}.` : opts.chiefAnalysis;
  };

  const anthropic = getAnthropicClient();
  if (!anthropic) return fallback();

  const prompt = `You are the Chief of Staff. Synthesize a one-sentence "play" from these specialist proposals. Be specific and concrete — name the actions, not the categories.

Capture: "${opts.capture.replace(/"/g, '\\"')}"
Chief analysis: ${opts.chiefAnalysis}

Specialist proposals:
${opts.draftSummaries.map((s) => `  - ${s.agent}: ${s.titles.join("; ")}`).join("\n")}

Return ONLY the one-sentence synthesis. No quotes, no preamble, no markdown. Example: "Busy week + tight budget: 5-day quick-meals plan ($87 under budget), grocery order Sunday, 90-min prep block Sunday 2pm."`;

  const t0 = Date.now();
  try {
    const message = await anthropic.messages.create({
      model: MODEL, max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });
    const content = message.content[0];
    const synthesis = content.type === "text" ? content.text.trim().replace(/^["']|["']$/g, "") : "";

    void logAgentRun({
      agent: "chief", trigger: "capture", inboxItemId: opts.inboxItemId,
      model: MODEL,
      promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens,
      latencyMs: Date.now() - t0, inputSummary: `Play synthesis: ${opts.capture.slice(0, 80)}`,
      output: { synthesis }, ok: !!synthesis,
      householdId: opts.householdId,
    });

    return synthesis || fallback();
  } catch (err) {
    void logAgentRun({
      agent: "chief", trigger: "capture", inboxItemId: opts.inboxItemId,
      model: MODEL, promptTokens: 0, completionTokens: 0,
      latencyMs: Date.now() - t0, inputSummary: `Play synthesis: ${opts.capture.slice(0, 80)}`,
      output: null, ok: false, error: err instanceof Error ? err.message : String(err),
      householdId: opts.householdId,
    });
    return fallback();
  }
}
