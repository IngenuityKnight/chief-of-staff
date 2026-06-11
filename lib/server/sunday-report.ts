// Chief's Report — Sunday evening synthesis (NEXT-LEVEL-BRIEF.md F5).
//
// Aggregates the past 7 days of events + agent_runs + proposal outcomes,
// runs one LLM synthesis call, stores the result, and (if Resend is wired)
// emails it. Suggests at most one trust upgrade based on approval streaks —
// never auto-applied. Acceptance: "plays run, hours of admin handled, dollars
// saved, what the house learned, one suggested trust upgrade."

import { getAnthropicClient } from "@/lib/server/anthropic";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { logAgentRun } from "@/lib/server/agents/agent-runs";
import { sendEmail } from "@/lib/server/email";
import { getHouseholdForJob } from "@/lib/server/household";
import type { AgentId, ProposalKind } from "@/lib/types";

const MODEL = "claude-haiku-4-5-20251001";

export interface ChiefsReport {
  weekStart: string;
  weekEnd: string;
  headline: string;
  body: string;
  metrics: {
    captures: number;
    proposalsCreated: number;
    proposalsApproved: number;
    proposalsDeclined: number;
    proposalsAutoExecuted: number;
    playsRun: number;
    hoursHandledEstimate: number;
    dollarsSavedEstimate: number;
    rulesLearned: number;
  };
  suggestedUpgrade: {
    agent: AgentId;
    kind: ProposalKind;
    fromLevel: number;
    toLevel: number;
    rationale: string;
  } | null;
}

// Rough heuristic: each executed proposal saves the household 15-45 min
// depending on kind. The Chief's Report headlines this as "hours handled"
// rather than "tasks completed" — it's a feeling, not a clock.
const HOURS_PER_KIND: Record<string, number> = {
  meal_plan: 1.5,        // a full week of meal planning
  order_item: 0.1,       // adding to shopping list
  block_time: 0.25,      // calendar block
  create_task: 0.1,
  pay_bill: 0.5,
  cancel_subscription: 0.4,
  upsert_appliance: 0.25,
  upsert_vehicle: 0.25,
  record_service: 0.2,
  add_rule: 0.1,
};

export async function generateChiefsReport(householdIdOverride?: string): Promise<ChiefsReport | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const householdId = householdIdOverride ?? getHouseholdForJob();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [
    propsR, captureR, runsR, rulesR, billsR,
  ] = await Promise.allSettled([
    supabase.from("proposals")
      .select("id, agent, kind, status, decided_by, estimated_cost_cents")
      .eq("household_id", householdId)
      .gte("created_at", weekAgo.toISOString()),
    supabase.from("activity_log")
      .select("id, event_type")
      .eq("household_id", householdId)
      .eq("event_type", "item_captured")
      .gte("occurred_at", weekAgo.toISOString()),
    supabase.from("plays")
      .select("id, synthesis, status")
      .eq("household_id", householdId)
      .gte("created_at", weekAgo.toISOString()),
    supabase.from("rules")
      .select("id, title, priority, times_consulted, last_consulted_at")
      .eq("household_id", householdId)
      .gte("last_consulted_at", weekAgo.toISOString()),
    supabase.from("bills")
      .select("id, name, amount, status")
      .eq("household_id", householdId)
      .eq("autopay", true)
      .neq("status", "overdue"),
  ]);

  const proposals = (propsR.status === "fulfilled" ? propsR.value.data ?? [] : []) as Array<{ id: string; agent: AgentId; kind: ProposalKind; status: string; decided_by: string | null; estimated_cost_cents: number }>;
  const captures = (captureR.status === "fulfilled" ? captureR.value.data ?? [] : []) as Array<{ id: string }>;
  const plays = (runsR.status === "fulfilled" ? runsR.value.data ?? [] : []) as Array<{ id: string; synthesis: string; status: string }>;
  const rulesCited = (rulesR.status === "fulfilled" ? rulesR.value.data ?? [] : []) as Array<{ id: string; title: string }>;
  const autopayBillsClean = (billsR.status === "fulfilled" ? billsR.value.data ?? [] : []) as Array<{ id: string }>;

  const approved = proposals.filter((p) => p.status === "executed");
  const autoExecuted = proposals.filter((p) => p.status === "auto_executed");
  const declined = proposals.filter((p) => p.status === "declined");

  // Hours handled: sum of per-kind estimates for executed work
  const hoursHandled = [...approved, ...autoExecuted].reduce((sum, p) => sum + (HOURS_PER_KIND[p.kind] ?? 0.15), 0);

  // Dollars saved heuristic — late fees avoided (autopay bills not overdue × $35)
  // and cancelled subscriptions executed this week. A real implementation would
  // track actual savings; this is a directional metric.
  const dollarsSaved =
    autopayBillsClean.length * 35 +
    approved.filter((p) => p.kind === "cancel_subscription").reduce((s, p) => s + p.estimated_cost_cents / 100, 0);

  // Suggested trust upgrade: an agent/kind with ≥7 approvals and 0 declines
  const byAgentKind = new Map<string, { approvals: number; declines: number; agent: AgentId; kind: ProposalKind }>();
  for (const p of proposals) {
    const key = `${p.agent}:${p.kind}`;
    if (!byAgentKind.has(key)) byAgentKind.set(key, { approvals: 0, declines: 0, agent: p.agent, kind: p.kind });
    const e = byAgentKind.get(key)!;
    if (p.status === "executed" && p.decided_by === "user") e.approvals++;
    if (p.status === "declined") e.declines++;
  }
  const candidates = [...byAgentKind.values()]
    .filter((e) => e.approvals >= 7 && e.declines === 0)
    .sort((a, b) => b.approvals - a.approvals);
  const upgradeCandidate = candidates[0] ?? null;

  let suggestedUpgrade: ChiefsReport["suggestedUpgrade"] = null;
  if (upgradeCandidate) {
    const { data: trustRow } = await supabase
      .from("agent_trust")
      .select("level")
      .eq("household_id", householdId)
      .eq("agent", upgradeCandidate.agent)
      .eq("kind", upgradeCandidate.kind)
      .maybeSingle();
    const currentLevel = (trustRow as { level: number } | null)?.level ?? 0;
    if (currentLevel < 3) {
      suggestedUpgrade = {
        agent: upgradeCandidate.agent,
        kind: upgradeCandidate.kind,
        fromLevel: currentLevel,
        toLevel: currentLevel + 1,
        rationale: `You approved ${upgradeCandidate.approvals} of ${upgradeCandidate.approvals} ${upgradeCandidate.kind} proposals this week.`,
      };
    }
  }

  const metrics: ChiefsReport["metrics"] = {
    captures: captures.length,
    proposalsCreated: proposals.length,
    proposalsApproved: approved.length,
    proposalsDeclined: declined.length,
    proposalsAutoExecuted: autoExecuted.length,
    playsRun: plays.length,
    hoursHandledEstimate: Math.round(hoursHandled * 10) / 10,
    dollarsSavedEstimate: Math.round(dollarsSaved),
    rulesLearned: rulesCited.length,
  };

  const contextLines = [
    `Week ending ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
    `Captures: ${metrics.captures}.`,
    `Proposals: ${metrics.proposalsCreated} created, ${metrics.proposalsApproved} approved, ${metrics.proposalsAutoExecuted} auto-executed, ${metrics.proposalsDeclined} declined.`,
    `Plays run: ${metrics.playsRun}.`,
    `Rules consulted this week: ${rulesCited.slice(0, 4).map((r) => r.title).join("; ") || "(none)"}.`,
    `Top plays: ${plays.slice(0, 2).map((p) => p.synthesis).join(" || ") || "(none)"}.`,
  ];

  const anthropic = getAnthropicClient();
  const t0 = Date.now();

  let synthesis: { headline: string; body: string } | null = null;
  if (anthropic) {
    const prompt = `You are the Chief of Staff writing the household's Sunday-evening report. Be calm, specific, and direct. 4-6 sentences total, no bullets.

${contextLines.join("\n")}

Return ONLY JSON:
{
  "headline": "<one sentence summary, warm and specific>",
  "body": "<3-5 sentences: what the house handled, what was learned, what's queued for next week. Mention metrics naturally; don't list them.>"
}`;
    try {
      const message = await anthropic.messages.create({ model: MODEL, max_tokens: 500, messages: [{ role: "user", content: prompt }] });
      const content = message.content[0];
      if (content.type === "text") {
        const m = content.text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (typeof parsed.headline === "string" && typeof parsed.body === "string") {
            synthesis = { headline: parsed.headline, body: parsed.body };
          }
        }
      }
      void logAgentRun({ agent: "chief", trigger: "briefing", inboxItemId: null, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs: Date.now() - t0, inputSummary: "Sunday report", output: synthesis as unknown as Record<string, unknown>, ok: !!synthesis, error: synthesis ? undefined : "parse failed", householdId });
    } catch (err) {
      void logAgentRun({ agent: "chief", trigger: "briefing", inboxItemId: null, model: MODEL, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - t0, inputSummary: "Sunday report", output: null, ok: false, error: err instanceof Error ? err.message : String(err), householdId });
    }
  }

  if (!synthesis) {
    synthesis = {
      headline: `A quiet week — ${metrics.proposalsApproved + metrics.proposalsAutoExecuted} actions handled, roughly ${metrics.hoursHandledEstimate}h of admin off your plate.`,
      body: `The house ran ${metrics.playsRun} coordinated play${metrics.playsRun === 1 ? "" : "s"}. ${metrics.captures} captures came in, ${metrics.proposalsCreated} proposals were drafted. ${metrics.dollarsSavedEstimate ? `Estimated $${metrics.dollarsSavedEstimate} in late fees and recurring charges avoided. ` : ""}Memory grew by ${metrics.rulesLearned} cited rule${metrics.rulesLearned === 1 ? "" : "s"} this week.`,
    };
  }

  const report: ChiefsReport = {
    weekStart: weekAgo.toISOString().slice(0, 10),
    weekEnd: now.toISOString().slice(0, 10),
    headline: synthesis.headline,
    body: synthesis.body,
    metrics,
    suggestedUpgrade,
  };

  // Persist as a daily_briefings row keyed at the week-end date
  await supabase.from("daily_briefings").upsert(
    { date: report.weekEnd, household_id: householdId, content: report as unknown as Record<string, unknown> },
    { onConflict: "date,household_id" },
  );

  // Email if Resend is configured + the household has an email member
  const { data: members } = await supabase
    .from("household_members")
    .select("notes")
    .eq("household_id", householdId)
    .limit(5);
  const inferEmails = ((members ?? []) as Array<{ notes: string | null }>)
    .map((m) => m.notes?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0])
    .filter((s): s is string => !!s);

  if (process.env.RESEND_API_KEY && inferEmails.length) {
    const html = `
      <div style="font-family: ui-sans-serif, system-ui; background:#191410; color:#EFE9DF; padding:32px;">
        <h1 style="font-size:22px; color:#E8A857; margin:0 0 8px 0;">The week in your house</h1>
        <p style="color:#857A67; margin:0 0 24px 0; font-size:13px;">${report.weekStart} → ${report.weekEnd}</p>
        <p style="font-size:18px; line-height:1.4; margin:0 0 16px 0; color:#EFE9DF;">${report.headline}</p>
        <p style="font-size:14px; line-height:1.6; color:#C2BAA8;">${report.body}</p>
        ${suggestedUpgrade ? `
          <div style="margin-top:24px; border-left:3px solid #97B873; padding:12px 16px; background:#241D16;">
            <strong style="color:#97B873;">A trust upgrade you've earned:</strong>
            Let ${suggestedUpgrade.agent} handle ${suggestedUpgrade.kind} at level ${suggestedUpgrade.toLevel}. ${suggestedUpgrade.rationale}
          </div>` : ""}
        <p style="margin-top:32px; color:#857A67; font-size:12px;">— The Chief</p>
      </div>`;
    await sendEmail({
      to: inferEmails,
      subject: `Your house, this week: ${report.headline}`,
      html,
      text: `${report.headline}\n\n${report.body}`,
    });
  }

  return report;
}
