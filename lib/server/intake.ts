import type { AgentId, Category, Priority } from "@/lib/types";
import { getN8nIntakeWebhookUrl, getN8nWebhookSecret, getSupabaseAdmin } from "@/lib/server/supabase";
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

const KEYWORDS: Record<AgentId, string[]> = {
  meals: ["meal", "dinner", "lunch", "breakfast", "grocery", "cook", "recipe", "food", "eat", "hungry", "prep", "takeout", "delivery"],
  home: ["dishwasher", "hvac", "filter", "repair", "broken", "fix", "leak", "plumb", "maintenance", "contractor", "appliance", "lawn", "gutter", "roof"],
  money: ["bill", "budget", "subscription", "spend", "cost", "pay", "invoice", "expense", "save", "money", "bank", "card"],
  schedule: ["schedule", "calendar", "appointment", "meeting", "book", "time", "busy", "when", "date", "reschedule", "conflict"],
  roster: ["kids", "child", "spouse", "partner", "mom", "dad", "family", "guest", "party", "birthday", "anniversary"],
  chief: [],
};

const CATEGORY_MAP: Record<AgentId, Category> = {
  meals: "Meals",
  home: "Household",
  money: "Finance",
  schedule: "Planning",
  roster: "Social",
  chief: "Admin",
};

const URGENCY_SIGNALS: Record<Priority, string[]> = {
  critical: ["emergency", "asap", "right now", "urgent", "broken", "leaking", "flooding"],
  high: ["today", "overdue", "overwhelmed", "stressed", "behind", "slipping"],
  medium: ["this week", "soon", "need to", "should", "planning"],
  low: ["eventually", "someday", "think about", "explore"],
};

function classify(text: string): AgentId {
  const lower = text.toLowerCase();
  const scores: Record<AgentId, number> = {
    meals: 0,
    home: 0,
    money: 0,
    schedule: 0,
    roster: 0,
    chief: 0,
  };

  (Object.keys(KEYWORDS) as AgentId[]).forEach((agent) => {
    for (const keyword of KEYWORDS[agent]) {
      if (lower.includes(keyword)) scores[agent] += 1;
    }
  });

  const winner = (Object.entries(scores) as Array<[AgentId, number]>).sort((a, b) => b[1] - a[1])[0];
  return winner[1] > 0 ? winner[0] : "chief";
}

function secondaryAgents(text: string, primary: AgentId): AgentId[] {
  const lower = text.toLowerCase();
  const secondary: AgentId[] = [];

  (Object.keys(KEYWORDS) as AgentId[]).forEach((agent) => {
    if (agent === primary || agent === "chief") return;
    const hits = KEYWORDS[agent].filter((keyword) => lower.includes(keyword)).length;
    if (hits > 0) secondary.push(agent);
  });

  return secondary.slice(0, 2);
}

function gaugeUrgency(text: string): Priority {
  const lower = text.toLowerCase();
  for (const priority of ["critical", "high", "medium", "low"] as Priority[]) {
    if (URGENCY_SIGNALS[priority].some((signal) => lower.includes(signal))) return priority;
  }
  return "medium";
}

function synthesizeAnalysis(primary: AgentId, secondary: AgentId[]) {
  const primaryName = primary === "chief"
    ? "not yet clear — routing to the Chief of Staff for clarification"
    : `${primary[0].toUpperCase() + primary.slice(1)} Agent`;

  const secondaryText = secondary.length > 0
    ? ` Cross-domain signal — looping in ${secondary.map((agent) => agent[0].toUpperCase() + agent.slice(1)).join(" + ")} for coordination.`
    : "";

  return `Captured. Primary domain: ${primaryName}.${secondaryText}`;
}

function proposeTasks(primary: AgentId): string[] {
  const base: Record<AgentId, string[]> = {
    meals: ["Draft meal plan for the upcoming window", "Build grocery list with cost estimate", "Block time for prep"],
    home: ["Diagnose and document the issue", "Check warranty + service history", "If unresolved: gather 3 quotes"],
    money: ["Confirm account + balance context", "Draft payment or adjustment", "Flag for budget review if > $200"],
    schedule: ["Find available time windows", "Propose 2-3 options for approval", "Send calendar invite once confirmed"],
    roster: ["Capture context + relationships", "Coordinate across affected household members", "Propose follow-up touchpoints"],
    chief: ["Ask one clarifying question", "Hold briefly pending input"],
  };

  return base[primary];
}

function buildTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 72) return normalized;
  return `${normalized.slice(0, 69).trimEnd()}...`;
}

const AGENT_IDS: AgentId[] = ["meals", "home", "money", "schedule", "roster", "chief"];
const CATEGORIES_LIST = ["Meals", "Cleaning", "Household", "Admin", "Planning", "Finance", "Social"];
const PRIORITIES_LIST = ["low", "medium", "high", "critical"];

async function analyzeWithClaude(text: string): Promise<Omit<IntakeAnalysis, "id" | "capturedAt" | "text"> | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const prompt = `You are the Chief of Staff routing engine for a household management system. Analyze this household input and return a JSON object.

Input: "${text.replace(/"/g, '\\"')}"

Agents: ${AGENT_IDS.join(", ")}
Categories: ${CATEGORIES_LIST.join(", ")}
Urgency levels: ${PRIORITIES_LIST.join(", ")}

Return ONLY valid JSON with this exact shape:
{
  "primary": "<agent>",
  "secondary": ["<agent>", ...],
  "category": "<category>",
  "urgency": "<urgency>",
  "analysis": "<1-2 sentence summary of what was captured and why it was routed this way>",
  "proposedTasks": ["<task 1>", "<task 2>", "<task 3>"]
}

Rules:
- primary: the single best-fit agent
- secondary: 0-2 other agents that need to coordinate (exclude primary)
- proposedTasks: 2-3 concrete, actionable next steps for the primary agent
- analysis: brief, decisive — no hedging`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    const primary: AgentId = AGENT_IDS.includes(parsed.primary) ? parsed.primary : "chief";
    const secondary: AgentId[] = Array.isArray(parsed.secondary)
      ? parsed.secondary.filter((a: string) => AGENT_IDS.includes(a as AgentId) && a !== primary).slice(0, 2)
      : [];
    const category: Category = CATEGORIES_LIST.includes(parsed.category) ? parsed.category : CATEGORY_MAP[primary];
    const urgency: Priority = PRIORITIES_LIST.includes(parsed.urgency) ? parsed.urgency : "medium";
    const analysis = typeof parsed.analysis === "string" ? parsed.analysis : synthesizeAnalysis(primary, secondary);
    const proposedTasks = Array.isArray(parsed.proposedTasks)
      ? parsed.proposedTasks.filter((t: unknown) => typeof t === "string").slice(0, 3)
      : proposeTasks(primary);

    return { analysis, routing: { primary, secondary, category }, urgency, proposedTasks };
  } catch {
    return null;
  }
}

export async function analyzeIntake(text: string, source = "web"): Promise<IntakeAnalysis & { source: string }> {
  const capturedAt = new Date().toISOString();
  const id = `inb_${Date.now().toString(36)}`;

  // Try Claude first; fall back to heuristics
  const llm = await analyzeWithClaude(text);

  if (llm) {
    return {
      id,
      capturedAt,
      text,
      source,
      analysis: llm.analysis,
      routing: llm.routing,
      urgency: llm.urgency,
      proposedTasks: llm.proposedTasks,
    };
  }

  // Heuristic fallback
  const primary = classify(text);
  const secondary = secondaryAgents(text, primary);
  const urgency = gaugeUrgency(text);
  const category = CATEGORY_MAP[primary];

  return {
    id,
    capturedAt,
    text,
    source,
    analysis: synthesizeAnalysis(primary, secondary),
    routing: { primary, secondary, category },
    urgency,
    proposedTasks: proposeTasks(primary),
  };
}

export async function persistIntake(analysis: IntakeAnalysis & { source?: string }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { persisted: false as const, backend: "mock" as const };
  }

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
    return { persisted: false as const, backend: "supabase" as const, error: error.message };
  }

  return { persisted: true as const, backend: "supabase" as const };
}

export async function forwardIntakeToN8n(analysis: IntakeAnalysis) {
  const webhookUrl = getN8nIntakeWebhookUrl();
  if (!webhookUrl) {
    return { forwarded: false as const, backend: "disabled" as const };
  }

  const secret = getN8nWebhookSecret();
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-webhook-secret": secret } : {}),
    },
    body: JSON.stringify({
      id: analysis.id,
      capturedAt: analysis.capturedAt,
      text: analysis.text,
      analysis: analysis.analysis,
      routing: analysis.routing,
      urgency: analysis.urgency,
      proposedTasks: analysis.proposedTasks,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("n8n intake webhook failed:", response.status, body);
    return { forwarded: false as const, backend: "n8n" as const, status: response.status };
  }

  return { forwarded: true as const, backend: "n8n" as const };
}
