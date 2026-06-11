// Orchestrator — runs the chief, fans out specialists in parallel, synthesizes
// the Play, persists proposals + the play row, and routes them through the
// policy gate. Single entry point for capture-driven planning.
//
// BACKEND-BRIEF.md §4 — Promise.allSettled fan-out so partial failures never
// block other specialists. Each specialist receives the chief's framing + its
// own domain state + sibling digests (the cross-domain coordination layer).

import type { AgentId } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getRules } from "@/lib/server/data";
import type { ProposalDraft } from "./schemas";
import type { ChiefDecision, ChiefInvocation } from "./chief";
import { synthesize as synthesizeChiefPlay } from "./chief";
import {
  buildMealsDomainState,
  buildScheduleDomainState,
  buildMoneyDomainState,
  type SiblingDigests,
} from "./agent-context";
import type { IntakeAnalysis, ProposalResult } from "@/lib/server/intake";
import { persistAndGateProposals } from "@/lib/server/intake";
import { run as runMeals } from "./meals";
import { run as runSchedule } from "./schedule";
import { run as runMoney } from "./money";
import { extractMemories } from "./memory";

export interface OrchestrationResult {
  proposals: ProposalResult[];
  playId: string | null;
  playSynthesis: string | null;
}

// Map agent id → its runner. Roster/home not yet implemented as specialists;
// they fall back to the chief's create_task list.
async function runSpecialist(
  agent: AgentId,
  base: {
    inboxItemId: string;
    householdId: string;
    capture: string;
    chiefAnalysis: string;
    focus: string;
    rulesConsulted: string[];
    rulesConflicts: string[];
    siblingDigests: SiblingDigests;
  },
): Promise<ProposalDraft[]> {
  const allRules = await getRules();

  if (agent === "meals") {
    const domainState = await buildMealsDomainState();
    return runMeals({
      ...base,
      domainState,
      domainRules: allRules.filter((r) => r.category === "meals" || r.category === "general"),
    });
  }
  if (agent === "schedule") {
    const domainState = await buildScheduleDomainState(base.householdId);
    return runSchedule({
      ...base,
      domainState,
      domainRules: allRules.filter((r) => r.category === "schedule" || r.category === "general"),
    });
  }
  if (agent === "money") {
    const domainState = await buildMoneyDomainState(base.householdId);
    return runMoney({
      ...base,
      domainState,
      domainRules: allRules.filter((r) => r.category === "money" || r.category === "general"),
    });
  }
  return [];
}

// Build the per-specialist sibling digests in parallel — small text summaries
// so each specialist sees the cross-domain picture without re-querying.
async function buildSiblingDigests(householdId: string): Promise<SiblingDigests> {
  const [meals, schedule, money] = await Promise.allSettled([
    buildMealsDomainState(),
    buildScheduleDomainState(householdId),
    buildMoneyDomainState(householdId),
  ]);

  return {
    meals: meals.status === "fulfilled"
      ? `${meals.value.calendarDensity} ${meals.value.lowStockFood !== "No low-stock food items." ? `Low stock: ${meals.value.lowStockFood}.` : ""}`.trim()
      : undefined,
    schedule: schedule.status === "fulfilled"
      ? `${schedule.value.eveningCommitments}. ${schedule.value.openSlots}`
      : undefined,
    money: money.status === "fulfilled"
      ? `${money.value.budgetHeadroom}. ${money.value.upcomingBills}`
      : undefined,
  };
}

export async function orchestrate(
  analysis: IntakeAnalysis,
  chiefDecision: ChiefDecision,
): Promise<OrchestrationResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { proposals: [], playId: null, playSynthesis: null };

  const siblingDigests = await buildSiblingDigests(analysis.householdId);

  // Fan-out — specialists in parallel + memory extraction running alongside.
  // Memory drafts are merged into the same Play so the user reviews "what was
  // proposed" and "what was learned" side by side.
  const [results, memoryDrafts] = await Promise.all([
    Promise.allSettled(
      chiefDecision.invocations.map((inv: ChiefInvocation) =>
        runSpecialist(inv.agent, {
          inboxItemId: analysis.id,
          householdId: analysis.householdId,
          capture: analysis.text,
          chiefAnalysis: chiefDecision.analysis,
          focus: inv.focus,
          rulesConsulted: chiefDecision.rulesConsulted,
          rulesConflicts: chiefDecision.rulesConflicts,
          siblingDigests,
        }).then((drafts) => ({ agent: inv.agent, drafts })),
      ),
    ),
    extractMemories({
      capture: analysis.text,
      inboxItemId: analysis.id,
      householdId: analysis.householdId,
    }),
  ]);

  const successful = results
    .filter((r): r is PromiseFulfilledResult<{ agent: AgentId; drafts: ProposalDraft[] }> => r.status === "fulfilled")
    .map((r) => r.value);
  const allDrafts: ProposalDraft[] = [...successful.flatMap((s) => s.drafts), ...memoryDrafts];

  // Fallback: if no specialist produced anything, fall back to chief's create_task list.
  if (allDrafts.length === 0) {
    const fallback = chiefDecision.proposedTasks.map((title) => ({
      inboxItemId: analysis.id,
      agent: analysis.routing.primary,
      kind: "create_task" as const,
      title,
      rationale: analysis.analysis,
      payload: {
        title,
        agent: analysis.routing.primary,
        category: analysis.routing.category,
        priority: analysis.urgency,
      },
      estimatedCostCents: 0,
      rulesConsulted: analysis.rulesConsulted ?? [],
      rulesConflicts: analysis.rulesConflicts ?? [],
    }));
    const proposals = await persistAndGateProposals(fallback, analysis);
    return { proposals, playId: null, playSynthesis: null };
  }

  // Multi-specialist or rich single-specialist output → wrap in a Play.
  // A "play" is meaningful when at least two specialists contributed OR the
  // single specialist returned ≥2 proposals (e.g. Meals' plan + grocery + prep).
  const distinctAgents = new Set(successful.map((s) => s.agent));
  const wrapInPlay = distinctAgents.size >= 2 || allDrafts.length >= 2;

  let playId: string | null = null;
  let playSynthesis: string | null = null;

  if (wrapInPlay) {
    const draftSummaries = successful
      .filter((s) => s.drafts.length)
      .map((s) => ({ agent: s.agent, titles: s.drafts.map((d) => d.title) }));

    playSynthesis = await synthesizeChiefPlay({
      capture: analysis.text,
      chiefAnalysis: chiefDecision.analysis,
      draftSummaries,
      inboxItemId: analysis.id,
      householdId: analysis.householdId,
    });

    playId = `play_${crypto.randomUUID()}`;
    const { error } = await supabase.from("plays").insert({
      id: playId,
      household_id: analysis.householdId,
      inbox_item_id: analysis.id,
      synthesis: playSynthesis,
      status: "awaiting_approval",
    });
    if (error) {
      console.error("Play insert failed:", error);
      playId = null;
    }
  }

  const proposals = await persistAndGateProposals(allDrafts, analysis, { playId });
  return { proposals, playId, playSynthesis };
}
