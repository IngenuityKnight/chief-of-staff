// Policy gate — pure function with no side effects (BACKEND-BRIEF.md §4).
//
// gate(proposal, mustFollowRuleIds, trustLevel) → GateResult
//
// Decision hierarchy (each checked in order; first match wins):
//   1. Must-follow rule conflict  → always 'ask'  (binding code check, not LLM)
//   2. Trust level 0              → always 'ask'
//   3. Cost > $200 (trust < 3)   → always 'ask'
//   4. Cost > trust ceiling       → 'ask'
//   5. Otherwise                  → 'auto'
//
// 'block' is reserved for future hard-stop rules (e.g. "never cancel insurance").
// Currently unreachable but kept in the type so callers handle it.

export type GateDecision = "ask" | "auto" | "block";
export type GateResult = { decision: GateDecision; reason: string };

// Trust level → max auto-execution cost in cents
// Level 3 = no cost limit (user explicitly granted full trust)
const TRUST_COST_CEILING: Record<number, number> = {
  1:  5_000,    // $50
  2: 20_000,    // $200
  3: Infinity,
};

const HARD_COST_LIMIT_CENTS = 20_000; // $200

export function gate(
  proposal: {
    kind: string;
    estimatedCostCents: number;
    rulesConflicts: string[];
  },
  mustFollowRuleIds: Set<string>,
  trustLevel: number,
): GateResult {
  // 1. Must-follow conflict — code validates; LLM self-report is informative only
  const confirmedConflicts = proposal.rulesConflicts.filter((id) => mustFollowRuleIds.has(id));
  if (confirmedConflicts.length > 0) {
    return {
      decision: "ask",
      reason: `Touches ${confirmedConflicts.length} must-follow rule(s) — human approval required`,
    };
  }

  // 2. Trust level 0 — never auto
  if (trustLevel <= 0) {
    return { decision: "ask", reason: "Trust level 0 — all proposals require approval" };
  }

  // 3. Hard cost limit for trust levels 1–2
  if (trustLevel < 3 && proposal.estimatedCostCents > HARD_COST_LIMIT_CENTS) {
    return {
      decision: "ask",
      reason: `Estimated cost $${(proposal.estimatedCostCents / 100).toFixed(2)} exceeds $200 hard limit`,
    };
  }

  // 4. Trust level cost ceiling
  const ceiling = TRUST_COST_CEILING[trustLevel] ?? 0;
  if (proposal.estimatedCostCents > ceiling) {
    return {
      decision: "ask",
      reason: `Estimated cost $${(proposal.estimatedCostCents / 100).toFixed(2)} exceeds trust level ${trustLevel} ceiling ($${(ceiling / 100).toFixed(0)})`,
    };
  }

  return { decision: "auto", reason: `Trust level ${trustLevel} permits auto-execution` };
}
