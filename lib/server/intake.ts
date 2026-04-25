import type { AgentId, Category, Priority } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getAnthropicClient } from "@/lib/server/anthropic";

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
};

export type CreatedTask = {
  id: string;
  title: string;
  agent: AgentId;
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

const CATEGORY_MAP: Record<AgentId, Category> = {
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

// ─── Claude analysis ──────────────────────────────────────────────────────────

const AGENT_IDS: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];
const CATEGORIES_LIST = ["Meals", "Cleaning", "Household", "Admin", "Planning", "Finance", "Social"];
const PRIORITIES_LIST = ["low", "medium", "high", "critical"];

async function analyzeWithClaude(text: string): Promise<Omit<IntakeAnalysis, "id" | "capturedAt" | "text"> | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const prompt = `You are the Chief of Staff routing engine for a frugal household management system. Analyze this household input and return JSON.

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
  "analysis": "<1-2 sentence summary — what was captured, why routed this way, any frugal angle>",
  "proposedTasks": ["<concrete actionable task 1>", "<task 2>", "<task 3>"]
}

Rules:
- proposedTasks: 2-3 specific, actionable tasks — not generic placeholders
- If the input mentions money or costs, note the frugal angle in analysis
- urgency=critical only for genuine emergencies`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const primary: AgentId = AGENT_IDS.includes(parsed.primary) ? parsed.primary : "chief";
    const secondary: AgentId[] = Array.isArray(parsed.secondary)
      ? parsed.secondary.filter((a: string) => AGENT_IDS.includes(a as AgentId) && a !== primary).slice(0, 2) as AgentId[]
      : [];

    return {
      analysis:      typeof parsed.analysis === "string" ? parsed.analysis : synthesizeAnalysis(primary, secondary),
      routing:       { primary, secondary, category: CATEGORIES_LIST.includes(parsed.category) ? parsed.category : CATEGORY_MAP[primary] },
      urgency:       PRIORITIES_LIST.includes(parsed.urgency) ? parsed.urgency as Priority : "medium",
      proposedTasks: Array.isArray(parsed.proposedTasks)
        ? parsed.proposedTasks.filter((t: unknown) => typeof t === "string").slice(0, 3) as string[]
        : proposeTasks(primary, text),
    };
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyzeIntake(text: string, source = "web"): Promise<IntakeAnalysis & { source: string }> {
  const id = `inb_${Date.now().toString(36)}`;
  const capturedAt = new Date().toISOString();
  const llm = await analyzeWithClaude(text);

  if (llm) {
    return { id, capturedAt, text, source, ...llm };
  }

  const primary = classify(text);
  const secondary = secondaryAgents(text, primary);
  return {
    id,
    capturedAt,
    text,
    source,
    analysis: synthesizeAnalysis(primary, secondary),
    routing: { primary, secondary, category: CATEGORY_MAP[primary] },
    urgency: gaugeUrgency(text),
    proposedTasks: proposeTasks(primary, text),
  };
}

export async function persistIntake(analysis: IntakeAnalysis & { source?: string }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { persisted: false as const };

  const { error } = await supabase.from("inbox_items").insert({
    id: analysis.id,
    title: buildTitle(analysis.text),
    raw_input: analysis.text,
    analysis: analysis.analysis,
    primary_agent: analysis.routing.primary,
    secondary_agents: analysis.routing.secondary,
    category: analysis.routing.category,
    needs_action: analysis.proposedTasks.length > 0,
    proposed_tasks: analysis.proposedTasks,
    status: "routed",
    source: analysis.source ?? "web",
    created_at: analysis.capturedAt,
    urgency: analysis.urgency,
  });

  if (error) {
    console.error("Supabase intake insert failed:", error);
    return { persisted: false as const, error: error.message };
  }

  return { persisted: true as const };
}

export async function createTasksFromIntake(analysis: IntakeAnalysis): Promise<CreatedTask[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase || analysis.proposedTasks.length === 0) return [];

  const rows = analysis.proposedTasks.map((title) => ({
    id: crypto.randomUUID(),
    title,
    agent: analysis.routing.primary,
    category: analysis.routing.category,
    status: "todo",
    priority: analysis.urgency,
    inbox_item_id: analysis.id,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("tasks").insert(rows);
  if (error) {
    console.error("Task creation from intake failed:", error);
    return [];
  }

  return rows.map((r) => ({ id: r.id, title: r.title, agent: r.agent as AgentId }));
}
