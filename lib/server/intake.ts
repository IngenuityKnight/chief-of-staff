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

export type AppliedChange = {
  id: string;
  resource: "calendar" | "shopping";
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

export async function applyIntakeChanges(analysis: IntakeAnalysis): Promise<AppliedChange[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const changes: AppliedChange[] = [];
  const lower = analysis.text.toLowerCase();

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
