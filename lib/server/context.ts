import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getCurrentHousehold } from "@/lib/server/household";
import { getHouseholdContext, getRules } from "@/lib/server/data";
import type { Rule } from "@/lib/types";

export async function assembleHouseholdContext(householdIdOverride?: string): Promise<string> {
  const [ctx, rules] = await Promise.all([
    getHouseholdContext(householdIdOverride),
    getRules(householdIdOverride),
  ]);

  const activeRules = rules.filter((r) => r.active);

  const supabase = getSupabaseAdmin();
  const householdId = householdIdOverride ?? (await getCurrentHousehold());
  let recentActivity: Array<{ occurred_at: string; event_type: string; domain: string; entity_title: string }> = [];
  if (supabase && householdId) {
    try {
      const { data } = await supabase
        .from("activity_log")
        .select("occurred_at, event_type, domain, entity_title")
        .eq("household_id", householdId)
        .order("occurred_at", { ascending: false })
        .limit(20);
      if (data) recentActivity = data as typeof recentActivity;
    } catch {
      // ignore
    }
  }

  const lines: string[] = ["=== HOUSEHOLD CONTEXT ==="];

  if (ctx.householdName) lines.push(`Household: ${ctx.householdName}`);
  if (ctx.timezone) lines.push(`Timezone: ${ctx.timezone}`);
  if (ctx.frugalMode) lines.push("Mode: frugal — prefer low-cost options");
  if (ctx.budgetMonthly) lines.push(`Monthly budget: $${ctx.budgetMonthly}`);
  if (ctx.membersSum) lines.push(`Members: ${ctx.membersSum}`);
  if (ctx.aiPersona) lines.push(`Persona: ${ctx.aiPersona}`);
  if (ctx.goals) lines.push(`Goals: ${ctx.goals}`);

  if (activeRules.length > 0) {
    lines.push("\n=== ACTIVE RULES ===");
    for (const rule of activeRules) {
      const pfx = rule.priority === "must-follow" ? "[MUST]" : rule.priority === "prefer" ? "[PREFER]" : "[CONSIDER]";
      lines.push(`${pfx} ${rule.title}: ${rule.description}`);
    }
  }

  if (recentActivity.length > 0) {
    lines.push("\n=== RECENT ACTIVITY (last 20) ===");
    for (const event of recentActivity) {
      const ts = new Date(event.occurred_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      lines.push(`[${ts}] ${event.event_type} / ${event.domain}: ${event.entity_title}`);
    }
  }

  lines.push("=== END CONTEXT ===\n");
  return lines.join("\n");
}

// Variant for the intake/chief pipeline: same content but rules include IDs
// so the LLM can cite them in rules_consulted, and we can track usage.
export async function assembleContextForIntake(householdIdOverride?: string): Promise<{
  text: string;
  activeRules: Rule[];
}> {
  const [ctx, rules] = await Promise.all([
    getHouseholdContext(householdIdOverride),
    getRules(householdIdOverride),
  ]);
  const activeRules = rules.filter((r) => r.active);

  const supabase = getSupabaseAdmin();
  const householdId = householdIdOverride ?? (await getCurrentHousehold());
  let recentActivity: Array<{ occurred_at: string; event_type: string; domain: string; entity_title: string }> = [];
  if (supabase && householdId) {
    try {
      const { data } = await supabase
        .from("activity_log")
        .select("occurred_at, event_type, domain, entity_title")
        .eq("household_id", householdId)
        .order("occurred_at", { ascending: false })
        .limit(20);
      if (data) recentActivity = data as typeof recentActivity;
    } catch {
      // ignore
    }
  }

  const lines: string[] = ["=== HOUSEHOLD CONTEXT ==="];

  if (ctx.householdName) lines.push(`Household: ${ctx.householdName}`);
  if (ctx.timezone) lines.push(`Timezone: ${ctx.timezone}`);
  if (ctx.frugalMode) lines.push("Mode: frugal — prefer low-cost options");
  if (ctx.budgetMonthly) lines.push(`Monthly budget: $${ctx.budgetMonthly}`);
  if (ctx.membersSum) lines.push(`Members: ${ctx.membersSum}`);
  if (ctx.aiPersona) lines.push(`Persona: ${ctx.aiPersona}`);
  if (ctx.goals) lines.push(`Goals: ${ctx.goals}`);

  if (activeRules.length > 0) {
    lines.push("\n=== ACTIVE RULES (cite relevant rule IDs in rules_consulted) ===");
    for (const rule of activeRules) {
      const pfx = rule.priority === "must-follow" ? "[MUST]" : rule.priority === "prefer" ? "[PREFER]" : "[CONSIDER]";
      lines.push(`${pfx}[id:${rule.id}] ${rule.title}: ${rule.description}`);
    }
  }

  if (recentActivity.length > 0) {
    lines.push("\n=== RECENT ACTIVITY (last 20) ===");
    for (const event of recentActivity) {
      const ts = new Date(event.occurred_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      lines.push(`[${ts}] ${event.event_type} / ${event.domain}: ${event.entity_title}`);
    }
  }

  lines.push("=== END CONTEXT ===\n");
  return { text: lines.join("\n"), activeRules };
}
