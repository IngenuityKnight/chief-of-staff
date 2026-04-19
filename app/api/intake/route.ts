import { NextRequest, NextResponse } from "next/server";
import type { AgentId, Category, Priority } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// POST /api/intake
//
// This is the intake webhook for the Chief of Staff system.
// Contract (same as n8n webhook, so the HTML form works unchanged):
//   Request:  { "text": "..."  }
//   Response: { ok, analysis, routing: {primary, secondary, category}, proposedTasks, urgency }
//
// For the prototype this is a heuristic router. In production,
// swap the body of `analyzeWithHeuristics` for a fetch() to your
// n8n webhook — or call OpenAI/Anthropic directly.
// ─────────────────────────────────────────────────────────────

const KEYWORDS: Record<AgentId, string[]> = {
  meals:    ["meal", "dinner", "lunch", "breakfast", "grocery", "cook", "recipe", "food", "eat", "hungry", "prep", "takeout", "delivery"],
  home:     ["dishwasher", "hvac", "filter", "repair", "broken", "fix", "leak", "plumb", "maintenance", "contractor", "appliance", "lawn", "gutter", "roof"],
  money:    ["bill", "budget", "subscription", "spend", "cost", "pay", "invoice", "expense", "save", "money", "bank", "card"],
  schedule: ["schedule", "calendar", "appointment", "meeting", "book", "time", "busy", "when", "date", "reschedule", "conflict"],
  roster:   ["kids", "child", "spouse", "partner", "mom", "dad", "family", "guest", "party", "birthday", "anniversary"],
  chief:    [],
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
  high:     ["today", "overdue", "overwhelmed", "stressed", "behind", "slipping"],
  medium:   ["this week", "soon", "need to", "should", "planning"],
  low:      ["eventually", "someday", "think about", "explore"],
};

function classify(text: string): AgentId {
  const lower = text.toLowerCase();
  const scores: Record<AgentId, number> = {
    meals: 0, home: 0, money: 0, schedule: 0, roster: 0, chief: 0,
  };
  (Object.keys(KEYWORDS) as AgentId[]).forEach((agent) => {
    for (const kw of KEYWORDS[agent]) {
      if (lower.includes(kw)) scores[agent] += 1;
    }
  });
  const winner = (Object.entries(scores) as Array<[AgentId, number]>)
    .sort((a, b) => b[1] - a[1])[0];
  return winner[1] > 0 ? winner[0] : "chief";
}

function secondaryAgents(text: string, primary: AgentId): AgentId[] {
  const lower = text.toLowerCase();
  const secondary: AgentId[] = [];
  (Object.keys(KEYWORDS) as AgentId[]).forEach((agent) => {
    if (agent === primary || agent === "chief") return;
    const hits = KEYWORDS[agent].filter((k) => lower.includes(k)).length;
    if (hits > 0) secondary.push(agent);
  });
  return secondary.slice(0, 2);
}

function gaugeUrgency(text: string): Priority {
  const lower = text.toLowerCase();
  for (const p of ["critical", "high", "medium", "low"] as Priority[]) {
    if (URGENCY_SIGNALS[p].some((s) => lower.includes(s))) return p;
  }
  return "medium";
}

function synthesizeAnalysis(text: string, primary: AgentId, secondary: AgentId[]): string {
  const primaryName = primary === "chief"
    ? "not yet clear — routing to the Chief of Staff for clarification"
    : `${primary[0].toUpperCase() + primary.slice(1)} Agent`;

  const hasSecondary = secondary.length > 0;
  const secondaryText = hasSecondary
    ? ` Cross-domain signal — looping in ${secondary.map((s) => s[0].toUpperCase() + s.slice(1)).join(" + ")} for coordination.`
    : "";

  return `Captured. Primary domain: ${primaryName}.${secondaryText}`;
}

function proposeTasks(text: string, primary: AgentId): string[] {
  // Domain-flavored task suggestions — lightweight placeholders.
  // In production, the LLM generates these.
  const base: Record<AgentId, string[]> = {
    meals:    ["Draft meal plan for the upcoming window", "Build grocery list with cost estimate", "Block time for prep"],
    home:     ["Diagnose and document the issue", "Check warranty + service history", "If unresolved: gather 3 quotes"],
    money:    ["Confirm account + balance context", "Draft payment or adjustment", "Flag for budget review if > $200"],
    schedule: ["Find available time windows", "Propose 2-3 options for approval", "Send calendar invite once confirmed"],
    roster:   ["Capture context + relationships", "Coordinate across affected household members", "Propose follow-up touchpoints"],
    chief:    ["Ask one clarifying question", "Hold briefly pending input"],
  };
  return base[primary];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = (body?.text ?? "").toString().trim();

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Empty text payload." },
        { status: 400 }
      );
    }

    const primary = classify(text);
    const secondary = secondaryAgents(text, primary);
    const urgency = gaugeUrgency(text);
    const analysis = synthesizeAnalysis(text, primary, secondary);
    const proposedTasks = proposeTasks(text, primary);
    const category = CATEGORY_MAP[primary];

    // In production you'd persist this to Notion here (or hand off to n8n).
    // For the prototype we just return the routing decision.

    return NextResponse.json({
      ok: true,
      id: `inb_${Date.now().toString(36)}`,
      capturedAt: new Date().toISOString(),
      text,
      analysis,
      routing: { primary, secondary, category },
      urgency,
      proposedTasks,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Malformed request." },
      { status: 400 }
    );
  }
}

// Let the dock confirm the endpoint is alive.
export async function GET() {
  return NextResponse.json({ ok: true, service: "intake", version: "0.1.0" });
}
