import type { AgentId, Category, Priority } from "@/lib/types";
import { gate } from "@/lib/server/agents/policy";
import { executeProposal } from "@/lib/server/agents/executors";
import { logAgentRun } from "@/lib/server/agents/agent-runs";
import type { ProposalDraft } from "@/lib/server/agents/schemas";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getAnthropicClient } from "@/lib/server/anthropic";
import { logActivity } from "@/lib/server/activity";
import { assembleContextForIntake } from "@/lib/server/context";
import { getCurrentHousehold } from "@/lib/server/household";

export type IntakeAnalysis = {
  id: string;
  capturedAt: string;
  text: string;
  analysis: string;
  routing: {
    primary: AgentId;
    secondary: AgentId[];
    category: Category;
  };
  urgency: Priority;
  proposedTasks: string[];
  rulesConsulted: string[];   // rule IDs the chief cited as relevant
  rulesConflicts: string[];   // must-follow rule IDs the chief flagged as potentially violated
  householdId: string;        // tenant scope for every downstream insert
  invocations?: Array<{ agent: AgentId; focus: string }>;
};

export type CreatedTask = {
  id: string;
  title: string;
  agent: AgentId;
};

export type AppliedChange = {
  id: string;
  resource: "calendar" | "decisions" | "shopping";
  label: string;
};

// ─── Keyword routing (fallback when Claude is unavailable) ────────────────────

const KEYWORDS: Record<AgentId, string[]> = {
  meals:    ["meal", "dinner", "lunch", "breakfast", "grocery", "cook", "recipe", "food", "eat", "hungry", "prep", "takeout", "delivery", "pantry", "ingredients"],
  home:     ["dishwasher", "hvac", "filter", "repair", "broken", "fix", "leak", "plumb", "maintenance", "contractor", "appliance", "lawn", "gutter", "roof", "furnace"],
  money:    ["bill", "budget", "subscription", "spend", "cost", "pay", "invoice", "expense", "save", "money", "bank", "card", "insurance", "fee"],
  schedule: ["schedule", "calendar", "appointment", "meeting", "book", "time", "busy", "when", "date", "reschedule", "conflict", "remind"],
  roster:   ["kids", "child", "spouse", "partner", "mom", "dad", "family", "guest", "party", "birthday", "anniversary", "dog", "pet"],
  chief:    [],
};

export const CATEGORY_MAP: Record<AgentId, Category> = {
  meals:    "Meals",
  home:     "Household",
  money:    "Finance",
  schedule: "Planning",
  roster:   "Social",
  chief:    "Admin",
};

const URGENCY_SIGNALS: Record<Priority, string[]> = {
  critical: ["emergency", "asap", "right now", "urgent", "broken", "leaking", "flooding", "out of"],
  high:     ["today", "overdue", "overwhelmed", "stressed", "behind", "slipping", "running low"],
  medium:   ["this week", "soon", "need to", "should", "planning", "want to"],
  low:      ["eventually", "someday", "think about", "explore", "maybe"],
};

function classify(text: string): AgentId {
  const lower = text.toLowerCase();
  const scores = Object.fromEntries(
    (Object.keys(KEYWORDS) as AgentId[]).map((agent) => [
      agent,
      KEYWORDS[agent].filter((kw) => lower.includes(kw)).length,
    ])
  ) as Record<AgentId, number>;
  const [winner] = (Object.entries(scores) as Array<[AgentId, number]>).sort((a, b) => b[1] - a[1]);
  return winner[1] > 0 ? winner[0] : "chief";
}

function secondaryAgents(text: string, primary: AgentId): AgentId[] {
  const lower = text.toLowerCase();
  return (Object.keys(KEYWORDS) as AgentId[])
    .filter((a) => a !== primary && a !== "chief")
    .filter((a) => KEYWORDS[a].some((kw) => lower.includes(kw)))
    .slice(0, 2);
}

function gaugeUrgency(text: string): Priority {
  const lower = text.toLowerCase();
  for (const priority of ["critical", "high", "medium", "low"] as Priority[]) {
    if (URGENCY_SIGNALS[priority].some((s) => lower.includes(s))) return priority;
  }
  return "medium";
}

function synthesizeAnalysis(primary: AgentId, secondary: AgentId[]) {
  const name = primary === "chief" ? "Chief of Staff" : `${primary[0].toUpperCase()}${primary.slice(1)} Agent`;
  const cross = secondary.length > 0
    ? ` Also looping in ${secondary.map((a) => `${a[0].toUpperCase()}${a.slice(1)}`).join(" + ")}.`
    : "";
  return `Routed to ${name}.${cross}`;
}

function proposeTasks(primary: AgentId, text: string): string[] {
  const lower = text.toLowerCase();

  // Context-aware task suggestions
  if (primary === "home") {
    if (lower.includes("repair") || lower.includes("broken") || lower.includes("fix"))
      return ["Diagnose and document the issue", "Check warranty + service history", "Get 2–3 repair quotes if > $100"];
    if (lower.includes("maintenance") || lower.includes("filter") || lower.includes("hvac"))
      return ["Schedule the maintenance service", "Update maintenance log when done"];
  }
  if (primary === "money") {
    if (lower.includes("bill") || lower.includes("pay"))
      return ["Verify the bill amount + due date", "Pay or schedule autopay", "Update the bills tracker"];
    return ["Review the budget impact", "Log the expense", "Flag if over budget threshold"];
  }
  if (primary === "meals") {
    return ["Plan meals for the week", "Build grocery list from pantry gaps", "Block prep time on calendar"];
  }
  if (primary === "schedule") {
    return ["Find available time windows", "Send calendar invite once confirmed", "Set a reminder 24h before"];
  }
  if (primary === "roster") {
    return ["Note the context for relevant household members", "Follow up on any coordination needed"];
  }

  const defaults: Record<AgentId, string[]> = {
    meals:    ["Plan meals for the week", "Build grocery list from pantry gaps"],
    home:     ["Document the issue", "Check warranty + service history"],
    money:    ["Review budget impact", "Log the expense"],
    schedule: ["Find open time slots", "Confirm and send invite"],
    roster:   ["Capture context", "Coordinate with household members"],
    chief:    ["Clarify the request", "Route to the right agent once clear"],
  };
  return defaults[primary];
}

function buildTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 69).trimEnd()}…`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextWeekday(target: number) {
  const date = startOfToday();
  const diff = (target - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date;
}

function parseRequestedDate(text: string) {
  const lower = text.toLowerCase();
  const today = startOfToday();
  if (lower.includes("today")) return today;
  if (lower.includes("tomorrow")) {
    const date = startOfToday();
    date.setDate(date.getDate() + 1);
    return date;
  }

  const weekdays: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  for (const [day, index] of Object.entries(weekdays)) {
    if (lower.includes(day)) return nextWeekday(index);
  }

  const dateMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!dateMatch) return null;

  const month = Number(dateMatch[1]) - 1;
  const day = Number(dateMatch[2]);
  const year = dateMatch[3]
    ? Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3])
    : today.getFullYear();
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRequestedTime(text: string) {
  const lower = text.toLowerCase();
  const match =
    lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) ??
    lower.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b/);
  const hourOnlyMatch = match ? null : lower.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (!match && !hourOnlyMatch) return { hours: 9, minutes: 0 };

  let hours = Number((match ?? hourOnlyMatch)![1]);
  const minutes = match ? Number(match[2] ?? 0) : 0;
  const meridiem = match ? match[3] : hourOnlyMatch![2];
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (!meridiem && hours < 7) hours += 12;
  return { hours, minutes };
}

function parseDurationMinutes(text: string) {
  const lower = text.toLowerCase();
  const hourMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:hour|hr|hrs|hours)\b/);
  if (hourMatch) return Math.max(15, Math.round(Number(hourMatch[1]) * 60));
  const minuteMatch = lower.match(/\b(\d+)\s*(?:minute|min|mins|minutes)\b/);
  if (minuteMatch) return Math.max(15, Number(minuteMatch[1]));
  return 60;
}

function cleanEventTitle(text: string) {
  return buildTitle(
    text
      .replace(/\b(add|create|schedule|book|block|put|set up)\b/gi, "")
      .replace(/\b(on|for|at)\s+(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi, "")
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
      .replace(/\bfor\s+\d+(?:\.\d+)?\s*(?:hour|hr|hrs|hours|minute|min|mins|minutes)s?\b/gi, "")
      .trim()
  );
}

function parseShoppingItems(text: string) {
  const lower = text.toLowerCase();
  const marker =
    lower.match(/\b(?:add|buy|get|need|pick up)\b([\s\S]+?)(?:\bto (?:the )?shopping list\b|\bfrom\b|$)/) ??
    lower.match(/\b(?:out of|running low on|low on)\b([\s\S]+)$/);
  if (!marker) return [];

  return marker[1]
    .replace(/\b(?:to|the|shopping|list|please)\b/gi, " ")
    .split(/,|\band\b|\+/i)
    .map((item) => item.trim().replace(/^[\s.:-]+|[\s.:-]+$/g, ""))
    .filter((item) => item.length > 1)
    .slice(0, 5);
}

function shouldCreateDecision(text: string) {
  const lower = text.toLowerCase();
  return /\b(decide|decision|choose|pick|figure out|should we|which|approve|quote|option|compare)\b/.test(lower);
}

function buildDecisionTitle(text: string) {
  const normalized = text
    .replace(/\b(we need to|need to|can you|please|help me|help us)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const title = normalized.length > 0 ? normalized : text;
  return buildTitle(title[0]?.toUpperCase() + title.slice(1));
}

function decisionRecommendation(text: string, category: Category) {
  const lower = text.toLowerCase();
  if (lower.includes("quote") || lower.includes("repair")) return "Compare cost, urgency, and whether a lower-effort fix is worth trying first.";
  if (lower.includes("subscription") || lower.includes("cancel")) return "Check usage before canceling so savings do not create household friction.";
  if (category === "Finance") return "Estimate the cash impact before committing.";
  if (category === "Planning") return "Choose the lowest-friction option that protects the deadline.";
  return "Capture the options, pick a next action, and set a deadline if timing matters.";
}

function decisionOptionsFor(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("quote") || lower.includes("repair")) return ["Try a low-cost fix first", "Approve the best quote", "Defer and monitor"];
  if (lower.includes("subscription") || lower.includes("cancel")) return ["Keep as-is", "Downgrade", "Cancel"];
  return ["Approve", "Defer", "Dismiss"];
}

// ─── Claude analysis ──────────────────────────────────────────────────────────

const AGENT_IDS: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];
const CATEGORIES_LIST = ["Meals", "Cleaning", "Household", "Admin", "Planning", "Finance", "Social"];
const PRIORITIES_LIST = ["low", "medium", "high", "critical"];
const MODEL = "claude-haiku-4-5-20251001";

async function analyzeWithClaude(
  text: string,
  inboxItemId: string,
): Promise<Omit<IntakeAnalysis, "id" | "capturedAt" | "text" | "householdId"> | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const { text: householdCtx, activeRules } = await assembleContextForIntake();

  const prompt = `${householdCtx}You are the Chief of Staff routing engine for a frugal household management system. Analyze this household input and return JSON.

Input: "${text.replace(/"/g, '\\"')}"

Agents: ${AGENT_IDS.join(", ")}
Categories: ${CATEGORIES_LIST.join(", ")}
Urgency: ${PRIORITIES_LIST.join(", ")}

Return ONLY valid JSON — no markdown, no explanation:
{
  "primary": "<agent>",
  "secondary": ["<agent>"],
  "category": "<category>",
  "urgency": "<urgency>",
  "analysis": "<1-2 sentence summary — what was captured, why routed this way, any frugal or rule angle>",
  "proposedTasks": ["<concrete actionable task 1>", "<task 2>", "<task 3>"],
  "rules_consulted": ["<rule-id from ACTIVE RULES section that informed this analysis>"],
  "rules_conflicts": ["<id of a [MUST] rule that this action would directly violate>"]
}

Instructions:
- proposedTasks: 2-3 specific, actionable tasks — not generic placeholders
- If any ACTIVE RULES apply to this input, note them in analysis and list their IDs in rules_consulted
- rules_conflicts: only include IDs of [MUST] rules whose stated constraint this action would break — leave empty if none
- If the input mentions money or costs, note the frugal angle in analysis
- urgency=critical only for genuine emergencies`;

  const t0 = Date.now();
  let message: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
  let parseError: string | undefined;

  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    void logAgentRun({
      agent: "chief",
      trigger: "capture",
      inboxItemId,
      model: MODEL,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - t0,
      inputSummary: text.slice(0, 200),
      output: null,
      ok: false,
      error: errMsg,
    });
    return null;
  }

  const latencyMs = Date.now() - t0;
  const content = message.content[0];

  if (content.type !== "text") {
    void logAgentRun({ agent: "chief", trigger: "capture", inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: text.slice(0, 200), output: null, ok: false, error: "non-text response" });
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    parseError = err instanceof Error ? err.message : "parse failed";
    void logAgentRun({ agent: "chief", trigger: "capture", inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: text.slice(0, 200), output: { raw: content.text }, ok: false, error: parseError });
    return null;
  }

  const primary: AgentId = AGENT_IDS.includes(parsed.primary as AgentId) ? (parsed.primary as AgentId) : "chief";
  const secondary: AgentId[] = Array.isArray(parsed.secondary)
    ? (parsed.secondary as unknown[]).filter((a): a is AgentId => typeof a === "string" && AGENT_IDS.includes(a as AgentId) && a !== primary).slice(0, 2)
    : [];

  // Validate rule IDs — only keep IDs that actually exist in the active rules list
  const validRuleIds = new Set(activeRules.map((r) => r.id));
  const mustFollowIds = new Set(activeRules.filter((r) => r.priority === "must-follow").map((r) => r.id));

  const rulesConsulted: string[] = Array.isArray(parsed.rules_consulted)
    ? (parsed.rules_consulted as unknown[]).filter((id): id is string => typeof id === "string" && validRuleIds.has(id))
    : [];

  // Conflicts: LLM-reported, then code-validated — only must-follow rules count as binding conflicts
  const rulesConflicts: string[] = Array.isArray(parsed.rules_conflicts)
    ? (parsed.rules_conflicts as unknown[]).filter((id): id is string => typeof id === "string" && mustFollowIds.has(id))
    : [];

  const result: Omit<IntakeAnalysis, "id" | "capturedAt" | "text" | "householdId"> = {
    analysis:       typeof parsed.analysis === "string" ? parsed.analysis : synthesizeAnalysis(primary, secondary),
    routing:        { primary, secondary, category: CATEGORIES_LIST.includes(parsed.category as string) ? parsed.category as Category : CATEGORY_MAP[primary] },
    urgency:        PRIORITIES_LIST.includes(parsed.urgency as string) ? parsed.urgency as Priority : "medium",
    proposedTasks:  Array.isArray(parsed.proposedTasks)
      ? parsed.proposedTasks.filter((t: unknown) => typeof t === "string").slice(0, 3) as string[]
      : proposeTasks(primary, text),
    rulesConsulted,
    rulesConflicts,
  };

  void logAgentRun({
    agent: "chief",
    trigger: "capture",
    inboxItemId,
    model: MODEL,
    promptTokens: message.usage.input_tokens,
    completionTokens: message.usage.output_tokens,
    latencyMs,
    inputSummary: text.slice(0, 200),
    output: result as unknown as Record<string, unknown>,
    ok: true,
  });

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyzeIntake(text: string, source = "web", householdIdOverride?: string): Promise<IntakeAnalysis & { source: string }> {
  const id = `inb_${crypto.randomUUID()}`;
  const capturedAt = new Date().toISOString();
  const householdId = householdIdOverride ?? (await getCurrentHousehold());

  // Prefer the new chief.run module (chief.ts). Fall back to the legacy
  // analyzeWithClaude (which still runs but is being retired) if that fails.
  const { run: runChief } = await import("@/lib/server/agents/chief");
  const chiefDecision = await runChief({ text, inboxItemId: id, householdId });

  if (chiefDecision) {
    return {
      id, capturedAt, text, source, householdId,
      analysis: chiefDecision.analysis,
      routing: { primary: chiefDecision.primary, secondary: chiefDecision.secondary, category: chiefDecision.category },
      urgency: chiefDecision.urgency,
      proposedTasks: chiefDecision.proposedTasks,
      rulesConsulted: chiefDecision.rulesConsulted,
      rulesConflicts: chiefDecision.rulesConflicts,
      invocations: chiefDecision.invocations,
    };
  }

  const llm = await analyzeWithClaude(text, id);
  if (llm) {
    return { id, capturedAt, text, source, householdId, ...llm };
  }

  // Degraded-honesty fallback: keyword routing, no LLM, no rule citation
  const primary = classify(text);
  const secondary = secondaryAgents(text, primary);
  return {
    id,
    capturedAt,
    text,
    source,
    householdId,
    analysis: synthesizeAnalysis(primary, secondary),
    routing: { primary, secondary, category: CATEGORY_MAP[primary] },
    urgency: gaugeUrgency(text),
    proposedTasks: proposeTasks(primary, text),
    rulesConsulted: [],
    rulesConflicts: [],
  };
}

export async function persistIntake(
  analysis: IntakeAnalysis & { source?: string },
  options?: { origin?: "capture" | "scanner"; rawInputOverride?: string },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { persisted: false as const };

  const { error } = await supabase.from("inbox_items").insert({
    id: analysis.id,
    household_id: analysis.householdId,
    title: buildTitle(analysis.text),
    raw_input: options?.rawInputOverride ?? analysis.text,
    analysis: analysis.analysis,
    primary_agent: analysis.routing.primary,
    secondary_agents: analysis.routing.secondary,
    category: analysis.routing.category,
    needs_action: analysis.proposedTasks.length > 0,
    proposed_tasks: analysis.proposedTasks,
    status: "new",
    origin: options?.origin ?? "capture",
    source: analysis.source ?? "web",
    created_at: analysis.capturedAt,
    urgency: analysis.urgency,
  });

  if (error) {
    console.error("Supabase intake insert failed:", error);
    return { persisted: false as const, error: error.message };
  }

  await logActivity({
    event_type: "item_captured",
    domain: "inbox",
    entity_title: buildTitle(analysis.text),
    entity_id: analysis.id,
    metadata: { primary_agent: analysis.routing.primary, urgency: analysis.urgency },
    household_id: analysis.householdId,
  });

  return { persisted: true as const };
}

export type ProposalResult = { id: string; title: string; gateDecision: string; gateReason: string };

// Shared infrastructure: insert proposal drafts, run the policy gate on each,
// auto-execute where trust permits. Used by all specialist paths.
export async function persistAndGateProposals(
  drafts: ProposalDraft[],
  analysis: IntakeAnalysis,
  options?: { playId?: string | null },
): Promise<ProposalResult[]> {
  if (drafts.length === 0) return [];
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const [rulesResult, trustResult] = await Promise.all([
    supabase
      .from("rules")
      .select("id")
      .eq("household_id", analysis.householdId)
      .eq("priority", "must-follow")
      .eq("active", true),
    supabase
      .from("agent_trust")
      .select("level")
      .eq("household_id", analysis.householdId)
      .eq("agent", analysis.routing.primary)
      .eq("kind", drafts[0].kind)
      .maybeSingle(),
  ]);

  const mustFollowRuleIds = new Set(
    ((rulesResult.data ?? []) as { id: string }[]).map((r) => r.id)
  );
  const trustLevel: number = (trustResult.data as { level: number } | null)?.level ?? 0;
  const now = new Date().toISOString();

  const rows = drafts.map((d) => ({
    id: crypto.randomUUID(),
    household_id: analysis.householdId,
    play_id: options?.playId ?? null,
    inbox_item_id: d.inboxItemId,
    agent: d.agent,
    kind: d.kind,
    title: d.title,
    rationale: d.rationale,
    payload: d.payload,
    estimated_cost_cents: d.estimatedCostCents,
    rules_consulted: d.rulesConsulted,
    rules_conflicts: d.rulesConflicts,
    status: "awaiting_approval",
    created_at: now,
  }));

  const { error } = await supabase.from("proposals").insert(rows);
  if (error) {
    console.error("Proposal insert failed:", error);
    return [];
  }

  const results: ProposalResult[] = [];
  for (const row of rows) {
    const verdict = gate(
      { kind: row.kind, estimatedCostCents: row.estimated_cost_cents, rulesConflicts: row.rules_conflicts },
      mustFollowRuleIds,
      trustLevel,
    );

    if (verdict.decision === "auto") {
      await executeProposal(
        { id: row.id, kind: row.kind, payload: row.payload, inbox_item_id: row.inbox_item_id },
        "policy",
      );
    }

    results.push({ id: row.id, title: row.title, gateDecision: verdict.decision, gateReason: verdict.reason });
  }

  // Bump usage counters for rules the chief cited
  const allConsulted = [...new Set(drafts.flatMap((d) => d.rulesConsulted))];
  if (allConsulted.length > 0) {
    await Promise.all(
      allConsulted.map((ruleId) =>
        supabase.rpc("increment_rule_consulted", { rule_id: ruleId, consulted_at: now })
      )
    );
  }

  // Outbox: one event per gate verdict — n8n drains for notifications.
  await supabase.from("events").insert(
    rows.map((row) => ({
      household_id: analysis.householdId,
      type: row.status === "awaiting_approval" ? "proposal.created" : "proposal.auto_executed",
      entity_id: row.id,
      payload: { agent: row.agent, kind: row.kind, title: row.title },
    }))
  );

  return results;
}

// Entry point: builds proposals from an intake analysis.
// Delegates to the orchestrator which runs the chief → specialists fan-out
// → Play synthesis → policy gate.
export async function createProposalsFromIntake(analysis: IntakeAnalysis): Promise<ProposalResult[]> {
  const { orchestrate } = await import("@/lib/server/agents/orchestrator");

  // Re-derive a ChiefDecision shape from the analysis. The chief already ran
  // during analyzeIntake() — its routing + invocations are stored on the
  // analysis object. We reconstruct a minimal ChiefDecision so the orchestrator
  // can fan out without re-calling Claude.
  const chiefDecision = {
    analysis: analysis.analysis,
    primary: analysis.routing.primary,
    secondary: analysis.routing.secondary,
    category: analysis.routing.category,
    urgency: analysis.urgency,
    proposedTasks: analysis.proposedTasks,
    rulesConsulted: analysis.rulesConsulted,
    rulesConflicts: analysis.rulesConflicts,
    invocations: analysis.invocations ?? [
      ...(analysis.routing.primary !== "chief" ? [{ agent: analysis.routing.primary, focus: analysis.analysis }] : []),
      ...analysis.routing.secondary.filter((a) => a !== "chief").map((agent) => ({ agent, focus: "" })),
    ],
  };

  const result = await orchestrate(analysis, chiefDecision);
  return result.proposals;
}

export async function applyIntakeChanges(analysis: IntakeAnalysis): Promise<AppliedChange[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const changes: AppliedChange[] = [];
  const lower = analysis.text.toLowerCase();

  if (shouldCreateDecision(analysis.text)) {
    const id = crypto.randomUUID();
    const title = buildDecisionTitle(analysis.text);
    const { error } = await supabase.from("decisions").insert({
      id,
      title,
      context: analysis.text,
      status: "open",
      priority: analysis.urgency,
      category: analysis.routing.category,
      recommendation: decisionRecommendation(analysis.text, analysis.routing.category),
      options: decisionOptionsFor(analysis.text),
      source_inbox_item_id: analysis.id,
      created_at: new Date().toISOString(),
    });

    if (!error) changes.push({ id, resource: "decisions", label: `Created decision: ${title}` });
    else console.error("Decision creation from intake failed:", error);
  }

  if (
    analysis.routing.primary === "schedule" &&
    /\b(add|create|schedule|book|block|put|set up)\b/.test(lower)
  ) {
    const date = parseRequestedDate(analysis.text);
    if (date) {
      const { hours, minutes } = parseRequestedTime(analysis.text);
      const start = new Date(date);
      start.setHours(hours, minutes, 0, 0);
      const end = new Date(start.getTime() + parseDurationMinutes(analysis.text) * 60_000);
      const title = cleanEventTitle(analysis.text) || buildTitle(analysis.text);
      const id = crypto.randomUUID();

      const { error } = await supabase.from("calendar_events").insert({
        id,
        title,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        type: lower.includes("block") ? "block" : lower.includes("meeting") ? "meeting" : "event",
        location: null,
        notes: `Created by Chief of Staff from: ${analysis.text}`,
        agent: "schedule",
      });

      if (!error) changes.push({ id, resource: "calendar", label: `Created calendar event: ${title}` });
      else console.error("Calendar change from intake failed:", error);
    }
  }

  if (analysis.routing.primary === "meals" || /\b(shopping list|buy|get|out of|running low|low on)\b/.test(lower)) {
    const items = parseShoppingItems(analysis.text);
    if (items.length > 0) {
      const rows = items.map((name) => ({
        id: crypto.randomUUID(),
        name,
        quantity: 1,
        unit: "count",
        source: "ai",
        priority: analysis.urgency,
        status: "needed",
        category: "food",
        notes: `Created by Chief of Staff from: ${analysis.text}`,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("shopping_list_items").insert(rows);
      if (!error) {
        changes.push(...rows.map((row) => ({ id: row.id, resource: "shopping" as const, label: `Added shopping item: ${row.name}` })));
      } else {
        console.error("Shopping change from intake failed:", error);
      }
    }
  }

  return changes;
}
