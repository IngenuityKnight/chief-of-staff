// Economy Agent — gigs, accounts, payday scheduling
// Proposes: gig_post (from maintenance automation), payday_disbursement
// Queries: gigs, payday_settings, economy_accounts, home agent state

import { getAnthropicClient } from "@/lib/server/anthropic";
import { logAgentRun } from "./agent-runs";
import type { ProposalDraft } from "./schemas";
import type {
  GigPostPayload,
  PaydayDisbursementPayload,
} from "./schemas";
import type { Rule } from "@/lib/types";

const MODEL = "claude-haiku-4-5-20251001";

export interface EconomyCtx {
  inboxItemId: string;
  householdId: string;
  capture: string;
  chiefAnalysis: string;
  focus: string;
  rulesConsulted: string[];
  rulesConflicts: string[];
  domainState: EconomyDomainState;
  domainRules: Rule[];
}

export interface EconomyDomainState {
  activeAccounts: number;        // household members with economy_accounts
  totalGigsOpen: number;          // unclaimed gigs
  totalGigsClaimed: number;       // claimed but not yet submitted
  totalGigsApproved: number;      // approved but not yet paid
  approvedGigsSinceLast: Array<{  // gigs awaiting payment this period
    id: string;
    memberId: string;
    title: string;
    bountyCents: number;
  }>;
  paydayStatus: "due-today" | "due-soon" | "next-run" | "not-configured";
  paydayNextRun?: string;         // ISO timestamp
  maintenanceItemsDue: Array<{    // items from home domain that crossed due-soon
    id: string;
    item: string;
    frequency: string;
    suggestedBounty?: number;     // cents; heuristic based on frequency
  }>;
}

export async function run(ctx: EconomyCtx): Promise<ProposalDraft[]> {
  const proposals: ProposalDraft[] = [];

  // Fast path: if the Chief didn't route to economy, check if there's automation work
  // (maintenance due → gig proposal, payday due → disbursement proposal).
  // If Chief did route to economy, use LLM to refine proposals.

  if (ctx.focus && ctx.focus.length > 10) {
    // Chief sent this to economy; use LLM to suggest proposals
    proposals.push(...(await suggestProposalsViaLLM(ctx)));
  } else {
    // No explicit Chief focus; emit automation proposals
    proposals.push(...suggestMaintenanceGigs(ctx));
    proposals.push(...suggestPaydayDisbursement(ctx));
  }

  return proposals;
}

async function suggestProposalsViaLLM(ctx: EconomyCtx): Promise<ProposalDraft[]> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return [];

  const rulesText = ctx.domainRules
    .filter((r) => r.active)
    .map(
      (r) =>
        `[${r.priority === "must-follow" ? "MUST" : r.priority.toUpperCase()}][id:${r.id}] ${r.title}: ${r.description}`
    )
    .join("\n");

  const prompt = `You are the Economy specialist. The household runs a small gig-based economy where kids can earn money.

CAPTURE: "${ctx.capture}"
CHIEF FOCUS: ${ctx.focus}
CHIEF ANALYSIS: ${ctx.chiefAnalysis}

ECONOMY STATE:
- Active accounts: ${ctx.domainState.activeAccounts}
- Open gigs: ${ctx.domainState.totalGigsOpen}
- Claimed gigs: ${ctx.domainState.totalGigsClaimed}
- Approved (owed) gigs: ${ctx.domainState.totalGigsApproved}
- Payday status: ${ctx.domainState.paydayStatus}
- Maintenance items due soon: ${ctx.domainState.maintenanceItemsDue.length}

ECONOMY RULES:
${rulesText || "(none)"}

Return ONLY valid JSON — no markdown:
{
  "analysis": "<1 sentence: what economy action you propose and why>",
  "rules_consulted": ["<rule-id>"],
  "rules_conflicts": ["<must-follow rule-id violated>"],
  "proposals": [
    {
      "kind": "gig_post",
      "title": "<gig title>",
      "rationale": "<1 sentence why>",
      "payload": {
        "title": "<gig title>",
        "description": "<details>",
        "bountyCents": 500,
        "sourceType": "manual"
      }
    }
  ]
}

Rules:
- Only suggest 0–2 proposals
- gig_post: use when the capture mentions new work to price
- Keep bounty suggestions realistic for household chores (e.g., $5–$25)`;

  const t0 = Date.now();
  let message: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    void logAgentRun({
      agent: "economy",
      trigger: "capture",
      inboxItemId: ctx.inboxItemId,
      model: MODEL,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: Date.now() - t0,
      inputSummary: ctx.capture.slice(0, 200),
      output: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      householdId: ctx.householdId,
    });
    return [];
  }

  const latencyMs = Date.now() - t0;
  const content = message.content[0];
  if (content.type !== "text") {
    void logAgentRun({
      agent: "economy",
      trigger: "capture",
      inboxItemId: ctx.inboxItemId,
      model: MODEL,
      promptTokens: message.usage.input_tokens,
      completionTokens: message.usage.output_tokens,
      latencyMs,
      inputSummary: ctx.capture.slice(0, 200),
      output: null,
      ok: false,
      error: "non-text",
      householdId: ctx.householdId,
    });
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    const m = content.text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON");
    parsed = JSON.parse(m[0]);
  } catch {
    void logAgentRun({
      agent: "economy",
      trigger: "capture",
      inboxItemId: ctx.inboxItemId,
      model: MODEL,
      promptTokens: message.usage.input_tokens,
      completionTokens: message.usage.output_tokens,
      latencyMs,
      inputSummary: ctx.capture.slice(0, 200),
      output: { raw: content.text },
      ok: false,
      error: "parse failed",
      householdId: ctx.householdId,
    });
    return [];
  }

  void logAgentRun({
    agent: "economy",
    trigger: "capture",
    inboxItemId: ctx.inboxItemId,
    model: MODEL,
    promptTokens: message.usage.input_tokens,
    completionTokens: message.usage.output_tokens,
    latencyMs,
    inputSummary: ctx.capture.slice(0, 200),
    output: parsed,
    ok: true,
    householdId: ctx.householdId,
  });

  const validRuleIds = new Set(ctx.domainRules.map((r) => r.id));
  const mustFollowIds = new Set(
    ctx.domainRules.filter((r) => r.priority === "must-follow").map((r) => r.id)
  );
  const rulesConsulted = ((parsed.rules_consulted as unknown[]) ?? []).filter(
    (id): id is string => typeof id === "string" && validRuleIds.has(id)
  );
  const rulesConflicts = ((parsed.rules_conflicts as unknown[]) ?? []).filter(
    (id): id is string => typeof id === "string" && mustFollowIds.has(id)
  );

  const proposed = (parsed.proposals as Array<{
    kind: string;
    title: string;
    rationale: string;
    payload: Record<string, unknown>;
    estimatedDollars?: number;
  }> | undefined) ?? [];

  return proposed
    .filter((p) => p && typeof p.title === "string" && typeof p.kind === "string")
    .slice(0, 2)
    .map((p) => ({
      inboxItemId: ctx.inboxItemId,
      agent: "economy" as const,
      kind: (p.kind as any) || "gig_post",
      title: p.title,
      rationale:
        typeof p.rationale === "string"
          ? p.rationale
          : "Economy specialist proposed.",
      payload: p.payload ?? {},
      estimatedCostCents: typeof p.estimatedDollars === "number" ? Math.max(0, Math.round(p.estimatedDollars * 100)) : 0,
      rulesConsulted,
      rulesConflicts,
    }));
}

function suggestMaintenanceGigs(ctx: EconomyCtx): ProposalDraft[] {
  const proposals: ProposalDraft[] = [];

  // For each maintenance item due/due-soon, propose a gig posting.
  // Heuristic: $5–$25 depending on frequency (monthly/quarterly → lower; annual → higher).
  for (const item of ctx.domainState.maintenanceItemsDue) {
    const bounty = item.suggestedBounty ?? estimateBounty(item.frequency);

    const payload: GigPostPayload = {
      title: `${item.item} (${item.frequency})`,
      description: `Household maintenance: ${item.item}`,
      bountyCents: bounty,
      sourceType: "maintenance_automation",
      linkedMaintenanceItemId: item.id,
    };

    proposals.push({
      inboxItemId: ctx.inboxItemId,
      agent: "economy" as const,
      kind: "gig_post",
      title: `Advertise "${item.item}" as a gig (${formatCents(bounty)})`,
      rationale: `Maintenance item due soon — create gig for household member to claim.`,
      payload,
      estimatedCostCents: bounty,
      rulesConsulted: ctx.rulesConsulted,
      rulesConflicts: ctx.rulesConflicts,
    });
  }

  return proposals;
}

function suggestPaydayDisbursement(ctx: EconomyCtx): ProposalDraft[] {
  // Only propose payday if it's due or due-soon.
  if (!["due-today", "due-soon"].includes(ctx.domainState.paydayStatus)) {
    return [];
  }

  if (!ctx.domainState.approvedGigsSinceLast.length) {
    return [];
  }

  const proposals: ProposalDraft[] = [];

  // Group approved gigs by member, sum bounties.
  const byMember = new Map<
    string,
    { gigs: typeof ctx.domainState.approvedGigsSinceLast; totalCents: number }
  >();

  for (const gig of ctx.domainState.approvedGigsSinceLast) {
    const m = byMember.get(gig.memberId) ?? { gigs: [], totalCents: 0 };
    m.gigs.push(gig);
    m.totalCents += gig.bountyCents;
    byMember.set(gig.memberId, m);
  }

  // One proposal per member.
  for (const [memberId, { gigs, totalCents }] of byMember) {
    const gigTitles = gigs.map((g) => g.title).join(", ");

    const payload: PaydayDisbursementPayload = {
      memberId,
      gigIds: gigs.map((g) => g.id),
      totalCents,
      paydayRunId: "", // will be filled by executor
      splits: [
        // Default split (from rules, or fallback 30% save, 70% spend)
        { bucketType: "save", percentOfTotal: 30, amountCents: Math.round((totalCents * 30) / 100) },
        { bucketType: "spend", percentOfTotal: 70, amountCents: Math.round((totalCents * 70) / 100) },
      ],
    };

    proposals.push({
      inboxItemId: ctx.inboxItemId,
      agent: "economy" as const,
      kind: "payday_disbursement",
      title: `Payday: ${gigs.length} gig(s), ${formatCents(totalCents)} owed`,
      rationale: `Scheduled payday arrived. Gigs owed: ${gigTitles}.`,
      payload,
      estimatedCostCents: totalCents,
      rulesConsulted: ctx.rulesConsulted,
      rulesConflicts: ctx.rulesConflicts,
    });
  }

  return proposals;
}

function estimateBounty(frequency: string): number {
  // Simple heuristic for household maintenance chore bounty.
  // More frequent → less bounty; less frequent → more bounty.
  switch (frequency.toLowerCase()) {
    case "weekly":
      return 500; // $5
    case "monthly":
      return 750; // $7.50
    case "quarterly":
      return 1000; // $10
    case "semi-annual":
      return 1500; // $15
    case "annual":
      return 2000; // $20
    default:
      return 1000; // $10 default
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
