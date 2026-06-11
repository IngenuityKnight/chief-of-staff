// Schedule specialist — stage 2 (BACKEND-BRIEF.md §4).
// Receives chief framing + sibling digests + own domain state, returns ProposalDraft[].

import { getAnthropicClient } from "@/lib/server/anthropic";
import { logAgentRun } from "./agent-runs";
import type { ProposalDraft, BlockTimePayload } from "./schemas";
import type { Rule } from "@/lib/types";
import type { ScheduleDomainState, SiblingDigests } from "./agent-context";

const MODEL = "claude-haiku-4-5-20251001";

export interface ScheduleCtx {
  inboxItemId: string;
  householdId: string;
  capture: string;
  chiefAnalysis: string;
  focus: string;
  rulesConsulted: string[];
  rulesConflicts: string[];
  domainState: ScheduleDomainState;
  domainRules: Rule[];
  siblingDigests: SiblingDigests;
}

export async function run(ctx: ScheduleCtx): Promise<ProposalDraft[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return [];

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const rulesText = ctx.domainRules
    .filter((r) => r.active)
    .map((r) => `[${r.priority === "must-follow" ? "MUST" : r.priority.toUpperCase()}][id:${r.id}] ${r.title}: ${r.description}`)
    .join("\n");

  const siblingText = [
    ctx.siblingDigests.meals ? `Meals: ${ctx.siblingDigests.meals}` : null,
    ctx.siblingDigests.money ? `Money: ${ctx.siblingDigests.money}` : null,
    ctx.siblingDigests.home ? `Home: ${ctx.siblingDigests.home}` : null,
  ].filter(Boolean).join("\n") || "(none)";

  const prompt = `You are the Schedule specialist. Plan time-blocks or events that address the chief's focus.

CAPTURE: "${ctx.capture}"
CHIEF FOCUS: ${ctx.focus}
CHIEF ANALYSIS: ${ctx.chiefAnalysis}

OWN STATE:
- Evening commitments: ${ctx.domainState.eveningCommitments}
- Open slots: ${ctx.domainState.openSlots}
- Conflicts: ${ctx.domainState.conflicts}

SIBLING DIGESTS:
${siblingText}

SCHEDULE RULES:
${rulesText || "(none)"}

Today: ${todayISO}

Return ONLY valid JSON — no markdown:
{
  "analysis": "<1 sentence: what you're scheduling and why>",
  "rules_consulted": ["<rule-id>"],
  "rules_conflicts": ["<must-follow rule-id violated>"],
  "blocks": [
    { "title": "...", "date": "YYYY-MM-DD", "startHour": 14, "durationMinutes": 60, "notes": "..." }
  ]
}

Rules:
- Propose at most 2 blocks; only when there's a clear scheduling action
- Skip blocks during existing evening commitments
- Respect any must-follow schedule rules; cite if violated`;

  const t0 = Date.now();
  let message: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
  try {
    message = await anthropic.messages.create({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content: prompt }] });
  } catch (err) {
    void logAgentRun({ agent: "schedule", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: 0, completionTokens: 0, latencyMs: Date.now() - t0, inputSummary: ctx.capture.slice(0, 200), output: null, ok: false, error: err instanceof Error ? err.message : String(err), householdId: ctx.householdId });
    return [];
  }

  const latencyMs = Date.now() - t0;
  const content = message.content[0];
  if (content.type !== "text") {
    void logAgentRun({ agent: "schedule", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: null, ok: false, error: "non-text", householdId: ctx.householdId });
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    const m = content.text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON");
    parsed = JSON.parse(m[0]);
  } catch {
    void logAgentRun({ agent: "schedule", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: { raw: content.text }, ok: false, error: "parse failed", householdId: ctx.householdId });
    return [];
  }

  void logAgentRun({ agent: "schedule", trigger: "capture", inboxItemId: ctx.inboxItemId, model: MODEL, promptTokens: message.usage.input_tokens, completionTokens: message.usage.output_tokens, latencyMs, inputSummary: ctx.capture.slice(0, 200), output: parsed, ok: true, householdId: ctx.householdId });

  const validRuleIds = new Set(ctx.domainRules.map((r) => r.id));
  const mustFollowIds = new Set(ctx.domainRules.filter((r) => r.priority === "must-follow").map((r) => r.id));
  const rulesConsulted = ((parsed.rules_consulted as unknown[]) ?? []).filter((id): id is string => typeof id === "string" && validRuleIds.has(id));
  const rulesConflicts = ((parsed.rules_conflicts as unknown[]) ?? []).filter((id): id is string => typeof id === "string" && mustFollowIds.has(id));

  const analysis = typeof parsed.analysis === "string" ? parsed.analysis : "Schedule plan.";
  const blocks = (parsed.blocks as BlockTimePayload[] | undefined) ?? [];

  return blocks
    .filter((b): b is BlockTimePayload => !!b && typeof b.date === "string" && typeof b.startHour === "number" && typeof b.title === "string")
    .slice(0, 2)
    .map((b) => ({
      inboxItemId: ctx.inboxItemId,
      agent: "schedule" as const,
      kind: "block_time" as const,
      title: b.title,
      rationale: analysis,
      payload: {
        title: b.title, date: b.date, startHour: b.startHour,
        durationMinutes: typeof b.durationMinutes === "number" ? b.durationMinutes : 60,
        notes: b.notes,
      },
      estimatedCostCents: 0,
      rulesConsulted, rulesConflicts,
    }));
}
