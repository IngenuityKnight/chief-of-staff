// Daily briefing generator (BACKEND-BRIEF.md §5).
// One LLM call that synthesizes open proposals, today's events, overdue tasks,
// bills due soon, and maintenance flags into a structured BriefingSummary.
// Result is stored in daily_briefings so the UI reads a cached copy.

import { getAnthropicClient } from "@/lib/server/anthropic";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { logAgentRun } from "@/lib/server/agents/agent-runs";
import { getHouseholdForJob } from "@/lib/server/household";
import type { BriefingSummary, AgentId } from "@/lib/types";

const MODEL = "claude-haiku-4-5-20251001";

export async function generateDailyBriefing(householdId?: string): Promise<BriefingSummary | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const tenantId = householdId ?? getHouseholdForJob();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const in3Days = new Date(now.getTime() + 3 * 86_400_000).toISOString();
  const in14Days = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [
    proposalsResult,
    todayEventsResult,
    tasksResult,
    billsResult,
    maintenanceResult,
    lowStockResult,
    weekActivityResult,
  ] = await Promise.allSettled([
    supabase.from("proposals").select("id, title, agent, kind, status").eq("household_id", tenantId).eq("status", "awaiting_approval").limit(10),
    supabase.from("calendar_events").select("title, start_at").eq("household_id", tenantId).gte("start_at", now.toISOString()).lte("start_at", todayEnd),
    supabase.from("tasks").select("id, title, agent, status, due_date").eq("household_id", tenantId).neq("status", "done").limit(20),
    supabase.from("bills").select("name, amount, due_date").eq("household_id", tenantId).neq("status", "paid").lte("due_date", in3Days).gte("due_date", today),
    supabase.from("maintenance_items").select("item, next_due").eq("household_id", tenantId).lte("next_due", in14Days).not("status", "eq", "in-progress"),
    supabase.from("inventory_items").select("name").eq("household_id", tenantId).not("min_quantity", "is", null).filter("quantity", "lte", "min_quantity"),
    supabase.from("activity_log").select("event_type").eq("household_id", tenantId).gte("occurred_at", weekAgo),
  ]);

  const proposals = (proposalsResult.status === "fulfilled" ? proposalsResult.value.data ?? [] : []) as Array<{ id: string; title: string; agent: string; kind: string }>;
  const todayEvents = (todayEventsResult.status === "fulfilled" ? todayEventsResult.value.data ?? [] : []) as Array<{ title: string; start_at: string }>;
  const tasks = (tasksResult.status === "fulfilled" ? tasksResult.value.data ?? [] : []) as Array<{ id: string; title: string; agent: string; status: string; due_date?: string }>;
  const bills = (billsResult.status === "fulfilled" ? billsResult.value.data ?? [] : []) as Array<{ name: string; amount: number; due_date: string }>;
  const maintenance = (maintenanceResult.status === "fulfilled" ? maintenanceResult.value.data ?? [] : []) as Array<{ item: string }>;
  const lowStock = (lowStockResult.status === "fulfilled" ? lowStockResult.value.data ?? [] : []) as Array<{ name: string }>;
  const weekActivity = (weekActivityResult.status === "fulfilled" ? weekActivityResult.value.data ?? [] : []) as Array<{ event_type: string }>;

  const overdueTasks = tasks.filter((t) => t.due_date && new Date(t.due_date) < now);
  const itemsCaptured = weekActivity.filter((a) => a.event_type === "item_captured").length;
  const tasksCompleted = weekActivity.filter((a) => a.event_type === "task_completed").length;

  // Context digest for LLM
  const contextLines: string[] = [
    `Date: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
    `Open proposals awaiting approval: ${proposals.length}`,
  ];

  if (proposals.length) {
    contextLines.push(`Top proposals: ${proposals.slice(0, 3).map((p) => p.title).join("; ")}`);
  }
  if (todayEvents.length) {
    contextLines.push(`Today's events: ${todayEvents.map((e) => `${e.title} at ${new Date(e.start_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`).join("; ")}`);
  }
  if (overdueTasks.length) {
    contextLines.push(`Overdue tasks (${overdueTasks.length}): ${overdueTasks.slice(0, 3).map((t) => t.title).join("; ")}`);
  }
  if (bills.length) {
    contextLines.push(`Bills due in 3 days: ${bills.map((b) => `${b.name} $${Number(b.amount).toFixed(0)}`).join(", ")}`);
  }
  if (maintenance.length) {
    contextLines.push(`Maintenance due soon: ${maintenance.slice(0, 3).map((m) => m.item).join(", ")}`);
  }
  if (lowStock.length) {
    contextLines.push(`Low inventory: ${lowStock.slice(0, 4).map((i) => i.name).join(", ")}`);
  }

  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return buildFallbackBriefing({ today, proposals, todayEvents, overdueTasks, bills, maintenance, lowStock, itemsCaptured, tasksCompleted, tasks });
  }

  const prompt = `You are the Chief of Staff generating a morning briefing for a household. Be warm, direct, and actionable.

${contextLines.join("\n")}

Return ONLY valid JSON — no markdown:
{
  "greeting": "<friendly morning greeting, mention the day>",
  "headline": "<1 sentence: what matters most today>",
  "priorities": [
    { "id": "<proposal or task id>", "title": "<what to do>", "agent": "<agent>", "why": "<1 sentence reason>" }
  ]
}

Rules:
- priorities: top 3 things the household should act on today, in order
- Pull priorities from open proposals and overdue tasks
- Mention any bills due today or tomorrow in the headline if present
- Keep greeting under 15 words`;

  const t0 = Date.now();
  let parsed: Record<string, unknown> | null = null;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type === "text") {
      const match = content.text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    void logAgentRun({
      agent: "chief",
      trigger: "briefing",
      inboxItemId: null,
      model: MODEL,
      promptTokens: message.usage.input_tokens,
      completionTokens: message.usage.output_tokens,
      latencyMs: Date.now() - t0,
      inputSummary: `Daily briefing ${today}`,
      output: parsed,
      ok: !!parsed,
      error: parsed ? undefined : "parse failed",
    });
  } catch (err) {
    void logAgentRun({ agent: "chief", trigger: "briefing", inboxItemId: null, model: MODEL, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - t0, inputSummary: `Daily briefing ${today}`, output: null, ok: false, error: err instanceof Error ? err.message : String(err) });
  }

  const greeting = typeof parsed?.greeting === "string" ? parsed.greeting : `Good morning — here's your ${now.toLocaleDateString("en-US", { weekday: "long" })} brief.`;
  const headline = typeof parsed?.headline === "string" ? parsed.headline : buildDefaultHeadline({ overdueTasks, bills, proposals });
  const priorities = Array.isArray(parsed?.priorities)
    ? (parsed.priorities as Array<{ id: string; title: string; agent: string; why: string }>)
        .filter((p) => typeof p.title === "string")
        .slice(0, 3)
        .map((p) => ({ id: String(p.id ?? ""), title: String(p.title), agent: (p.agent ?? "chief") as AgentId, why: String(p.why ?? "") }))
    : [];

  const summary: BriefingSummary = {
    date: today,
    greeting,
    headline,
    tasksOpen: tasks.filter((t) => t.status !== "done").length,
    tasksDue: tasks.filter((t) => t.due_date && new Date(t.due_date).toISOString().slice(0, 10) === today).length,
    tasksOverdue: overdueTasks.length,
    upcomingEvents: todayEvents.length,
    billsThisWeek: bills.length,
    maintenanceDueSoon: maintenance.length,
    lowStockItems: lowStock.length,
    savingsRatePercent: null,
    itemsCapturedThisWeek: itemsCaptured,
    tasksCompletedThisWeek: tasksCompleted,
    priorities,
    crossAgentInsights: [],
  };

  // Persist to daily_briefings
  await supabase
    .from("daily_briefings")
    .upsert(
      { date: today, household_id: tenantId, content: summary as unknown as Record<string, unknown> },
      { onConflict: "date,household_id" },
    );

  return summary;
}

export async function getTodaysBriefing(householdId?: string): Promise<BriefingSummary | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const tenantId = householdId ?? getHouseholdForJob();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_briefings")
    .select("content")
    .eq("date", today)
    .eq("household_id", tenantId)
    .maybeSingle();
  return data ? (data as { content: BriefingSummary }).content : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaultHeadline(ctx: {
  overdueTasks: unknown[];
  bills: Array<{ name: string }>;
  proposals: Array<{ title: string }>;
}): string {
  if (ctx.overdueTasks.length > 0) return `${ctx.overdueTasks.length} overdue task${ctx.overdueTasks.length > 1 ? "s" : ""} need attention.`;
  if (ctx.bills.length > 0) return `${ctx.bills[0].name} bill due soon — check the money section.`;
  if (ctx.proposals.length > 0) return `${ctx.proposals.length} proposal${ctx.proposals.length > 1 ? "s" : ""} waiting for your approval.`;
  return "All clear — a good day to get ahead.";
}

function buildFallbackBriefing(ctx: {
  today: string;
  proposals: Array<{ id: string; title: string; agent: string }>;
  todayEvents: unknown[];
  overdueTasks: Array<{ id: string; title: string; agent: string }>;
  bills: Array<{ name: string }>;
  maintenance: unknown[];
  lowStock: unknown[];
  itemsCaptured: number;
  tasksCompleted: number;
  tasks: Array<{ status: string; due_date?: string }>;
}): BriefingSummary {
  const now = new Date();
  return {
    date: ctx.today,
    greeting: `Good morning — here's your ${now.toLocaleDateString("en-US", { weekday: "long" })} brief.`,
    headline: buildDefaultHeadline({ overdueTasks: ctx.overdueTasks, bills: ctx.bills, proposals: ctx.proposals }),
    tasksOpen: ctx.tasks.filter((t) => t.status !== "done").length,
    tasksDue: ctx.tasks.filter((t) => t.due_date && new Date(t.due_date).toISOString().slice(0, 10) === ctx.today).length,
    tasksOverdue: ctx.overdueTasks.length,
    upcomingEvents: (ctx.todayEvents as unknown[]).length,
    billsThisWeek: ctx.bills.length,
    maintenanceDueSoon: (ctx.maintenance as unknown[]).length,
    lowStockItems: (ctx.lowStock as unknown[]).length,
    savingsRatePercent: null,
    itemsCapturedThisWeek: ctx.itemsCaptured,
    tasksCompletedThisWeek: ctx.tasksCompleted,
    priorities: ctx.proposals.slice(0, 3).map((p) => ({ id: p.id, title: p.title, agent: p.agent as AgentId, why: "Awaiting your approval." })),
    crossAgentInsights: [],
  };
}
